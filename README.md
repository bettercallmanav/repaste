# Repaste

Repaste is a local-first clipboard manager built with Electron, React, Bun, and an Effect-based backend. It stores clipboard history on your machine, supports both text and image clips, and adds fast search, tags, snippets, tray access, and macOS OCR for image text.

## Features

- Local-first clipboard history stored on-device
- Text and image clip capture
- macOS Vision OCR for image clips
- Full-text clip search with filters
- Search query syntax such as `type:image`, `tag:design`, `app:Chrome`, `from:2026-03-01`
- Pinning, tagging, merging, and deleting clips
- Snippet management
- Tray integration and global window workflow
- Light, dark, and system appearance modes

## Current Platform Status

- macOS: primary supported desktop target
- Windows/Linux: codebase is structured for future packaging, but OCR is currently macOS-only

## Install

For end users, the intended distribution is a packaged desktop build from GitHub releases.

On macOS, the desktop packaging config currently targets:

- `dmg`
- `zip`

If a release asset is attached to the repository, download the latest macOS package and move `Repaste.app` to `/Applications`.

## Search

Repaste supports both free-text search and structured filters.

Examples:

```text
design system
type:image receipt
tag:design
app:Chrome
pinned:true
from:2026-03-01 to:2026-03-10 invoice
```

Supported query prefixes:

- `type:`
- `tag:`
- `app:`
- `pinned:`
- `from:`
- `to:`

## OCR

Repaste uses Apple Vision on macOS to extract text from captured image clips.

- OCR runs asynchronously after image capture
- OCR text becomes searchable
- OCR status is tracked per clip
- Existing architecture leaves room for a future cross-platform OCR provider

## Development

### Requirements

- Bun `1.3.9`
- macOS for the current OCR/build flow

### Install dependencies

```bash
bun install
```

### Run workspace tasks

```bash
bun run dev
bun run build
bun run typecheck
```

### Run individual apps

```bash
bun run dev:web
bun run dev:server
bun run dev:desktop
```

## Package The Desktop App

Desktop packaging lives under [`/Users/manav/Desktop/clipboard-manager/apps/desktop`](./apps/desktop).

Build and package for macOS:

```bash
cd apps/desktop
bun run pack:mac
```

That produces release output under:

- `apps/desktop/release/`

## Project Structure

```text
apps/
  desktop/   Electron shell, clipboard monitor, tray, native OCR bridge
  server/    Effect-based backend, event store, projections, SQLite search
  web/       React renderer UI
packages/
  contracts/ shared schemas and IPC/websocket contracts
  shared/    shared utilities
```

## Architecture

Repaste runs as a desktop app with three main layers:

1. Electron desktop shell
2. Embedded local backend server
3. React renderer UI

Clipboard events are captured on the desktop side, processed through an event-sourced backend, projected into SQLite, and rendered in the UI through snapshot and event updates.

## Notes

- Image clips now use asset metadata and file-backed storage rather than only large inline payloads
- OCR is implemented for macOS through a Vision helper
- Search supports both full-text matching and structured filters
- The repository is a Bun workspace / Turbo monorepo

## License

See [`LICENSE`](/Users/manav/Desktop/clipboard-manager/LICENSE).
