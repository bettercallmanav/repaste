import { BrowserWindow, screen, type BrowserWindowConstructorOptions } from "electron";
import path from "node:path";

const WINDOW_WIDTH = 480;
const WINDOW_HEIGHT = 640;
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

export interface WindowManagerOptions {
  preloadPath: string;
  webDistPath: string;
}

/**
 * Creates and manages the main application window.
 */
export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  create(options: WindowManagerOptions): BrowserWindow {
    const windowOptions: BrowserWindowConstructorOptions = {
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      show: false,
      frame: true,
      resizable: true,
      skipTaskbar: false,
      webPreferences: {
        preload: options.preloadPath,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    };

    this.mainWindow = new BrowserWindow(windowOptions);

    // Hide instead of close when the user hits the close button
    this.mainWindow.on("close", (e) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        e.preventDefault();
        this.mainWindow.hide();
      }
    });

    // Load content
    if (DEV_SERVER_URL) {
      this.mainWindow.loadURL(DEV_SERVER_URL);
    } else {
      this.mainWindow.loadFile(path.join(options.webDistPath, "index.html"));
    }

    return this.mainWindow;
  }

  getWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /** Position the window near the cursor / center of screen */
  positionNearCursor(): void {
    if (!this.mainWindow) return;

    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const { width: screenW, height: screenH } = display.workAreaSize;
    const { x: areaX, y: areaY } = display.workArea;

    const [winW, winH] = this.mainWindow.getSize() as [number, number];

    // Try to place near cursor, but clamp to screen bounds
    let x = cursor.x - Math.floor(winW / 2);
    let y = cursor.y - Math.floor(winH / 2);

    x = Math.max(areaX, Math.min(x, areaX + screenW - winW));
    y = Math.max(areaY, Math.min(y, areaY + screenH - winH));

    this.mainWindow.setPosition(x, y, false);
  }

  showAndFocus(): void {
    if (!this.mainWindow) return;
    this.positionNearCursor();
    this.mainWindow.show();
    this.mainWindow.focus();
  }

  destroy(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      // Remove close handler so it actually closes
      this.mainWindow.removeAllListeners("close");
      this.mainWindow.destroy();
    }
    this.mainWindow = null;
  }
}
