import { Pin, Trash2, Copy, Tag, Image } from "lucide-react";
import type { Clip } from "@clipm/contracts";
import { useClipboardStore } from "../store.ts";

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
  text: "text-zinc-400",
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

export function ClipCard({ clip, selected, multiSelected }: ClipCardProps) {
  const { selectClip, pinClip, unpinClip, deleteClip, pasteClip, toggleClipSelection } = useClipboardStore();
  const colorClass = CONTENT_TYPE_COLORS[clip.contentType] ?? "text-zinc-400";

  return (
    <div
      onClick={() => selectClip(clip.id)}
      onDoubleClick={() => pasteClip(clip.id)}
      className={`group cursor-pointer rounded-lg border p-3 transition-colors ${
        selected
          ? "border-blue-500 bg-blue-500/10"
          : multiSelected
            ? "border-blue-400/50 bg-blue-500/5"
            : "border-zinc-700/50 bg-zinc-800/50 hover:border-zinc-600"
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
              <span className="text-zinc-500">{formatRelativeTime(clip.capturedAt)}</span>
              {clip.pinned && <Pin className="size-3 text-amber-400" />}
              {clip.pasteCount > 0 && (
                <span className="text-zinc-500">&times;{clip.pasteCount}</span>
              )}
            </div>

            {/* Image preview or text */}
            {clip.contentType === "image" && clip.imageDataUrl ? (
              <div className="mt-1 flex items-center gap-2">
                <Image className="size-4 text-rose-400 shrink-0" />
                <img
                  src={clip.imageDataUrl}
                  alt="Clipboard image"
                  className="max-h-16 max-w-[120px] rounded border border-zinc-700 object-contain"
                />
              </div>
            ) : clip.contentType === "color" ? (
              <div className="mt-1 flex items-center gap-2">
                <div
                  className="size-4 rounded border border-zinc-600"
                  style={{ backgroundColor: clip.content.trim() }}
                />
                <span className="text-sm text-zinc-200 font-mono">{clip.content.trim()}</span>
              </div>
            ) : (
              <p className="mt-1 text-sm text-zinc-200 leading-relaxed break-all">
                {truncate(clip.content, 200)}
              </p>
            )}

            {clip.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {clip.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300"
                  >
                    <Tag className="size-2.5" />
                    {tag}
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
              navigator.clipboard.writeText(clip.content);
            }}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            title="Copy to clipboard"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (clip.pinned) { unpinClip(clip.id); } else { pinClip(clip.id); }
            }}
            className={`rounded p-1 hover:bg-zinc-700 ${
              clip.pinned ? "text-amber-400" : "text-zinc-400 hover:text-zinc-200"
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
            className="rounded p-1 text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
