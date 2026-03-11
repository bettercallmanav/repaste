// ─── Desktop Bridge (Electron preload → renderer) ───────────────────────────

export type AppearanceTheme = "system" | "light" | "dark";

export interface ClipboardDesktopBridge {
  /** WebSocket URL to connect to the backend server */
  readonly getWsUrl: () => string | null;

  /** Write text content to the system clipboard */
  readonly writeClipboard: (text: string) => Promise<void>;

  /** Write image content to the system clipboard from a data URL */
  readonly writeImageDataUrl: (dataUrl: string) => Promise<boolean>;

  /** Write image content to the system clipboard from a saved file path */
  readonly writeImageFile: (path: string) => Promise<boolean>;

  /** Read current text from the system clipboard */
  readonly readClipboard: () => Promise<string>;

  /** Show a native context menu, returns selected item ID or null */
  readonly showContextMenu: (
    items: readonly ContextMenuItem[],
  ) => Promise<string | null>;

  /** Open a URL in the default browser */
  readonly openExternal: (url: string) => Promise<boolean>;

  /** Read the persisted desktop appearance preference */
  readonly getThemePreference: () => Promise<AppearanceTheme>;

  /** Persist and apply the desktop appearance preference */
  readonly setThemePreference: (theme: AppearanceTheme) => Promise<AppearanceTheme>;

  /** Subscribe to menu bar actions */
  readonly onMenuAction: (listener: (action: string) => void) => () => void;

  /** Subscribe to global shortcut activations */
  readonly onGlobalShortcut: (listener: (shortcut: string) => void) => () => void;

  /** Subscribe to tray menu clip selections */
  readonly onTrayClipSelected: (listener: (clipId: string) => void) => () => void;

  /** Save an image clip to a user-chosen location */
  readonly saveImageAs: (imageAssetPath: string) => Promise<boolean>;

  /** Reveal an image clip's file in the system file manager */
  readonly revealImageInFinder: (imageAssetPath: string) => Promise<boolean>;

  /** Retry OCR extraction for a specific image clip */
  readonly retryOcr: (clipId: string, imageAssetPath: string) => Promise<boolean>;
}

export interface ContextMenuItem {
  readonly id: string;
  readonly label: string;
  readonly destructive?: boolean | undefined;
}

// ─── IPC Channels ────────────────────────────────────────────────────────────

export const IPC_CHANNELS = {
  writeClipboard: "clipboard:write",
  writeImageDataUrl: "clipboard:write-image-data-url",
  writeImageFile: "clipboard:write-image-file",
  readClipboard: "clipboard:read",
  contextMenu: "desktop:context-menu",
  openExternal: "desktop:open-external",
  getThemePreference: "desktop:get-theme-preference",
  setThemePreference: "desktop:set-theme-preference",
  menuAction: "desktop:menu-action",
  globalShortcut: "desktop:global-shortcut",
  trayClipSelected: "tray:clip-selected",
  saveImageAs: "desktop:save-image-as",
  revealImageInFinder: "desktop:reveal-image-in-finder",
  retryOcr: "desktop:retry-ocr",
} as const;
