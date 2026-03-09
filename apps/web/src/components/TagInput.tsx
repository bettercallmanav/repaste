import { useState, useRef } from "react";
import { Plus, X, Tag } from "lucide-react";
import { useClipboardStore } from "../store.ts";

interface TagInputProps {
  clipId: string;
  tags: readonly string[];
}

export function TagInput({ clipId, tags }: TagInputProps) {
  const { tagClip, untagClip, knownTags } = useClipboardStore();
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = knownTags.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase()),
  );

  function handleAdd() {
    const tag = input.trim();
    if (tag.length === 0) return;
    tagClip(clipId, tag);
    setInput("");
    setAdding(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    } else if (e.key === "Escape") {
      setAdding(false);
      setInput("");
    }
  }

  return (
    <div className="mt-4">
      <h3 className="ui-text-muted text-xs font-medium">Tags</h3>
      <div className="mt-1 flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="ui-chip inline-flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1 text-xs"
          >
            <Tag className="size-2.5" />
            {tag}
            <button
              onClick={() => untagClip(clipId, tag)}
              className="ui-chip-action rounded-full p-0.5"
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}

        {adding ? (
          <div className="relative">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => { setTimeout(() => setAdding(false), 150); }}
              className="ui-input w-24 rounded px-2 py-1 text-xs"
              placeholder="tag..."
              autoFocus
            />
            {input.length > 0 && suggestions.length > 0 && (
              <div className="ui-suggestions absolute top-full left-0 z-10 mt-1 max-h-32 overflow-y-auto rounded">
                {suggestions.slice(0, 5).map((s) => (
                  <button
                    key={s}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      tagClip(clipId, s);
                      setInput("");
                      setAdding(false);
                    }}
                    className="ui-suggestion-item block w-full px-3 py-1.5 text-left text-xs"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="ui-add-chip inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-1 text-xs"
          >
            <Plus className="size-2.5" />
            Add
          </button>
        )}
      </div>
    </div>
  );
}
