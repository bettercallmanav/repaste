import { Copy, Pin, Trash2, X } from "lucide-react";
import type { Clip } from "@clipm/contracts";
import { useClipboardStore } from "../store.ts";
import { TagInput } from "./TagInput.tsx";

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ui-text-muted text-xs font-medium">{label}</dt>
      <dd className="ui-text-secondary mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

export function ClipDetail() {
  const { clips, selectedClipId, copyClip, selectClip, pinClip, unpinClip, deleteClip } =
    useClipboardStore();

  const clip = clips.find((c: Clip) => c.id === selectedClipId);
  if (!clip) return null;

  return (
    <div className="ui-divider ui-panel-tint flex h-full flex-col border-l">
      {/* Header */}
      <div className="ui-divider flex items-center justify-between border-b px-4 py-3">
        <h2 className="ui-text-primary text-sm font-medium">Clip Detail</h2>
        <button
          onClick={() => selectClip(null)}
          className="ui-icon-button rounded p-1"
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
            className="ui-image-frame max-w-full rounded-lg border"
          />
        ) : (
          <pre className="ui-pre whitespace-pre-wrap break-all rounded-lg p-3 text-sm font-mono leading-relaxed">
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
      <div className="ui-divider flex gap-2 border-t p-3">
        <button
          onClick={() => { void copyClip(clip.id); }}
          className="ui-btn-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
        >
          <Copy className="size-3.5" />
          Copy
        </button>
        <button
          onClick={() => {
            if (clip.pinned) { unpinClip(clip.id); } else { pinClip(clip.id); }
          }}
          className="ui-btn-secondary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
        >
          <Pin className="size-3.5" />
          {clip.pinned ? "Unpin" : "Pin"}
        </button>
        <button
          onClick={() => {
            deleteClip(clip.id);
            selectClip(null);
          }}
          className="ui-btn-danger flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
        >
          <Trash2 className="size-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}
