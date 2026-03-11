import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "@clipm/contracts/ipc";
import type { AppearanceTheme, ClipboardDesktopBridge, ContextMenuItem } from "@clipm/contracts/ipc";

const bridge: ClipboardDesktopBridge = {
  getWsUrl: () => process.env.CLIPM_DESKTOP_WS_URL ?? null,

  writeClipboard: (text: string) => ipcRenderer.invoke("clipboard:write", text),

  writeImageDataUrl: (dataUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.writeImageDataUrl, dataUrl),

  writeImageFile: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.writeImageFile, path),

  readClipboard: () => ipcRenderer.invoke("clipboard:read"),

  showContextMenu: (items: readonly ContextMenuItem[]) =>
    ipcRenderer.invoke("desktop:context-menu", items),

  openExternal: (url: string) => ipcRenderer.invoke("desktop:open-external", url),

  getThemePreference: () => ipcRenderer.invoke(IPC_CHANNELS.getThemePreference),

  setThemePreference: (theme: AppearanceTheme) => ipcRenderer.invoke(IPC_CHANNELS.setThemePreference, theme),

  onMenuAction: (listener: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => listener(action);
    ipcRenderer.on(IPC_CHANNELS.menuAction, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.menuAction, handler);
  },

  onGlobalShortcut: (listener: (shortcut: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, shortcut: string) => listener(shortcut);
    ipcRenderer.on(IPC_CHANNELS.globalShortcut, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.globalShortcut, handler);
  },

  onTrayClipSelected: (listener: (clipId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, clipId: string) => listener(clipId);
    ipcRenderer.on(IPC_CHANNELS.trayClipSelected, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.trayClipSelected, handler);
  },

  saveImageAs: (imageAssetPath: string) => ipcRenderer.invoke(IPC_CHANNELS.saveImageAs, imageAssetPath),

  revealImageInFinder: (imageAssetPath: string) => ipcRenderer.invoke(IPC_CHANNELS.revealImageInFinder, imageAssetPath),

  retryOcr: (clipId: string, imageAssetPath: string) => ipcRenderer.invoke(IPC_CHANNELS.retryOcr, clipId, imageAssetPath),
};

contextBridge.exposeInMainWorld("desktopBridge", bridge);
