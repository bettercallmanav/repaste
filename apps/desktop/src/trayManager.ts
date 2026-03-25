import { Tray, Menu, nativeImage } from "electron";
import path from "node:path";

/**
 * Manages the macOS / Windows / Linux system tray icon and quick-access menu.
 */
interface TrayCallbacks {
  readonly toggleWindow: () => void;
  readonly showWindow: () => void;
  readonly selectClip: (clipId: string) => void;
  readonly quit: () => void;
}

export class TrayManager {
  private tray: Tray | null = null;
  private recentClips: Array<{ id: string; preview: string }> = [];
  private callbacks: TrayCallbacks | null = null;

  create(
    resourcesPath: string,
    callbacks: TrayCallbacks,
  ): Tray {
    this.callbacks = callbacks;
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
      this.callbacks?.toggleWindow();
    });

    this.updateMenu();
    return this.tray;
  }

  updateRecentClips(clips: Array<{ id: string; preview: string }>): void {
    this.recentClips = clips.slice(0, 10);
    this.updateMenu();
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
    this.callbacks = null;
  }

  private updateMenu(): void {
    if (!this.tray) return;

    const clipItems: Electron.MenuItemConstructorOptions[] = this.recentClips.map((clip) => ({
      label: clip.preview.slice(0, 60).replace(/\n/g, " "),
      click: () => {
        this.callbacks?.selectClip(clip.id);
      },
    }));

    const template: Electron.MenuItemConstructorOptions[] = [
      ...(clipItems.length > 0
        ? [...clipItems, { type: "separator" as const }]
        : [{ label: "No recent clips", enabled: false }]),
      {
        label: "Show Window",
        click: () => {
          this.callbacks?.showWindow();
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          this.callbacks?.quit();
        },
      },
    ];

    const contextMenu = Menu.buildFromTemplate(template);
    this.tray.setContextMenu(contextMenu);
  }
}
