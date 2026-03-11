import { Pin, Trash2, Copy, Tag, Image, Eye, Loader2, AlertCircle } from "lucide-react";
import type { Clip } from "@clipm/contracts";
import { useClipboardStore } from "../store.ts";
import { getClipSearchMatchMeta, getSearchSnippet, HighlightText } from "./SearchHighlight.tsx";

const CONTENT_TYPE_COLORS: Record<string, string> = {
  url: "text-blue-400",
  code: "text-green-400",
  email: "text-yellow-400",
  color: "text-pink-400",
  json: "text-orange-400",
  phone: "text-purple-400",
  filePath: "text-cyan-400",
  image: "text-rose-400",
  richText: "text-emerald-400",
  text: "ui-text-muted",
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\u2026";
}

interface ClipCardProps {
  clip: Clip;
  selected: boolean;
  multiSelected: boolean;
}

function getImageDisplaySrc(clip: Clip): string | null {
  if (clip.imageDataUrl) return clip.imageDataUrl;
  if (clip.imageAssetPath) return encodeURI(`file://${clip.imageAssetPath}`);
  return null;
}

export function ClipCard({ clip, selected, multiSelected }: ClipCardProps) {
  const {
    copyClip,
    selectClip,
    pinClip,
    unpinClip,
    deleteClip,
    pasteClip,
    toggleClipSelection,
    searchResolvedQuery,
  } = useClipboardStore();
  const colorClass = CONTENT_TYPE_COLORS[clip.contentType] ?? "ui-text-muted";
  const imageDisplaySrc = clip.contentType === "image" ? getImageDisplaySrc(clip) : null;
  const matchMeta = getClipSearchMatchMeta(clip, searchResolvedQuery);
  const contentPreview = searchResolvedQuery.trim().length > 0
    ? getSearchSnippet(clip.content, searchResolvedQuery, 200)
    : truncate(clip.content, 200);

  return (
    <div
      onClick={() => selectClip(clip.id)}
      onDoubleClick={() => pasteClip(clip.id)}
      className={`group cursor-pointer rounded-lg border p-3 transition-colors ${
        selected
          ? "ui-card-selected"
          : multiSelected
            ? "ui-card-multi"
            : "ui-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {/* Multi-select checkbox */}
          <input
            type="checkbox"
            checked={multiSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleClipSelection(clip.id)}
            className="mt-0.5 shrink-0 accent-blue-500"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs">
              <span className={`font-medium ${colorClass}`}>{clip.contentType}</span>
              <span className="ui-text-muted">{formatRelativeTime(clip.capturedAt)}</span>
              {clip.pinned && <Pin className="size-3 text-amber-400" />}
              {clip.pasteCount > 0 && (
                <span className="ui-text-muted">&times;{clip.pasteCount}</span>
              )}
            </div>

            {/* Image preview or text */}
            {clip.contentType === "image" && imageDisplaySrc ? (
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Image className="size-4 text-rose-400 shrink-0" />
                  <img
                    src={imageDisplaySrc}
                    alt="Clipboard image"
                    className="ui-image-frame max-h-16 max-w-[120px] rounded border object-contain"
                  />
                  {(clip.imageWidth && clip.imageHeight) && (
                    <span className="ui-text-muted text-xs">
                      {clip.imageWidth}x{clip.imageHeight}
                    </span>
                  )}
                  {clip.ocrStatus === "ready" && (
                    <span title="OCR text available"><Eye className="size-3 text-emerald-500" /></span>
                  )}
                  {clip.ocrStatus === "pending" && (
                    <span title="OCR pending"><Loader2 className="size-3 text-amber-400 animate-spin" /></span>
                  )}
                  {clip.ocrStatus === "failed" && (
                    <span title="OCR failed"><AlertCircle className="size-3 text-red-400" /></span>
                  )}
                </div>
                {matchMeta.ocrOnlyMatch && matchMeta.ocrSnippet && (
                  <div className="ui-search-note rounded-md px-2 py-1 text-xs leading-relaxed">
                    <p className="ui-text-muted text-[11px] font-medium uppercase tracking-[0.08em]">
                      Matched in image text
                    </p>
                    <p className="mt-1">
                      <HighlightText text={matchMeta.ocrSnippet} query={searchResolvedQuery} />
                    </p>
                  </div>
                )}
              </div>
            ) : clip.contentType === "color" ? (
              <div className="mt-1 flex items-center gap-2">
                <div
                  className="ui-divider size-4 rounded border"
                  style={{ backgroundColor: clip.content.trim() }}
                />
                <span className="ui-text-primary text-sm font-mono">
                  <HighlightText text={clip.content.trim()} query={searchResolvedQuery} />
                </span>
              </div>
            ) : (
              <p className="ui-text-primary mt-1 break-all text-sm leading-relaxed">
                <HighlightText text={contentPreview} query={searchResolvedQuery} />
              </p>
            )}

            {clip.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {clip.tags.map((tag) => (
                  <span
                    key={tag}
                    className="ui-chip inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                  >
                    <Tag className="size-2.5" />
                    <HighlightText text={tag} query={searchResolvedQuery} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void copyClip(clip.id);
            }}
            className="ui-icon-button rounded p-1"
            title="Copy to clipboard"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (clip.pinned) { unpinClip(clip.id); } else { pinClip(clip.id); }
            }}
            className={`rounded p-1 ${
              clip.pinned ? "text-amber-400 hover:bg-amber-500/10" : "ui-icon-button"
            }`}
            title={clip.pinned ? "Unpin" : "Pin"}
          >
            <Pin className="size-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteClip(clip.id);
            }}
            className="ui-icon-button-danger rounded p-1"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
