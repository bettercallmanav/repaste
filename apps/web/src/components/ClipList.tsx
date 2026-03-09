import type { Clip } from "@clipm/contracts";
import { useClipboardStore } from "../store.ts";
import { ClipCard } from "./ClipCard.tsx";
import { Clipboard } from "lucide-react";

export function ClipList() {
  const { clips, searchResults, selectedClipId, selectedClipIds, loading } = useClipboardStore();
  const displayClips = searchResults ?? clips;

  if (loading) {
    return (
      <div className="ui-empty flex flex-1 items-center justify-center">
        Loading...
      </div>
    );
  }

  if (displayClips.length === 0) {
    return (
      <div className="ui-empty flex flex-1 flex-col items-center justify-center gap-3">
        <Clipboard className="size-12 opacity-30" />
        <p className="text-sm">
          {searchResults ? "No clips match your search filters" : "No clips yet"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto p-2">
      {displayClips.map((clip: Clip) => (
        <ClipCard
          key={clip.id}
          clip={clip}
          selected={clip.id === selectedClipId}
          multiSelected={selectedClipIds.includes(clip.id)}
        />
      ))}
    </div>
  );
}
