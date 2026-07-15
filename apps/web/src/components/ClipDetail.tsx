import { useEffect } from "react";
import { Copy, Download, FolderOpen, Pin, RefreshCw, Trash2 } from "lucide-react";
import type { Clip } from "@clipm/contracts";
import { useClipboardStore } from "../store.ts";
import { TagInput } from "./TagInput.tsx";
import { getClipSearchMatchMeta, HighlightText } from "./SearchHighlight.tsx";

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ui-text-muted ui-mono text-[9px] font-semibold uppercase tracking-[0.14em]">{label}</dt>
      <dd className="ui-text-secondary mt-0.5 text-[12.5px]">{value}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="ui-text-muted ui-mono ui-section-rule mb-2 text-[9.5px] font-semibold uppercase tracking-[0.18em]">
      {children}
    </h3>
  );
}

function getImageDisplaySrc(clip: Clip): string | null {
  if (clip.imageDataUrl) return clip.imageDataUrl;
  if (clip.imageAssetPath) return encodeURI(`file://${clip.imageAssetPath}`);
  return null;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ClipDetail() {
  const { clips, selectedClipId, copyClip, selectClip, pinClip, unpinClip, deleteClip, saveImageAs, revealImageInFinder, retryOcr, searchResolvedQuery, showToast } =
    useClipboardStore();

  const clip = clips.find((c: Clip) => c.id === selectedClipId);

  // Esc returns to the list.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        selectClip(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectClip]);

  if (!clip) return null;
  const imageDisplaySrc = clip.contentType === "image" ? getImageDisplaySrc(clip) : null;
  const matchMeta = getClipSearchMatchMeta(clip, searchResolvedQuery);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="ui-divider flex items-center gap-2.5 border-b px-3.5 py-2.5">
        <button onClick={() => selectClip(null)} className="ui-act ui-mono">
          &larr; ESC
        </button>
        <span className="ui-text-muted ui-mono text-[11px] uppercase tracking-[0.14em]">
          {clip.contentType} · {formatRelativeTime(clip.capturedAt)}
          {clip.sourceApp ? ` · from ${clip.sourceApp}` : ""}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 overflow-y-auto p-3.5">
        {clip.contentType === "image" && imageDisplaySrc ? (
          <div className="space-y-3">
            <img
              src={imageDisplaySrc}
              alt="Clipboard image"
              className="ui-image-frame block max-w-full rounded-lg border bg-white"
            />
            {matchMeta.ocrOnlyMatch && (
              <div className="ui-search-note rounded-lg px-3 py-2 text-xs">
                Matched via the text inside this image.
              </div>
            )}
          </div>
        ) : (
          <pre className="ui-pre ui-mono whitespace-pre-wrap break-all rounded-lg p-3 text-xs leading-relaxed">
            <HighlightText text={clip.content} query={searchResolvedQuery} />
          </pre>
        )}

        {clip.ocrText && clip.ocrText.length > 0 && (
          <div>
            <SectionTitle>Text in this image</SectionTitle>
            <pre className="ui-pre ui-mono whitespace-pre-wrap break-all rounded-lg p-3 text-xs leading-relaxed">
              <HighlightText text={clip.ocrText} query={searchResolvedQuery} />
            </pre>
          </div>
        )}

        <div>
          <SectionTitle>Details</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <DetailField label="Type" value={clip.contentType} />
            <DetailField label="Captured" value={new Date(clip.capturedAt).toLocaleString()} />
            <DetailField label="Pasted" value={`${clip.pasteCount} times`} />
            <DetailField label="Pinned" value={clip.pinned ? "Yes" : "No"} />
            {clip.sourceApp && <DetailField label="Source" value={clip.sourceApp} />}
            {(clip.imageWidth && clip.imageHeight) && (
              <DetailField label="Size" value={`${clip.imageWidth}×${clip.imageHeight}`} />
            )}
            {clip.imageMimeType && <DetailField label="Format" value={clip.imageMimeType} />}
            {clip.ocrStatus && <DetailField label="Text in image" value={clip.ocrStatus} />}
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
        </div>

        <div>
          <SectionTitle>Tags</SectionTitle>
          <TagInput clipId={clip.id} tags={clip.tags} />
        </div>
      </div>

      {/* Actions */}
      <div className="ui-divider ui-panel flex flex-wrap gap-1.5 border-t p-3">
        <button
          onClick={() => {
            void copyClip(clip.id);
            showToast("Copied ✓");
          }}
          className="ui-act ui-act-go ui-mono"
        >
          <Copy className="mr-1 inline size-3" />
          Copy
        </button>
        {clip.contentType === "image" && clip.imageAssetPath && (
          <>
            <button onClick={() => { void saveImageAs(clip.id); }} className="ui-act ui-mono">
              <Download className="mr-1 inline size-3" />
              Save as…
            </button>
            <button onClick={() => { void revealImageInFinder(clip.id); }} className="ui-act ui-mono">
              <FolderOpen className="mr-1 inline size-3" />
              Reveal
            </button>
            {(clip.ocrStatus === "failed" || clip.ocrStatus === "skipped" || clip.ocrStatus === null) && (
              <button onClick={() => { void retryOcr(clip.id); }} className="ui-act ui-mono">
                <RefreshCw className="mr-1 inline size-3" />
                Retry OCR
              </button>
            )}
          </>
        )}
        <button
          onClick={() => (clip.pinned ? unpinClip(clip.id) : pinClip(clip.id))}
          className="ui-act ui-mono"
        >
          <Pin className="mr-1 inline size-3" />
          {clip.pinned ? "Unpin" : "Pin"}
        </button>
        <button
          onClick={() => {
            void deleteClip(clip.id);
            selectClip(null);
          }}
          className="ui-act ui-act-warn ui-mono"
        >
          <Trash2 className="mr-1 inline size-3" />
          Delete
        </button>
      </div>
    </div>
  );
}
