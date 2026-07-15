import { useState } from "react";
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
    <div className="ui-divider ui-panel flex items-center gap-2 border-t px-3.5 py-2">
      <span className="ui-mono text-[10.5px] text-amber-400">
        {selectedClipIds.length} selected
      </span>
      <input
        value={separator}
        onChange={(e) => setSeparator(e.target.value)}
        className="ui-input ui-mono w-14 rounded-md px-2 py-1 text-center text-[11px]"
        title="Separator (use \\n for newline)"
        aria-label="Merge separator"
      />
      <button onClick={handleMerge} className="ui-act ui-act-go ui-mono">
        Merge
      </button>
      <button onClick={clearSelection} className="ui-act ui-mono">
        Cancel
      </button>
    </div>
  );
}
