import { useEffect, useState } from "react";
import type { Clip } from "@clipm/contracts";
import { useClipboardStore } from "../store.ts";
import { ClipRow } from "./ClipCard.tsx";

function groupLabel(iso: string): string {
  const captured = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  if (captured >= startOfToday) return "Today";
  if (captured >= new Date(startOfToday.getTime() - dayMs)) return "Yesterday";
  if (captured >= new Date(startOfToday.getTime() - 7 * dayMs)) return "This week";
  return "Earlier";
}

function truncateLabel(text: string, maxLen = 26): string {
  const oneLine = text.split("\n")[0] ?? "";
  return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + "…" : oneLine;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.tagName === "TEXTAREA" || (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "checkbox"));
}

function SkeletonRows() {
  return (
    <div className="py-1">
      <div className="ui-mono ui-group-label px-3.5 pb-1 pt-2.5">Today</div>
      {[72, 63, 54, 45, 36].map((width, index) => (
        <div key={index} className="flex items-center gap-2.5 px-3.5 py-2">
          <div className="ui-skel size-[25px] rounded-[7px]" />
          <div className="min-w-0 flex-1">
            <div className="ui-skel h-[11px]" style={{ width: `${width}%` }} />
            <div className="ui-skel mt-1.5 h-2 w-[22%] opacity-60" />
          </div>
          <div className="ui-skel h-2 w-4" />
        </div>
      ))}
    </div>
  );
}

export function ClipList() {
  const {
    clips,
    searchResults,
    selectedClipIds,
    loading,
    searchLoading,
    searchQuery,
    clearSearch,
    pasteClip,
    showToast,
  } = useClipboardStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const displayClips = (searchResults ?? clips).filter((clip: Clip) => !clip.deletedAt);

  // Keyboard: ↑↓ move highlight, → expand, ← collapse, ⏎ copy, Esc clears.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const typing = isTypingTarget(event.target);

      if (event.key === "Escape") {
        if (searchQuery.trim().length > 0) {
          event.preventDefault();
          clearSearch();
        }
        return;
      }
      if (typing && !["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setExpandedId(null);
        setActiveIndex((index) => Math.min(index + 1, displayClips.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setExpandedId(null);
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "ArrowRight" && !typing) {
        event.preventDefault();
        const clip = displayClips[activeIndex];
        if (clip) setExpandedId(clip.id);
      } else if (event.key === "ArrowLeft" && !typing) {
        event.preventDefault();
        setExpandedId(null);
      } else if (event.key === "Enter") {
        const clip = displayClips[activeIndex];
        if (clip) {
          event.preventDefault();
          void pasteClip(clip.id);
          showToast(`Copied “${truncateLabel(clip.preview)}” ✓`);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [displayClips, activeIndex, searchQuery, clearSearch, pasteClip, showToast]);

  // Keep the highlight in range as the list changes.
  useEffect(() => {
    if (activeIndex >= displayClips.length) {
      setActiveIndex(Math.max(0, displayClips.length - 1));
    }
  }, [displayClips.length, activeIndex]);

  if (loading) return <SkeletonRows />;

  if (searchLoading && searchResults === null) {
    return (
      <div className="ui-empty flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm">Searching clips…</p>
      </div>
    );
  }

  if (displayClips.length === 0) {
    const isSearch = searchResults !== null || searchQuery.trim().length > 0;
    return (
      <div className="ui-empty flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="ui-mono text-2xl opacity-40">{isSearch ? "[ ]" : "⌘C"}</div>
        {isSearch ? (
          <>
            <p className="max-w-[34ch] text-[12.5px] leading-relaxed">
              Nothing matches. Clips stay searchable for as long as your history keeps them.
            </p>
            <button className="ui-act ui-mono" onClick={clearSearch}>
              Clear search &amp; filters
            </button>
          </>
        ) : (
          <>
            <p className="max-w-[34ch] text-[12.5px] leading-relaxed">
              <b className="ui-text-primary">Copy anything</b> — it appears here instantly,
              searchable forever, and never leaves this Mac.
            </p>
            <p className="ui-mono text-[11px]">
              Summon Repaste anytime with <kbd className="ui-kbd">⌘⇧V</kbd>
            </p>
          </>
        )}
      </div>
    );
  }

  let lastGroup = "";
  return (
    <div className="flex-1 overflow-y-auto pb-2">
      {displayClips.map((clip: Clip, index: number) => {
        const label = groupLabel(clip.capturedAt);
        const showLabel = label !== lastGroup;
        lastGroup = label;
        return (
          <div key={clip.id}>
            {showLabel && (
              <div className="ui-mono ui-group-label px-3.5 pb-1 pt-2.5">{label}</div>
            )}
            <ClipRow
              clip={clip}
              active={index === activeIndex}
              expanded={clip.id === expandedId}
              multiSelected={selectedClipIds.includes(clip.id)}
              selectionMode={selectedClipIds.length > 0}
              onActivate={() => {
                setActiveIndex(index);
                setExpandedId(expandedId === clip.id ? null : clip.id);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
