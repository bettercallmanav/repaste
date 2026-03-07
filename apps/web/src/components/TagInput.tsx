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
      <h3 className="text-xs font-medium text-zinc-500">Tags</h3>
      <div className="mt-1 flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-700 pl-2.5 pr-1 py-1 text-xs text-zinc-300"
          >
            <Tag className="size-2.5" />
            {tag}
            <button
              onClick={() => untagClip(clipId, tag)}
              className="rounded-full p-0.5 hover:bg-zinc-600"
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
              className="w-24 rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="tag..."
              autoFocus
            />
            {input.length > 0 && suggestions.length > 0 && (
              <div className="absolute top-full left-0 z-10 mt-1 max-h-32 overflow-y-auto rounded bg-zinc-700 shadow-lg">
                {suggestions.slice(0, 5).map((s) => (
                  <button
                    key={s}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      tagClip(clipId, s);
                      setInput("");
                      setAdding(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-600"
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
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-600 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
          >
            <Plus className="size-2.5" />
            Add
          </button>
        )}
      </div>
    </div>
  );
}
