import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Moon, Sun, Monitor } from "lucide-react";
import type { AppearanceTheme, ClipboardDesktopBridge } from "@clipm/contracts/ipc";

type Theme = AppearanceTheme;

type DesktopWindow = Window & {
  desktopBridge?: ClipboardDesktopBridge;
};

function getDesktopBridge(): ClipboardDesktopBridge | undefined {
  return (window as DesktopWindow).desktopBridge;
}

function getStoredTheme(): Theme {
  const stored = localStorage.getItem("clipm-theme");
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function resolveTheme(theme: Theme): Exclude<Theme, "system"> {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const resolvedTheme = resolveTheme(theme);

  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);

  if (document.body) {
    document.body.style.backgroundColor = resolvedTheme === "dark" ? "#09090b" : "#f3f4f6";
    document.body.style.color = resolvedTheme === "dark" ? "#f8fafc" : "#111827";
  }
}

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    localStorage.setItem("clipm-theme", theme);
    applyTheme(theme);
    const desktopBridge = getDesktopBridge();
    if (!desktopBridge) return;
    void desktopBridge.setThemePreference(theme).catch((error) => {
      console.error("Failed to persist desktop theme preference", error);
    });
  }, [theme]);

  // Listen for system theme changes when using "system" theme
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <div className="flex h-full flex-col">
      <div className="ui-divider flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SettingsIcon className="ui-text-muted size-4" />
          <h2 className="ui-text-primary text-sm font-semibold">Settings</h2>
        </div>
        <button
          onClick={onClose}
          className="ui-tab rounded px-2 py-1 text-xs"
        >
          Done
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Theme */}
        <div>
          <h3 className="ui-text-muted text-xs font-medium uppercase tracking-wider">Appearance</h3>
          <div className="mt-2 flex gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  theme === value
                    ? "ui-theme-option-active"
                    : "ui-theme-option"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div>
          <h3 className="ui-text-muted text-xs font-medium uppercase tracking-wider">About</h3>
          <div className="ui-text-muted mt-2 space-y-1 text-xs">
            <p>Repaste v0.0.1</p>
            <p>Event-sourced clipboard history</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Initialize theme on load
applyTheme(getStoredTheme());
