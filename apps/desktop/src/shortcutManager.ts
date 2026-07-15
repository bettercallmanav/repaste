import { globalShortcut, type BrowserWindow } from "electron";

const DEFAULT_TOGGLE_SHORTCUT = "CommandOrControl+Shift+V";

/**
 * Registers global keyboard shortcuts for the clipboard manager.
 */
export class ShortcutManager {
  private registered = false;

  register(getMainWindow: () => BrowserWindow): void {
    if (this.registered) return;

    const success = globalShortcut.register(DEFAULT_TOGGLE_SHORTCUT, () => {
      const mainWindow = getMainWindow();
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
    // Unregister only our own shortcut; unregisterAll() would clobber any
    // shortcut registered elsewhere in the app.
    globalShortcut.unregister(DEFAULT_TOGGLE_SHORTCUT);
    this.registered = false;
  }
}
