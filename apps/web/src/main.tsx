import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Clipboard, Scissors, Settings } from "lucide-react";
import { useClipboardStore } from "./store.ts";
import { SearchBar } from "./components/SearchBar.tsx";
import { ClipList } from "./components/ClipList.tsx";
import { ClipDetail } from "./components/ClipDetail.tsx";
import { MergeBar } from "./components/MergeBar.tsx";
import { SnippetManager } from "./components/SnippetManager.tsx";
import { SettingsPanel } from "./components/Settings.tsx";
import "./app.css";

function App() {
  const { init, clips, snippets, selectedClipId, activeView, setActiveView } = useClipboardStore();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <Clipboard className="size-5 text-blue-400" />
        <h1 className="text-sm font-semibold text-zinc-100">Repaste</h1>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          {clips.length} clips
        </span>

        {/* View tabs */}
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => { setActiveView("clips"); setShowSettings(false); }}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              activeView === "clips" && !showSettings
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Clipboard className="size-3" />
            Clips
          </button>
          <button
            onClick={() => { setActiveView("snippets"); setShowSettings(false); }}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              activeView === "snippets" && !showSettings
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Scissors className="size-3" />
            Snippets
            {snippets.length > 0 && (
              <span className="rounded-full bg-zinc-600 px-1.5 text-xs">{snippets.length}</span>
            )}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              showSettings
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
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
          <div className="border-b border-zinc-800 px-4 py-2">
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
