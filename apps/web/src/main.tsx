import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Clipboard, Scissors, Settings } from "lucide-react";
import type { ClipboardDesktopBridge } from "@clipm/contracts/ipc";
import { useClipboardStore } from "./store.ts";
import { SearchBar } from "./components/SearchBar.tsx";
import { ClipList } from "./components/ClipList.tsx";
import { ClipDetail } from "./components/ClipDetail.tsx";
import { MergeBar } from "./components/MergeBar.tsx";
import { SnippetManager } from "./components/SnippetManager.tsx";
import { SettingsPanel } from "./components/Settings.tsx";
import "./app.css";

type DesktopWindow = Window & {
  desktopBridge?: ClipboardDesktopBridge;
};

function App() {
  const { init, clips, snippets, selectedClipId, activeView, setActiveView } = useClipboardStore();
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
      setActiveView("clips");
    });
  }, [setActiveView]);

  return (
    <div className="ui-shell flex h-screen flex-col">
      {/* Header */}
      <header className="ui-divider flex items-center gap-3 border-b px-4 py-3">
        <Clipboard className="ui-header-icon size-5" />
        <h1 className="ui-text-primary text-sm font-semibold">Repaste</h1>
        <span className="ui-badge rounded-full px-2 py-0.5 text-xs">
          {clips.length} clips
        </span>

        {/* View tabs */}
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => { setActiveView("clips"); setShowSettings(false); }}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              activeView === "clips" && !showSettings
                ? "ui-tab-active"
                : "ui-tab"
            }`}
          >
            <Clipboard className="size-3" />
            Clips
          </button>
          <button
            onClick={() => { setActiveView("snippets"); setShowSettings(false); }}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              activeView === "snippets" && !showSettings
                ? "ui-tab-active"
                : "ui-tab"
            }`}
          >
            <Scissors className="size-3" />
            Snippets
            {snippets.length > 0 && (
              <span className="ui-badge rounded-full px-1.5 text-xs">{snippets.length}</span>
            )}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              showSettings
                ? "ui-tab-active"
                : "ui-tab"
            }`}
          >
            <Settings className="size-3" />
          </button>
        </div>
      </header>

      {showSettings ? (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      ) : activeView === "clips" ? (
        <>
          {/* Search */}
          <div className="ui-divider border-b px-4 py-2">
            <SearchBar />
          </div>

          {/* Merge bar */}
          <MergeBar />

          {/* Main content */}
          <div className="flex flex-1 overflow-hidden">
            <div className={`flex-1 overflow-y-auto ${selectedClipId ? "w-1/2" : "w-full"}`}>
              <ClipList />
            </div>
            {selectedClipId && (
              <div className="w-1/2">
                <ClipDetail />
              </div>
            )}
          </div>
        </>
      ) : (
        <SnippetManager />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
