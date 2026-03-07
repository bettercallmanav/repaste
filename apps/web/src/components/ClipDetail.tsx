import { Copy, Pin, Trash2, X } from "lucide-react";
import type { Clip } from "@clipm/contracts";
import { useClipboardStore } from "../store.ts";
import { TagInput } from "./TagInput.tsx";

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-300">{value}</dd>
    </div>
  );
}

export function ClipDetail() {
  const { clips, selectedClipId, copyClip, selectClip, pinClip, unpinClip, deleteClip } =
    useClipboardStore();

  const clip = clips.find((c: Clip) => c.id === selectedClipId);
  if (!clip) return null;

  return (
    <div className="flex h-full flex-col border-l border-zinc-700/50 bg-zinc-900/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-700/50 px-4 py-3">
        <h2 className="text-sm font-medium text-zinc-200">Clip Detail</h2>
        <button
          onClick={() => selectClip(null)}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {clip.contentType === "image" && clip.imageDataUrl ? (
          <img
            src={clip.imageDataUrl}
            alt="Clipboard image"
            className="max-w-full rounded-lg border border-zinc-700"
          />
        ) : (
          <pre className="whitespace-pre-wrap break-all rounded-lg bg-zinc-800 p-3 text-sm text-zinc-200 font-mono leading-relaxed">
            {clip.content}
          </pre>
        )}

        {/* Metadata */}
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <DetailField label="Type" value={clip.contentType} />
          <DetailField label="Captured" value={new Date(clip.capturedAt).toLocaleString()} />
          <DetailField label="Paste count" value={String(clip.pasteCount)} />
          <DetailField label="Pinned" value={clip.pinned ? "Yes" : "No"} />
          {clip.sourceApp && <DetailField label="Source" value={clip.sourceApp} />}
          {clip.metadata.charCount > 0 && (
            <DetailField label="Characters" value={String(clip.metadata.charCount)} />
          )}
          {clip.metadata.wordCount > 0 && (
            <DetailField label="Words" value={String(clip.metadata.wordCount)} />
          )}
          {clip.metadata.language && (
            <DetailField label="Language" value={clip.metadata.language} />
          )}
        </dl>

        {/* Tags with add/remove */}
        <TagInput clipId={clip.id} tags={clip.tags} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-zinc-700/50 p-3">
        <button
          onClick={() => { void copyClip(clip.id); }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
        >
          <Copy className="size-3.5" />
          Copy
        </button>
        <button
          onClick={() => {
            if (clip.pinned) { unpinClip(clip.id); } else { pinClip(clip.id); }
          }}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-600"
        >
          <Pin className="size-3.5" />
          {clip.pinned ? "Unpin" : "Pin"}
        </button>
        <button
          onClick={() => {
            deleteClip(clip.id);
            selectClip(null);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
        >
          <Trash2 className="size-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}
