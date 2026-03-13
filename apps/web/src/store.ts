import { create } from "zustand";
import { DEFAULT_SETTINGS } from "@clipm/contracts";
import type { AppSettings, Clip, ClipSearchFilters, ClipboardCommand } from "@clipm/contracts";
import { WS_CHANNELS } from "@clipm/contracts";
import type { ClipboardDesktopBridge } from "@clipm/contracts/ipc";
import { api } from "./api.ts";
import { parseSearchQuery } from "./lib/searchQueryParser.ts";

let latestSearchRequestId = 0;
let initPromise: Promise<void> | null = null;
let unsubscribeDomainEvents: (() => void) | null = null;

type DesktopWindow = Window & {
  desktopBridge?: ClipboardDesktopBridge;
};

function normalizeSearchFilters(filters: ClipSearchFilters | undefined): ClipSearchFilters {
  if (!filters) return {};

  const tag = filters.tag?.trim();
  const sourceApp = filters.sourceApp?.trim();
  const dateFrom = filters.dateFrom?.trim();
  const dateTo = filters.dateTo?.trim();

  return {
    ...(filters.contentType !== undefined ? { contentType: filters.contentType } : {}),
    ...(filters.pinned !== undefined ? { pinned: filters.pinned } : {}),
    ...(tag && tag.length > 0 ? { tag } : {}),
    ...(sourceApp && sourceApp.length > 0 ? { sourceApp } : {}),
    ...(dateFrom && dateFrom.length > 0 ? { dateFrom } : {}),
    ...(dateTo && dateTo.length > 0 ? { dateTo } : {}),
  };
}

function hasActiveSearch(query: string, filters: ClipSearchFilters | undefined): boolean {
  return query.trim().length > 0 || Object.keys(normalizeSearchFilters(filters)).length > 0;
}

function getSearchRequestKey(query: string, filters: ClipSearchFilters | undefined): string {
  return JSON.stringify({
    query: query.trim(),
    filters: normalizeSearchFilters(filters),
  });
}

interface ClipboardStore {
  // State
  clips: readonly Clip[];
  settings: AppSettings;
  knownTags: readonly string[];
  searchQuery: string;
  searchFilters: ClipSearchFilters;
  searchResults: readonly Clip[] | null;
  searchResolvedQuery: string;
  searchLoading: boolean;
  selectedClipId: string | null;
  selectedClipIds: readonly string[];
  loading: boolean;

  // Actions
  init: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSearchFilters: (filters: Partial<ClipSearchFilters>) => void;
  search: (query?: string, filters?: ClipSearchFilters) => Promise<void>;
  clearSearch: () => void;
  selectClip: (id: string | null) => void;
  toggleClipSelection: (id: string) => void;
  clearSelection: () => void;
  copyClip: (clipId: string) => Promise<void>;
  pinClip: (clipId: string) => Promise<void>;
  unpinClip: (clipId: string) => Promise<void>;
  deleteClip: (clipId: string) => Promise<void>;
  tagClip: (clipId: string, tag: string) => Promise<void>;
  untagClip: (clipId: string, tag: string) => Promise<void>;
  pasteClip: (clipId: string) => Promise<void>;
  saveImageAs: (clipId: string) => Promise<void>;
  revealImageInFinder: (clipId: string) => Promise<void>;
  retryOcr: (clipId: string) => Promise<void>;
  mergeClips: (clipIds: readonly string[], separator: string) => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

function getDesktopBridge(): ClipboardDesktopBridge | undefined {
  return (window as DesktopWindow).desktopBridge;
}

async function writeTextToClipboard(text: string): Promise<void> {
  const desktopBridge = getDesktopBridge();
  if (desktopBridge) {
    await desktopBridge.writeClipboard(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}

async function writeImageToClipboard(dataUrl: string): Promise<void> {
  const desktopBridge = getDesktopBridge();
  if (desktopBridge) {
    const success = await desktopBridge.writeImageDataUrl(dataUrl);
    if (success) return;
  }

  if (typeof ClipboardItem === "undefined" || typeof navigator.clipboard?.write !== "function") {
    throw new Error("Image clipboard writes are not supported in this environment");
  }

  const blob = await fetch(dataUrl).then((response) => response.blob());
  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type || "image/png"]: blob,
    }),
  ]);
}

async function writeClipToClipboard(clip: Clip): Promise<void> {
  if (clip.contentType === "image") {
    const desktopBridge = getDesktopBridge();
    if (clip.imageAssetPath && desktopBridge) {
      const success = await desktopBridge.writeImageFile(clip.imageAssetPath);
      if (success) return;
    }

    if (clip.imageDataUrl) {
      await writeImageToClipboard(clip.imageDataUrl);
      return;
    }
  }

  await writeTextToClipboard(clip.content);
}

async function runSearch(
  query: string,
  filters: ClipSearchFilters,
  set: (state: Partial<ClipboardStore>) => void,
  get: () => ClipboardStore,
): Promise<void> {
  if (!hasActiveSearch(query, filters)) {
    latestSearchRequestId++;
    set({ searchResults: null, searchResolvedQuery: "", searchLoading: false });
    return;
  }

  // Parse prefix syntax from query (e.g. "type:image sunset")
  const parsed = parseSearchQuery(query);
  const ftsQuery = parsed.text;
  // Merge: manual filters take precedence over parsed filters
  const mergedFilters = normalizeSearchFilters({
    ...parsed.filters,
    ...filters,
  });

  const normalizedQuery = ftsQuery.trim();
  const requestId = ++latestSearchRequestId;
  const requestKey = getSearchRequestKey(query, filters);
  set({ searchLoading: true, searchResolvedQuery: "" });

  try {
    const { clips } = await api.search(normalizedQuery, mergedFilters);
    if (requestId !== latestSearchRequestId) return;
    if (getSearchRequestKey(get().searchQuery, get().searchFilters) !== requestKey) return;
    set({ searchResults: clips, searchResolvedQuery: normalizedQuery, searchLoading: false });
  } catch (err) {
    if (requestId === latestSearchRequestId) {
      set({ searchLoading: false, searchResolvedQuery: "" });
      console.error("Search failed", err);
    }
  }
}

async function refreshSnapshot(
  set: (state: Partial<ClipboardStore>) => void,
  get: () => ClipboardStore,
): Promise<void> {
  const snapshot = await api.getSnapshot();
  set({
    clips: snapshot.clips,
    settings: snapshot.settings,
    knownTags: snapshot.knownTags,
  });

  await runSearch(get().searchQuery, get().searchFilters, set, get);
}

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  clips: [],
  settings: DEFAULT_SETTINGS,
  knownTags: [],
  searchQuery: "",
  searchFilters: {},
  searchResults: null,
  searchResolvedQuery: "",
  searchLoading: false,
  selectedClipId: null,
  selectedClipIds: [],
  loading: true,

  init: async () => {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        await refreshSnapshot(set, get);
      } catch (err) {
        console.error("Failed to load snapshot", err);
      } finally {
        set({ loading: false });
      }

      if (!unsubscribeDomainEvents) {
        unsubscribeDomainEvents = api.subscribe(WS_CHANNELS.domainEvent, () => {
          void refreshSnapshot(set, get).catch(console.error);
        });
      }
    })();

    return initPromise;
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSearchFilters: (filters) =>
    set((state) => ({
      searchFilters: {
        ...state.searchFilters,
        ...filters,
      },
    })),

  search: async (query = get().searchQuery, filters = get().searchFilters) =>
    runSearch(query, filters, set, get),

  clearSearch: () => {
    latestSearchRequestId++;
    set({
      searchQuery: "",
      searchFilters: {},
      searchResults: null,
      searchResolvedQuery: "",
      searchLoading: false,
    });
  },

  selectClip: (id) => set({ selectedClipId: id }),

  toggleClipSelection: (id) => {
    const { selectedClipIds } = get();
    if (selectedClipIds.includes(id)) {
      set({ selectedClipIds: selectedClipIds.filter((cid) => cid !== id) });
    } else {
      set({ selectedClipIds: [...selectedClipIds, id] });
    }
  },

  clearSelection: () => set({ selectedClipIds: [] }),

  copyClip: async (clipId) => {
    const clip = get().clips.find((currentClip) => currentClip.id === clipId);
    if (!clip) return;
    await writeClipToClipboard(clip);
  },

  pinClip: async (clipId) => {
    await api.dispatch({
      commandId: crypto.randomUUID(),
      type: "clip.pin",
      clipId,
    } as ClipboardCommand);
  },

  unpinClip: async (clipId) => {
    await api.dispatch({
      commandId: crypto.randomUUID(),
      type: "clip.unpin",
      clipId,
    } as ClipboardCommand);
  },

  deleteClip: async (clipId) => {
    await api.dispatch({
      commandId: crypto.randomUUID(),
      type: "clip.delete",
      clipId,
    } as ClipboardCommand);
  },

  tagClip: async (clipId, tag) => {
    await api.dispatch({
      commandId: crypto.randomUUID(),
      type: "clip.tag",
      clipId,
      tag,
    } as ClipboardCommand);
  },

  untagClip: async (clipId, tag) => {
    await api.dispatch({
      commandId: crypto.randomUUID(),
      type: "clip.untag",
      clipId,
      tag,
    } as ClipboardCommand);
  },

  pasteClip: async (clipId) => {
    const clip = get().clips.find((currentClip) => currentClip.id === clipId);
    if (!clip) return;
    await writeClipToClipboard(clip);
    await api.dispatch({
      commandId: crypto.randomUUID(),
      type: "clip.paste",
      clipId,
      pastedAt: new Date().toISOString(),
    } as ClipboardCommand);
  },

  saveImageAs: async (clipId) => {
    const clip = get().clips.find((c) => c.id === clipId);
    if (!clip?.imageAssetPath) return;
    const bridge = getDesktopBridge();
    if (bridge?.saveImageAs) {
      await bridge.saveImageAs(clip.imageAssetPath);
    }
  },

  revealImageInFinder: async (clipId) => {
    const clip = get().clips.find((c) => c.id === clipId);
    if (!clip?.imageAssetPath) return;
    const bridge = getDesktopBridge();
    if (bridge?.revealImageInFinder) {
      await bridge.revealImageInFinder(clip.imageAssetPath);
    }
  },

  retryOcr: async (clipId) => {
    const clip = get().clips.find((c) => c.id === clipId);
    if (!clip?.imageAssetPath) return;
    const bridge = getDesktopBridge();
    if (bridge?.retryOcr) {
      await bridge.retryOcr(clipId, clip.imageAssetPath);
    }
  },

  mergeClips: async (clipIds, separator) => {
    await api.dispatch({
      commandId: crypto.randomUUID(),
      type: "clip.merge",
      sourceClipIds: clipIds,
      newClipId: crypto.randomUUID(),
      separator,
      capturedAt: new Date().toISOString(),
    } as ClipboardCommand);
    set({ selectedClipIds: [] });
  },

  updateSettings: async (settings) => {
    await api.dispatch({
      commandId: crypto.randomUUID(),
      type: "settings.update",
      settings,
      updatedAt: new Date().toISOString(),
    } as ClipboardCommand);
  },
}));
