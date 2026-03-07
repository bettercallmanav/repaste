// ─── Desktop Bridge (Electron preload → renderer) ───────────────────────────

export interface ClipboardDesktopBridge {
  /** WebSocket URL to connect to the backend server */
  readonly getWsUrl: () => string | null;

  /** Write text content to the system clipboard */
  readonly writeClipboard: (text: string) => Promise<void>;

  /** Read current text from the system clipboard */
  readonly readClipboard: () => Promise<string>;

  /** Show a native context menu, returns selected item ID or null */
  readonly showContextMenu: (
    items: readonly ContextMenuItem[],
  ) => Promise<string | null>;

  /** Open a URL in the default browser */
  readonly openExternal: (url: string) => Promise<boolean>;

  /** Subscribe to menu bar actions */
  readonly onMenuAction: (listener: (action: string) => void) => () => void;

  /** Subscribe to global shortcut activations */
  readonly onGlobalShortcut: (listener: (shortcut: string) => void) => () => void;
}

export interface ContextMenuItem {
  readonly id: string;
  readonly label: string;
  readonly destructive?: boolean | undefined;
}

// ─── IPC Channels ────────────────────────────────────────────────────────────

export const IPC_CHANNELS = {
  writeClipboard: "clipboard:write",
  readClipboard: "clipboard:read",
  contextMenu: "desktop:context-menu",
  openExternal: "desktop:open-external",
  menuAction: "desktop:menu-action",
  globalShortcut: "desktop:global-shortcut",
} as const;
