import { useState } from "react";
import { Merge, X } from "lucide-react";
import { useClipboardStore } from "../store.ts";

export function MergeBar() {
  const { selectedClipIds, clearSelection, mergeClips } = useClipboardStore();
  const [separator, setSeparator] = useState("\\n");

  if (selectedClipIds.length < 2) return null;

  function handleMerge() {
    // Convert escape sequences in separator
    const actualSep = separator.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
    mergeClips(selectedClipIds, actualSep);
  }

  return (
    <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-4 py-2">
      <span className="text-xs text-zinc-400">
        {selectedClipIds.length} clips selected
      </span>
      <input
        value={separator}
        onChange={(e) => setSeparator(e.target.value)}
        className="w-16 rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
        title="Separator (use \\n for newline)"
      />
      <button
        onClick={handleMerge}
        className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500"
      >
        <Merge className="size-3" /> Merge
      </button>
      <button
        onClick={clearSelection}
        className="flex items-center gap-1 rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
      >
        <X className="size-3" /> Cancel
      </button>
    </div>
  );
}
