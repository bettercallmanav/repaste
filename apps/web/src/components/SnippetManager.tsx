import { useState } from "react";
import { Plus, Trash2, Edit3, Save, X, Scissors } from "lucide-react";
import type { Snippet } from "@clipm/contracts";
import { useClipboardStore } from "../store.ts";

function SnippetCard({ snippet }: { snippet: Snippet }) {
  const { updateSnippet, deleteSnippet } = useClipboardStore();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(snippet.title);
  const [content, setContent] = useState(snippet.content);
  const [shortcut, setShortcut] = useState(snippet.shortcut ?? "");

  function handleSave() {
    updateSnippet(snippet.id, {
      title,
      content,
      shortcut: shortcut.length > 0 ? shortcut : null,
    });
    setEditing(false);
  }

  function handleCancel() {
    setTitle(snippet.title);
    setContent(snippet.content);
    setShortcut(snippet.shortcut ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-blue-500/50 bg-zinc-800 p-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Title"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="w-full rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Snippet content..."
        />
        <input
          value={shortcut}
          onChange={(e) => setShortcut(e.target.value)}
          className="w-full rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Shortcut (optional)"
        />
        <div className="flex gap-2">
          <button onClick={handleSave} className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500">
            <Save className="size-3" /> Save
          </button>
          <button onClick={handleCancel} className="flex items-center gap-1 rounded bg-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-500">
            <X className="size-3" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-zinc-200">{snippet.title}</h3>
            {snippet.shortcut && (
              <kbd className="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-400 font-mono">
                {snippet.shortcut}
              </kbd>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-400 font-mono line-clamp-2">
            {snippet.content}
          </p>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => navigator.clipboard.writeText(snippet.content)}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            title="Copy"
          >
            <Scissors className="size-3.5" />
          </button>
          <button
            onClick={() => setEditing(true)}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            title="Edit"
          >
            <Edit3 className="size-3.5" />
          </button>
          <button
            onClick={() => deleteSnippet(snippet.id)}
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

export function SnippetManager() {
  const { snippets, createSnippet } = useClipboardStore();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [shortcut, setShortcut] = useState("");

  function handleCreate() {
    if (title.trim().length === 0 || content.trim().length === 0) return;
    createSnippet(title.trim(), content, shortcut.length > 0 ? shortcut : null);
    setTitle("");
    setContent("");
    setShortcut("");
    setCreating(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">Snippets</h2>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500"
        >
          <Plus className="size-3" /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {creating && (
          <div className="rounded-lg border border-blue-500/50 bg-zinc-800 p-3 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Title"
              autoFocus
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Snippet content... Use {{date}}, {{time}}, {{clipboard}} for variables"
            />
            <input
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              className="w-full rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Shortcut (optional)"
            />
            <div className="flex gap-2">
              <button onClick={handleCreate} className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500">
                <Save className="size-3" /> Create
              </button>
              <button onClick={() => setCreating(false)} className="flex items-center gap-1 rounded bg-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-500">
                <X className="size-3" /> Cancel
              </button>
            </div>
          </div>
        )}

        {snippets.length === 0 && !creating && (
          <p className="py-8 text-center text-sm text-zinc-500">
            No snippets yet. Create one to save frequently used text.
          </p>
        )}

        {snippets.map((snippet) => (
          <SnippetCard key={snippet.id} snippet={snippet} />
        ))}
      </div>
    </div>
  );
}
