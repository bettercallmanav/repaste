import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Moon, Sun, Monitor } from "lucide-react";

type Theme = "system" | "light" | "dark";

function getStoredTheme(): Theme {
  return (localStorage.getItem("clipm-theme") as Theme) ?? "system";
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
    root.classList.toggle("light", !prefersDark);
  } else {
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
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
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <SettingsIcon className="size-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          Done
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Theme */}
        <div>
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Appearance</h3>
          <div className="mt-2 flex gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  theme === value
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
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
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">About</h3>
          <div className="mt-2 space-y-1 text-xs text-zinc-500">
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
