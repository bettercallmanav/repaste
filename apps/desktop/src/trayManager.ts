import { Tray, Menu, nativeImage, type BrowserWindow } from "electron";
import path from "node:path";

/**
 * Manages the macOS / Windows / Linux system tray icon and quick-access menu.
 */
export class TrayManager {
  private tray: Tray | null = null;
  private recentClips: Array<{ id: string; preview: string }> = [];

  create(mainWindow: BrowserWindow, resourcesPath: string): Tray {
    // Load the tray icon from build resources
    // macOS uses "Template" images so the OS can adapt to light/dark menu bar
    const isMac = process.platform === "darwin";
    const iconPath = isMac
      ? path.join(resourcesPath, "trayTemplate@2x.png")
      : path.join(resourcesPath, "icon.png");

    let icon: Electron.NativeImage;
    try {
      icon = nativeImage.createFromPath(iconPath);
      if (isMac) {
        // Resize to 22x22 logical (44px @2x) for macOS menu bar
        icon = icon.resize({ width: 22, height: 22 });
        icon.setTemplateImage(true);
      } else {
        icon = icon.resize({ width: 32, height: 32 });
      }
    } catch {
      // Fallback to a simple inline icon if file not found
      icon = nativeImage.createEmpty();
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip("Repaste");

    this.tray.on("click", () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    this.updateMenu(mainWindow);
    return this.tray;
  }

  updateRecentClips(clips: Array<{ id: string; preview: string }>, mainWindow: BrowserWindow): void {
    this.recentClips = clips.slice(0, 10);
    this.updateMenu(mainWindow);
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  private updateMenu(mainWindow: BrowserWindow): void {
    if (!this.tray) return;

    const clipItems: Electron.MenuItemConstructorOptions[] = this.recentClips.map((clip) => ({
      label: clip.preview.slice(0, 60).replace(/\n/g, " "),
      click: () => {
        mainWindow.webContents.send("tray:clip-selected", clip.id);
        mainWindow.show();
        mainWindow.focus();
      },
    }));

    const template: Electron.MenuItemConstructorOptions[] = [
      ...(clipItems.length > 0
        ? [...clipItems, { type: "separator" as const }]
        : [{ label: "No recent clips", enabled: false }]),
      {
        label: "Show Window",
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: "separator" },
      { label: "Quit", role: "quit" },
    ];

    const contextMenu = Menu.buildFromTemplate(template);
    this.tray.setContextMenu(contextMenu);
  }
}
