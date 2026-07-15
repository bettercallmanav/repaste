import type * as React from "react";
import { Copy, Pin, Trash2 } from "lucide-react";
import type { Clip } from "@clipm/contracts";
import { useClipboardStore } from "../store.ts";
import { getClipSearchMatchMeta, getSearchSnippet, HighlightText } from "./SearchHighlight.tsx";

const RAIL_STYLES: Record<string, string> = {
  url: "bg-blue-400/15 text-blue-400",
  code: "bg-green-400/15 text-green-400",
  email: "bg-yellow-400/15 text-yellow-400",
  json: "bg-orange-400/15 text-orange-400",
  phone: "bg-purple-400/15 text-purple-400",
  filePath: "bg-cyan-400/15 text-cyan-400",
  image: "bg-rose-400/15 text-rose-400",
  richText: "bg-emerald-400/15 text-emerald-400",
};

const RAIL_GLYPHS: Record<string, string> = {
  url: "↗",
  code: "{}",
  email: "@",
  json: "{}",
  phone: "☎",
  filePath: "/",
  image: "▦",
  richText: "R",
  text: "T",
};

const MONO_TYPES = new Set(["url", "code", "email", "color", "json", "phone", "filePath"]);

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

function truncateLabel(text: string, maxLen = 26): string {
  const oneLine = text.split("\n")[0] ?? "";
  return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + "…" : oneLine;
}

function getImageDisplaySrc(clip: Clip): string | null {
  if (clip.imageDataUrl) return clip.imageDataUrl;
  if (clip.imageAssetPath) return encodeURI(`file://${clip.imageAssetPath}`);
  return null;
}

function OcrChip({ clip }: { clip: Clip }) {
  if (clip.contentType !== "image") return null;
  if (clip.ocrStatus === "ready") return <span className="ui-ocr-chip ui-mono">Text in image</span>;
  if (clip.ocrStatus === "pending") {
    return <span className="ui-ocr-chip ui-ocr-chip-muted ui-mono">Reading text…</span>;
  }
  if (clip.ocrStatus === "skipped") {
    return <span className="ui-ocr-chip ui-ocr-chip-muted ui-mono">No text found</span>;
  }
  if (clip.ocrStatus === "failed") {
    return <span className="ui-ocr-chip ui-ocr-chip-failed ui-mono">OCR failed</span>;
  }
  return null;
}

interface ClipRowProps {
  clip: Clip;
  active: boolean;
  expanded: boolean;
  multiSelected: boolean;
  selectionMode: boolean;
  onActivate: () => void;
}

export function ClipRow({ clip, active, expanded, multiSelected, selectionMode, onActivate }: ClipRowProps) {
  const {
    copyClip,
    selectClip,
    pinClip,
    unpinClip,
    deleteClip,
    pasteClip,
    retryOcr,
    toggleClipSelection,
    searchResolvedQuery,
    showToast,
  } = useClipboardStore();

  const imageDisplaySrc = clip.contentType === "image" ? getImageDisplaySrc(clip) : null;
  const matchMeta = getClipSearchMatchMeta(clip, searchResolvedQuery);
  const hasQuery = searchResolvedQuery.trim().length > 0;
  const contentPreview = hasQuery
    ? getSearchSnippet(clip.content, searchResolvedQuery, 120)
    : truncate(clip.content.split("\n")[0] ?? "", 120);

  const railStyle = RAIL_STYLES[clip.contentType] ?? "ui-badge";
  const glyph = RAIL_GLYPHS[clip.contentType] ?? "T";

  const rowClass = active ? "ui-row ui-row-active" : multiSelected ? "ui-row ui-row-multi" : "ui-row";

  function handleRowClick(event: React.MouseEvent) {
    if (event.metaKey || event.ctrlKey) {
      toggleClipSelection(clip.id);
      return;
    }
    onActivate();
  }

  return (
    <>
      <div
        className={`${rowClass} flex items-center gap-2.5 px-3.5 py-2`}
        onClick={handleRowClick}
        onDoubleClick={() => {
          void pasteClip(clip.id);
          showToast(`Copied “${truncateLabel(clip.preview)}” ✓`);
        }}
      >
        {selectionMode && (
          <input
            type="checkbox"
            checked={multiSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleClipSelection(clip.id)}
            className="shrink-0 accent-blue-500"
            aria-label="Select for merge"
          />
        )}

        {/* Rail: real thumbnail for images, type glyph otherwise */}
        {clip.contentType === "image" && imageDisplaySrc ? (
          <img src={imageDisplaySrc} alt="" className="ui-rail-thumb" />
        ) : clip.contentType === "color" ? (
          <div
            className="ui-rail ui-divider border"
            style={{ backgroundColor: clip.content.trim() }}
          />
        ) : (
          <div className={`ui-rail ui-mono text-[11.5px] ${railStyle}`}>{glyph}</div>
        )}

        <div className="min-w-0 flex-1">
          <div
            className={`ui-text-primary overflow-hidden text-ellipsis whitespace-nowrap text-[13px] ${
              MONO_TYPES.has(clip.contentType) ? "ui-mono text-xs" : ""
            }`}
          >
            <HighlightText text={contentPreview} query={searchResolvedQuery} />
          </div>
          <div className="ui-text-muted mt-px flex items-center gap-2 text-[10.5px]">
            {clip.pinned && <span className="text-amber-400">● pinned</span>}
            <span>
              {clip.contentType === "image" && clip.imageWidth && clip.imageHeight
                ? `${clip.imageWidth}×${clip.imageHeight}`
                : clip.metadata.language ?? clip.contentType}
            </span>
            <OcrChip clip={clip} />
            {matchMeta.ocrOnlyMatch && matchMeta.ocrSnippet && (
              <span className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "var(--primary-color)" }}>
                in image: “<HighlightText text={truncate(matchMeta.ocrSnippet, 40)} query={searchResolvedQuery} />”
              </span>
            )}
            {clip.pasteCount > 0 && <span>&times;{clip.pasteCount}</span>}
          </div>
        </div>

        <span className={`ui-mono shrink-0 text-[10.5px] ${active ? "" : "ui-text-muted"}`}
          style={active ? { color: "var(--primary-color)" } : undefined}>
          {formatRelativeTime(clip.capturedAt)}
        </span>
      </div>

      {expanded && (
        <div className="px-3.5 pb-2.5 pl-[51px]">
          {clip.contentType === "image" && imageDisplaySrc && (
            <img
              src={imageDisplaySrc}
              alt="Image preview"
              className="ui-image-frame mb-2 block h-11 rounded-[7px] border object-cover"
            />
          )}
          <p className="ui-text-muted mb-2 break-all text-[11px]">
            {clip.sourceApp ? `from ${clip.sourceApp}` : truncate(clip.content, 160)}
            {clip.tags.length > 0 && ` · ${clip.tags.join(", ")}`}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              className="ui-act ui-act-go ui-mono"
              onClick={() => {
                void pasteClip(clip.id);
                showToast(`Copied “${truncateLabel(clip.preview)}” ✓`);
              }}
            >
              &#9166; Copy
            </button>
            <button
              className="ui-act ui-mono"
              onClick={() => {
                void copyClip(clip.id);
                showToast("Copied ✓");
              }}
            >
              <Copy className="mr-1 inline size-3" />
              Copy only
            </button>
            <button
              className="ui-act ui-mono"
              onClick={() => (clip.pinned ? unpinClip(clip.id) : pinClip(clip.id))}
            >
              <Pin className="mr-1 inline size-3" />
              {clip.pinned ? "Unpin" : "Pin"}
            </button>
            {clip.contentType === "image"
              && (clip.ocrStatus === "failed" || clip.ocrStatus === "skipped" || clip.ocrStatus === null) && (
              <button className="ui-act ui-mono" onClick={() => { void retryOcr(clip.id); }}>
                Retry OCR
              </button>
            )}
            <button className="ui-act ui-mono" onClick={() => selectClip(clip.id)}>
              Details &rarr;
            </button>
            <button
              className="ui-act ui-act-warn ui-mono"
              onClick={() => { void deleteClip(clip.id); }}
            >
              <Trash2 className="mr-1 inline size-3" />
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}
