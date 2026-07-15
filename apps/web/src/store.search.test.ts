import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Clip } from "@clipm/contracts";

// The real api module constructs a WebSocket at import time.
vi.mock("./api.ts", () => ({
  api: {
    getSnapshot: vi.fn(),
    dispatch: vi.fn(),
    search: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    onReconnect: vi.fn(() => () => {}),
  },
}));

import { api } from "./api.ts";
import { useClipboardStore } from "./store.ts";

const searchMock = vi.mocked(api.search);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function clip(id: string): Clip {
  return { id, content: id, contentType: "text" } as unknown as Clip;
}

describe("runSearch stale-request handling", () => {
  beforeEach(() => {
    searchMock.mockReset();
    useClipboardStore.setState({
      searchQuery: "",
      searchFilters: {},
      searchResults: null,
      searchResolvedQuery: "",
      searchLoading: false,
    });
  });

  it("applies only the newest request when responses arrive out of order", async () => {
    const first = deferred<{ clips: Clip[] }>();
    const second = deferred<{ clips: Clip[] }>();
    searchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const store = useClipboardStore.getState();
    const firstSearch = store.search("alpha");
    const secondSearch = store.search("beta");

    second.resolve({ clips: [clip("beta-result")] });
    await secondSearch;
    first.resolve({ clips: [clip("alpha-result")] });
    await firstSearch;

    const state = useClipboardStore.getState();
    expect(state.searchResults?.map((c) => c.id)).toEqual(["beta-result"]);
    expect(state.searchLoading).toBe(false);
  });

  it("applies the latest response even if the query text changed without a new dispatch (debounce window)", async () => {
    const request = deferred<{ clips: Clip[] }>();
    searchMock.mockReturnValueOnce(request.promise);

    const store = useClipboardStore.getState();
    const pendingSearch = store.search("ab");
    // Simulate a keystroke inside SearchBar's 250ms debounce window: the
    // query state changes but no new search has been dispatched yet.
    store.setSearchQuery("abc");

    request.resolve({ clips: [clip("ab-result")] });
    await pendingSearch;

    const state = useClipboardStore.getState();
    expect(state.searchResults?.map((c) => c.id)).toEqual(["ab-result"]);
    expect(state.searchLoading).toBe(false);
  });

  it("clears the loading flag when the latest request fails", async () => {
    searchMock.mockRejectedValueOnce(new Error("boom"));

    await useClipboardStore.getState().search("oops");

    const state = useClipboardStore.getState();
    expect(state.searchLoading).toBe(false);
    expect(state.searchResults).toBeNull();
  });
});
