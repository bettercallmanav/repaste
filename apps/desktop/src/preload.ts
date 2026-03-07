import { contextBridge, ipcRenderer } from "electron";
import type { ClipboardDesktopBridge, ContextMenuItem } from "@clipm/contracts/ipc";

const bridge: ClipboardDesktopBridge = {
  getWsUrl: () => process.env.CLIPM_DESKTOP_WS_URL ?? null,

  writeClipboard: (text: string) => ipcRenderer.invoke("clipboard:write", text),

  readClipboard: () => ipcRenderer.invoke("clipboard:read"),

  showContextMenu: (items: readonly ContextMenuItem[]) =>
    ipcRenderer.invoke("desktop:context-menu", items),

  openExternal: (url: string) => ipcRenderer.invoke("desktop:open-external", url),

  onMenuAction: (listener: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => listener(action);
    ipcRenderer.on("desktop:menu-action", handler);
    return () => ipcRenderer.removeListener("desktop:menu-action", handler);
  },

  onGlobalShortcut: (listener: (shortcut: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, shortcut: string) => listener(shortcut);
    ipcRenderer.on("desktop:global-shortcut", handler);
    return () => ipcRenderer.removeListener("desktop:global-shortcut", handler);
  },
};

contextBridge.exposeInMainWorld("desktopBridge", bridge);
