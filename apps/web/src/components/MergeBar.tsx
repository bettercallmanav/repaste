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
    <div className="ui-divider ui-panel-tint flex items-center gap-2 border-b px-4 py-2">
      <span className="ui-text-muted text-xs">
        {selectedClipIds.length} clips selected
      </span>
      <input
        value={separator}
        onChange={(e) => setSeparator(e.target.value)}
        className="ui-input w-16 rounded px-2 py-0.5 text-xs font-mono"
        title="Separator (use \\n for newline)"
      />
      <button
        onClick={handleMerge}
        className="ui-btn-primary flex items-center gap-1 rounded px-2 py-1 text-xs font-medium"
      >
        <Merge className="size-3" /> Merge
      </button>
      <button
        onClick={clearSelection}
        className="ui-btn-secondary flex items-center gap-1 rounded px-2 py-1 text-xs"
      >
        <X className="size-3" /> Cancel
      </button>
    </div>
  );
}
