import { useState } from "react";
import { Plus, Trash2, Edit3, Save, X, Scissors } from "lucide-react";
import type { Snippet } from "@clipm/contracts";
import { useClipboardStore } from "../../apps/web/src/store.ts";

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
      <div className="ui-card-selected rounded-lg border p-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="ui-input w-full rounded px-2 py-1 text-sm"
          placeholder="Title"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="ui-input w-full rounded px-2 py-1 text-sm font-mono"
          placeholder="Snippet content..."
        />
        <input
          value={shortcut}
          onChange={(e) => setShortcut(e.target.value)}
          className="ui-input w-full rounded px-2 py-1 text-sm"
          placeholder="Shortcut (optional)"
        />
        <div className="flex gap-2">
          <button onClick={handleSave} className="ui-btn-primary flex items-center gap-1 rounded px-2 py-1 text-xs">
            <Save className="size-3" /> Save
          </button>
          <button onClick={handleCancel} className="ui-btn-secondary flex items-center gap-1 rounded px-2 py-1 text-xs">
            <X className="size-3" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-card group rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="ui-text-primary text-sm font-medium">{snippet.title}</h3>
            {snippet.shortcut && (
              <kbd className="ui-chip rounded px-1.5 py-0.5 text-xs font-mono">
                {snippet.shortcut}
              </kbd>
            )}
          </div>
          <p className="ui-text-muted mt-1 line-clamp-2 text-xs font-mono">
            {snippet.content}
          </p>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => navigator.clipboard.writeText(snippet.content)}
            className="ui-icon-button rounded p-1"
            title="Copy"
          >
            <Scissors className="size-3.5" />
          </button>
          <button
            onClick={() => setEditing(true)}
            className="ui-icon-button rounded p-1"
            title="Edit"
          >
            <Edit3 className="size-3.5" />
          </button>
          <button
            onClick={() => deleteSnippet(snippet.id)}
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
      <div className="ui-divider flex items-center justify-between border-b px-4 py-3">
        <h2 className="ui-text-primary text-sm font-semibold">Snippets</h2>
        <button
          onClick={() => setCreating(!creating)}
          className="ui-btn-primary flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium"
        >
          <Plus className="size-3" /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {creating && (
          <div className="ui-card-selected rounded-lg border p-3 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="ui-input w-full rounded px-2 py-1 text-sm"
              placeholder="Title"
              autoFocus
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="ui-input w-full rounded px-2 py-1 text-sm font-mono"
              placeholder="Snippet content... Use {{date}}, {{time}}, {{clipboard}} for variables"
            />
            <input
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              className="ui-input w-full rounded px-2 py-1 text-sm"
              placeholder="Shortcut (optional)"
            />
            <div className="flex gap-2">
              <button onClick={handleCreate} className="ui-btn-primary flex items-center gap-1 rounded px-2 py-1 text-xs">
                <Save className="size-3" /> Create
              </button>
              <button onClick={() => setCreating(false)} className="ui-btn-secondary flex items-center gap-1 rounded px-2 py-1 text-xs">
                <X className="size-3" /> Cancel
              </button>
            </div>
          </div>
        )}

        {snippets.length === 0 && !creating && (
          <p className="ui-empty py-8 text-center text-sm">
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
