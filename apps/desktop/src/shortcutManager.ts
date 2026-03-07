import { globalShortcut, type BrowserWindow } from "electron";

const DEFAULT_TOGGLE_SHORTCUT = "CommandOrControl+Shift+V";

/**
 * Registers global keyboard shortcuts for the clipboard manager.
 */
export class ShortcutManager {
  private registered = false;

  register(mainWindow: BrowserWindow): void {
    if (this.registered) return;

    const success = globalShortcut.register(DEFAULT_TOGGLE_SHORTCUT, () => {
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
      mainWindow.webContents.send("desktop:global-shortcut", DEFAULT_TOGGLE_SHORTCUT);
    });

    if (!success) {
      console.error(`Failed to register global shortcut: ${DEFAULT_TOGGLE_SHORTCUT}`);
    }

    this.registered = success;
  }

  unregister(): void {
    if (!this.registered) return;
    globalShortcut.unregisterAll();
    this.registered = false;
  }
}
