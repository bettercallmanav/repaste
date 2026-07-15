import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import type { ClipboardDesktopBridge } from "@clipm/contracts/ipc";
import { useClipboardStore } from "./store.ts";
import { SearchBar } from "./components/SearchBar.tsx";
import { ClipList } from "./components/ClipList.tsx";
import { ClipDetail } from "./components/ClipDetail.tsx";
import { MergeBar } from "./components/MergeBar.tsx";
import { SettingsPanel, applyStoredTheme } from "./components/Settings.tsx";
import logoUrl from "./assets/repaste-icon.png";
import "./app.css";

// Apply the persisted theme before first paint so the body/window
// background always matches the rendered theme.
applyStoredTheme();

type DesktopWindow = Window & {
  desktopBridge?: ClipboardDesktopBridge;
};

function truncateLabel(text: string, maxLen = 22): string {
  const oneLine = text.split("\n")[0] ?? "";
  return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + "…" : oneLine;
}

function PinnedSlots() {
  const { clips, pasteClip, showToast } = useClipboardStore();
  const pinned = clips.filter((clip) => clip.pinned && !clip.deletedAt).slice(0, 9);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      const index = Number.parseInt(event.key, 10);
      if (!Number.isInteger(index) || index < 1 || index > pinned.length) return;
      event.preventDefault();
      const clip = pinned[index - 1]!;
      void pasteClip(clip.id);
      showToast(`Copied “${truncateLabel(clip.preview)}” ✓`);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pinned, pasteClip, showToast]);

  if (pinned.length === 0) return null;

  return (
    <div className="ui-divider flex items-center gap-2 overflow-x-auto border-b px-3.5 py-2">
      <span className="ui-mono ui-group-label shrink-0">Pinned</span>
      {pinned.map((clip, index) => (
        <button
          key={clip.id}
          className="ui-slot flex items-center gap-1.5 py-0.5 pl-1 pr-2.5 text-xs"
          title={`⌘${index + 1}`}
          onClick={() => {
            void pasteClip(clip.id);
            useClipboardStore.getState().showToast(`Copied “${truncateLabel(clip.preview)}” ✓`);
          }}
        >
          <span className="ui-slot-num ui-mono">{index + 1}</span>
          {truncateLabel(clip.preview)}
        </button>
      ))}
    </div>
  );
}

function Footer() {
  const { clips } = useClipboardStore();
  return (
    <div className="ui-footer ui-mono flex flex-wrap items-center justify-between gap-2 px-3.5 py-2">
      <span>
        <kbd className="ui-kbd">&uarr;&darr;</kbd> move&ensp;
        <kbd className="ui-kbd">&#9166;</kbd> copy&ensp;
        <kbd className="ui-kbd">&rarr;</kbd> actions&ensp;
        <kbd className="ui-kbd">&#8984;1&ndash;9</kbd> pinned
      </span>
      <span className="flex items-center gap-1.5">
        <i className="ui-privacy-dot" />
        {clips.length} clips &middot; all on this Mac
      </span>
    </div>
  );
}

function Toast() {
  const { toast } = useClipboardStore();
  return (
    <div
      role="status"
      className="ui-toast ui-mono fixed bottom-9 left-1/2 z-10 -translate-x-1/2"
      style={{ opacity: toast ? 1 : 0, translate: toast ? "-50% -8px" : "-50% 0" }}
    >
      {toast ?? ""}
    </div>
  );
}

function App() {
  const { init, selectedClipId } = useClipboardStore();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    const desktopBridge = (window as DesktopWindow).desktopBridge;
    if (!desktopBridge?.onTrayClipSelected) return;

    return desktopBridge.onTrayClipSelected((clipId) => {
      const { clearSearch, selectClip } = useClipboardStore.getState();
      clearSearch();
      selectClip(clipId);
      setShowSettings(false);
    });
  }, []);

  return (
    <div className="ui-shell flex h-screen flex-col">
      {/* Header */}
      <header className="ui-divider flex items-center gap-2 border-b px-3.5 py-2.5">
        <img src={logoUrl} alt="Repaste logo" className="ui-logo" />
        <h1 className="ui-text-primary ui-mono text-[13px] font-semibold tracking-wide">Repaste</h1>

        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setShowSettings(false)}
            className={`ui-mono rounded-lg px-2.5 py-1 text-[10.5px] tracking-wider ${
              !showSettings ? "ui-tab-active" : "ui-tab"
            }`}
          >
            CLIPS
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`ui-mono rounded-lg px-2.5 py-1 text-[10.5px] tracking-wider ${
              showSettings ? "ui-tab-active" : "ui-tab"
            }`}
          >
            SETTINGS
          </button>
        </div>
      </header>

      {showSettings ? (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      ) : selectedClipId ? (
        <ClipDetail />
      ) : (
        <>
          <div className="ui-divider border-b px-3.5 py-2.5">
            <SearchBar />
          </div>
          <PinnedSlots />
          <div className="flex flex-1 flex-col overflow-hidden">
            <ClipList />
          </div>
          <MergeBar />
          <Footer />
        </>
      )}

      <Toast />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
