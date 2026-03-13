# Snippets Archive

This folder stores the removed snippet feature for future reference.

What was removed from the active app:

- the snippet tab in the web UI
- snippet state and actions from the active Zustand store
- the `SnippetManager` renderer component

What still remains in the main codebase for compatibility:

- snippet schemas in shared contracts
- snippet command/event handling in the backend
- snippet projection support in the read model

That backend code is intentionally dormant for now. It is no longer reachable from the active UI, but it was left in place to avoid a larger persistence and compatibility migration during feature removal.

If snippets are revived later, start from:

- `archive/snippets/SnippetManager.tsx`
- the commit history around the March 2026 snippet implementation
