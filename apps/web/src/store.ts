import { create } from "zustand";
import type { Clip, ClipboardCommand, Snippet } from "@clipm/contracts";
import { WS_CHANNELS } from "@clipm/contracts";
import type { ClipboardDesktopBridge } from "@clipm/contracts/ipc";
import { api } from "./api.ts";

type ActiveView = "clips" | "snippets";

let latestSearchRequestId = 0;
let initPromise: Promise<void> | null = null;
let unsubscribeDomainEvents: (() => void) | null = null;

type DesktopWindow = Window & {
  desktopBridge?: ClipboardDesktopBridge;
};

interface ClipboardStore {
  // State
  clips: readonly Clip[];
  snippets: readonly Snippet[];
  knownTags: readonly string[];
  searchQuery: string;
  searchResults: readonly Clip[] | null;
  selectedClipId: string | null;
  selectedClipIds: readonly string[];
  activeView: ActiveView;
  loading: boolean;

  // Actions
  init: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
  selectClip: (id: string | null) => void;
  toggleClipSelection: (id: string) => void;
  clearSelection: () => void;
  setActiveView: (view: ActiveView) => void;
  copyClip: (clipId: string) => Promise<void>;
  pinClip: (clipId: string) => Promise<void>;
  unpinClip: (clipId: string) => Promise<void>;
  deleteClip: (clipId: string) => Promise<void>;
  tagClip: (clipId: string, tag: string) => Promise<void>;
  untagClip: (clipId: string, tag: string) => Promise<void>;
  pasteClip: (clipId: string) => Promise<void>;
  mergeClips: (clipIds: readonly string[], separator: string) => Promise<void>;

  // Snippet actions
  createSnippet: (title: string, content: string, shortcut: string | null) => Promise<void>;
  updateSnippet: (snippetId: string, updates: { title?: string; content?: string; shortcut?: string | null }) => Promise<void>;
  deleteSnippet: (snippetId: string) => Promise<void>;
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
  if (clip.contentType === "image" && clip.imageDataUrl) {
    await writeImageToClipboard(clip.imageDataUrl);
    return;
  }

  await writeTextToClipboard(clip.content);
}

async function runSearch(
  query: string,
  set: (state: Partial<ClipboardStore>) => void,
  get: () => ClipboardStore,
): Promise<void> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length === 0) {
    latestSearchRequestId++;
    set({ searchResults: null });
    return;
  }

  const requestId = ++latestSearchRequestId;

  try {
    const { clips } = await api.search(normalizedQuery);
    if (requestId !== latestSearchRequestId) return;
    if (get().searchQuery.trim() !== normalizedQuery) return;
    set({ searchResults: clips });
  } catch (err) {
    if (requestId === latestSearchRequestId) {
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
    snippets: snapshot.snippets,
    knownTags: snapshot.knownTags,
  });

  await runSearch(get().searchQuery, set, get);
}

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  clips: [],
  snippets: [],
  knownTags: [],
  searchQuery: "",
  searchResults: null,
  selectedClipId: null,
  selectedClipIds: [],
  activeView: "clips",
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

  search: async (query) => runSearch(query, set, get),

  clearSearch: () => {
    latestSearchRequestId++;
    set({ searchQuery: "", searchResults: null });
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

  setActiveView: (view) => set({ activeView: view }),

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

  createSnippet: async (title, content, shortcut) => {
    await api.dispatch({
      commandId: crypto.randomUUID(),
      type: "snippet.create",
      snippetId: crypto.randomUUID(),
      title,
      content,
      shortcut,
      createdAt: new Date().toISOString(),
    } as ClipboardCommand);
  },

  updateSnippet: async (snippetId, updates) => {
    await api.dispatch({
      commandId: crypto.randomUUID(),
      type: "snippet.update",
      snippetId,
      ...updates,
      updatedAt: new Date().toISOString(),
    } as ClipboardCommand);
  },

  deleteSnippet: async (snippetId) => {
    await api.dispatch({
      commandId: crypto.randomUUID(),
      type: "snippet.delete",
      snippetId,
    } as ClipboardCommand);
  },
}));
