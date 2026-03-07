import { create } from "zustand";
import type { Clip, ClipboardCommand, Snippet } from "@clipm/contracts";
import { WS_CHANNELS } from "@clipm/contracts";
import { api } from "./api.ts";

type ActiveView = "clips" | "snippets";

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
    try {
      const snapshot = await api.getSnapshot();
      set({
        clips: snapshot.clips,
        snippets: snapshot.snippets,
        knownTags: snapshot.knownTags,
        loading: false,
      });
    } catch (err) {
      console.error("Failed to load snapshot", err);
      set({ loading: false });
    }

    // Subscribe to domain events for real-time updates
    api.subscribe(WS_CHANNELS.domainEvent, () => {
      api.getSnapshot().then((snapshot) => {
        set({
          clips: snapshot.clips,
          snippets: snapshot.snippets,
          knownTags: snapshot.knownTags,
        });
      }).catch(console.error);
    });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  search: async (query) => {
    if (query.trim().length === 0) {
      set({ searchResults: null });
      return;
    }
    try {
      const { clips } = await api.search(query);
      set({ searchResults: clips });
    } catch (err) {
      console.error("Search failed", err);
    }
  },

  clearSearch: () => set({ searchQuery: "", searchResults: null }),

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
    await api.dispatch({
      commandId: crypto.randomUUID(),
      type: "clip.paste",
      clipId,
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
