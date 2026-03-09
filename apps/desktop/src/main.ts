import { app, clipboard, ipcMain, shell, Menu, nativeImage, nativeTheme } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { Effect, Layer } from "effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { WS_CHANNELS } from "@clipm/contracts";
import type { ClipboardCommand, ClipboardReadModel } from "@clipm/contracts";
import { IPC_CHANNELS } from "@clipm/contracts/ipc";
import type { AppearanceTheme } from "@clipm/contracts/ipc";
import { makeServerProgram, makeRuntimeLayer } from "@clipm/server/main";

import { WindowManager } from "./windowManager.ts";
import { TrayManager } from "./trayManager.ts";
import { ShortcutManager } from "./shortcutManager.ts";
import { ClipboardMonitor } from "./clipboardMonitor.ts";

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRELOAD_PATH = path.join(__dirname, "preload.cjs");

// In dev mode, the web app runs on Vite dev server
// In prod (packaged), it's in Resources/web via extraResources
const WEB_DIST_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "web")
  : path.resolve(__dirname, "../../web/dist");

// Build resources (icons, tray images)
// In packaged app: process.resourcesPath points to Resources/
// In dev: relative to dist-electron/
const BUILD_RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "build")
  : path.resolve(__dirname, "../build");

// ─── Config ───────────────────────────────────────────────────────────────────

const SERVER_PORT = 3847;
const SERVER_HOST = "127.0.0.1";
const AUTH_TOKEN = crypto.randomUUID();
const STATE_DIR = path.join(app.getPath("userData"), "data");
const APPEARANCE_PATH = path.join(app.getPath("userData"), "appearance.json");
const WS_URL = `ws://${SERVER_HOST}:${SERVER_PORT}?token=${AUTH_TOKEN}`;

// ─── Globals ──────────────────────────────────────────────────────────────────

const windowManager = new WindowManager();
const trayManager = new TrayManager();
const shortcutManager = new ShortcutManager();
const clipboardMonitor = new ClipboardMonitor();

let serverWs: WebSocket | null = null;
let isQuitting = false;
let nextServerRequestId = 1;
let themePreference: AppearanceTheme = "system";

const pendingServerRequests = new Map<
  string,
  {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();

const SERVER_REQUEST_TIMEOUT_MS = 5_000;

function normalizeThemePreference(value: unknown): AppearanceTheme {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

function loadThemePreference(): AppearanceTheme {
  try {
    const raw = readFileSync(APPEARANCE_PATH, "utf8");
    const parsed = JSON.parse(raw) as { theme?: unknown };
    return normalizeThemePreference(parsed.theme);
  } catch {
    return "system";
  }
}

function saveThemePreference(theme: AppearanceTheme): void {
  writeFileSync(APPEARANCE_PATH, JSON.stringify({ theme }), "utf8");
}

function resolveThemeMode(theme: AppearanceTheme): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function getWindowBackgroundColor(theme: AppearanceTheme): string {
  return resolveThemeMode(theme) === "dark" ? "#09090b" : "#f3f4f6";
}

function syncWindowBackground(theme: AppearanceTheme): void {
  const mainWindow = windowManager.getWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(getWindowBackgroundColor(theme));
  }
}

function applyThemePreference(theme: AppearanceTheme): AppearanceTheme {
  const normalized = normalizeThemePreference(theme);
  themePreference = normalized;
  nativeTheme.themeSource = normalized;
  syncWindowBackground(normalized);
  return normalized;
}

// ─── In-process Server ──────────────────────────────────────────────────────

/**
 * Starts the Effect-TS server in-process (no subprocess).
 * The server runs as a long-lived Effect fiber in the Electron main process.
 * This avoids the need for ELECTRON_RUN_AS_NODE and simplifies native module handling.
 */
function startServer(): void {
  // Ensure state directory exists for SQLite database
  mkdirSync(STATE_DIR, { recursive: true });

  const RuntimeLayer = Layer.empty.pipe(
    Layer.provideMerge(
      makeRuntimeLayer({
        port: SERVER_PORT,
        host: SERVER_HOST,
        stateDir: STATE_DIR,
        authToken: AUTH_TOKEN,
      }),
    ),
    Layer.provideMerge(NodeServices.layer),
  );

  // Run the server as a background Promise — it never resolves (blocked on stopSignal)
  makeServerProgram.pipe(
    Effect.provide(RuntimeLayer),
    Effect.scoped,
    Effect.runPromise,
  ).catch((err) => {
    console.error("[server] Fatal error:", err);
  });
}

/**
 * Polls the server port via WebSocket until it accepts a connection.
 * Resolves once the server is ready to accept clients.
 */
function waitForServer(maxRetries = 50, intervalMs = 200): Promise<void> {
  return new Promise((resolve) => {
    let attempt = 0;
    function tryConnect() {
      if (attempt >= maxRetries) {
        console.error("[waitForServer] Server did not start in time, showing window anyway");
        resolve();
        return;
      }
      attempt++;
      const ws = new WebSocket(WS_URL);
      ws.on("open", () => {
        ws.close();
        resolve();
      });
      ws.on("error", () => {
        setTimeout(tryConnect, intervalMs);
      });
    }
    tryConnect();
  });
}

// ─── WebSocket to server ─────────────────────────────────────────────────────

function connectToServer(): void {
  if (serverWs) return;

  serverWs = new WebSocket(WS_URL);

  serverWs.on("open", () => {
    console.log("Connected to server via WebSocket");
    // Start clipboard monitoring once connected
    clipboardMonitor.start(dispatchCommand);
    refreshTrayRecentClips();
  });

  serverWs.on("message", (raw) => {
    handleServerMessage(raw);
  });

  serverWs.on("close", () => {
    serverWs = null;
    clipboardMonitor.stop();
    clearPendingServerRequests("Server connection closed");
    if (!isQuitting) {
      setTimeout(connectToServer, 1000);
    }
  });

  serverWs.on("error", () => {
    clearPendingServerRequests("Server connection error");
  });
}

function dispatchCommand(command: ClipboardCommand): void {
  if (!serverWs || serverWs.readyState !== WebSocket.OPEN) return;

  const message = {
    id: String(Date.now()),
    body: {
      _tag: "clipboard.dispatchCommand",
      command,
    },
  };

  serverWs.send(JSON.stringify(message));
}

function clearPendingServerRequests(message: string): void {
  for (const pending of pendingServerRequests.values()) {
    clearTimeout(pending.timeout);
    pending.reject(new Error(message));
  }
  pendingServerRequests.clear();
}

function sendServerRequest<T>(body: { _tag: string; [key: string]: unknown }): Promise<T> {
  if (!serverWs || serverWs.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("Server is not connected"));
  }

  const id = `desktop-${nextServerRequestId++}`;

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingServerRequests.delete(id);
      reject(new Error(`Server request timed out: ${body._tag}`));
    }, SERVER_REQUEST_TIMEOUT_MS);

    pendingServerRequests.set(id, {
      resolve: resolve as (result: unknown) => void,
      reject,
      timeout,
    });

    serverWs!.send(JSON.stringify({ id, body }));
  });
}

function handleServerMessage(raw: WebSocket.RawData): void {
  const text = (() => {
    if (typeof raw === "string") return raw;
    if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString("utf8");
    if (Array.isArray(raw)) return Buffer.concat(raw).toString("utf8");
    return Buffer.from(raw).toString("utf8");
  })();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return;
  }

  if (typeof parsed !== "object" || parsed === null) return;

  if ("channel" in parsed && parsed.channel === WS_CHANNELS.domainEvent) {
    refreshTrayRecentClips();
    return;
  }

  if (!("id" in parsed) || typeof parsed.id !== "string") return;

  const pending = pendingServerRequests.get(parsed.id);
  if (!pending) return;

  clearTimeout(pending.timeout);
  pendingServerRequests.delete(parsed.id);

  if ("error" in parsed && parsed.error && typeof parsed.error === "object") {
    const error = parsed.error as { message?: string };
    pending.reject(new Error(error.message ?? "Unknown server error"));
    return;
  }

  pending.resolve("result" in parsed ? parsed.result : undefined);
}

function refreshTrayRecentClips(): void {
  const mainWindow = windowManager.getWindow();
  if (!mainWindow) return;

  void sendServerRequest<ClipboardReadModel>({
    _tag: "clipboard.getSnapshot",
  })
    .then((snapshot) => {
      trayManager.updateRecentClips(
        snapshot.clips.map((clip) => ({ id: clip.id, preview: clip.preview })),
        mainWindow,
      );
    })
    .catch((error) => {
      if (!isQuitting) {
        console.error("[tray] Failed to refresh recent clips:", error);
      }
    });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.writeClipboard, (_event, text: unknown) => {
    if (typeof text !== "string") return;
    clipboard.writeText(text);
  });

  ipcMain.handle(IPC_CHANNELS.writeImageDataUrl, (_event, dataUrl: unknown) => {
    if (typeof dataUrl !== "string") return false;
    try {
      const image = nativeImage.createFromDataURL(dataUrl);
      if (image.isEmpty()) return false;
      clipboard.writeImage(image);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.readClipboard, () => {
    return clipboard.readText();
  });

  ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, url: unknown) => {
    if (typeof url !== "string") return false;
    // Only allow http/https URLs
    if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.getThemePreference, () => themePreference);

  ipcMain.handle(IPC_CHANNELS.setThemePreference, (_event, theme: unknown) => {
    const nextTheme = applyThemePreference(normalizeThemePreference(theme));
    saveThemePreference(nextTheme);
    return nextTheme;
  });

  ipcMain.handle(IPC_CHANNELS.contextMenu, (_event, items: unknown) => {
    if (!Array.isArray(items)) return null;

    const mainWindow = windowManager.getWindow();
    if (!mainWindow) return null;

    return new Promise<string | null>((resolve) => {
      const menuItems: Electron.MenuItemConstructorOptions[] = items
        .filter(
          (item): item is { id: string; label: string; destructive?: boolean } =>
            typeof item === "object" && item !== null && typeof item.id === "string" && typeof item.label === "string",
        )
        .map((item) => ({
          label: item.label,
          click: () => resolve(item.id),
        }));

      if (menuItems.length === 0) {
        resolve(null);
        return;
      }

      const menu = Menu.buildFromTemplate(menuItems);
      menu.popup({
        window: mainWindow,
        callback: () => resolve(null),
      });
    });
  });
}

// ─── App Menu ─────────────────────────────────────────────────────────────────

function createAppMenu(): void {
  const isMac = process.platform === "darwin";

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

// Enforce single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const mainWindow = windowManager.getWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    themePreference = applyThemePreference(loadThemePreference());
    nativeTheme.on("updated", () => {
      if (themePreference === "system") {
        syncWindowBackground(themePreference);
      }
    });

    // Enable start at login so the app survives reboots
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
    }

    // Set WebSocket URL env for the preload script
    process.env.CLIPM_DESKTOP_WS_URL = WS_URL;

    // Start server FIRST, then wait for it to be ready
    startServer();
    await waitForServer();

    // Create window only after server is accepting connections
    const mainWindow = windowManager.create({
      preloadPath: PRELOAD_PATH,
      webDistPath: WEB_DIST_PATH,
      backgroundColor: getWindowBackgroundColor(themePreference),
    });

    // Setup tray, shortcuts, menu
    trayManager.create(mainWindow, BUILD_RESOURCES_PATH);
    shortcutManager.register(mainWindow);
    createAppMenu();
    registerIpcHandlers();

    // Connect main-process WebSocket (for clipboard monitor dispatch)
    connectToServer();

    // Show window once HTML is loaded (server is already ready)
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
    });
  });

  app.on("before-quit", () => {
    isQuitting = true;
    windowManager.prepareForQuit();
    trayManager.destroy();
  });

  app.on("will-quit", () => {
    isQuitting = true;
    clipboardMonitor.stop();
    shortcutManager.unregister();
    trayManager.destroy();
    windowManager.destroy();
    if (serverWs) {
      serverWs.close();
      serverWs = null;
    }
  });

  // macOS: re-show window when dock icon clicked
  app.on("activate", () => {
    const mainWindow = windowManager.getWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Prevent full quit on all-windows-closed (tray app)
  app.on("window-all-closed", () => {
    // Don't quit — the app lives in the tray
  });
}
