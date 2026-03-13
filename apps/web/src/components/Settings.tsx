import { useEffect, useState, type ReactNode } from "react";
import { Monitor, Moon, Settings as SettingsIcon, Sun } from "lucide-react";
import type { AppearanceTheme, ClipboardDesktopBridge, DesktopPreferences } from "@clipm/contracts/ipc";
import { useClipboardStore } from "../store.ts";

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

const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferences = {
  startAtLogin: false,
  closeToTray: true,
  enableOcr: true,
};

function SettingRow(props: {
  label: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="ui-card flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="ui-text-primary text-sm font-medium">{props.label}</div>
        <div className="ui-text-muted mt-1 text-xs">{props.description}</div>
      </div>
      <div className="shrink-0">{props.control}</div>
    </div>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useClipboardStore();
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [desktopPreferences, setDesktopPreferences] = useState<DesktopPreferences>(DEFAULT_DESKTOP_PREFERENCES);
  const [maxHistorySizeInput, setMaxHistorySizeInput] = useState(String(settings.maxHistorySize));

  useEffect(() => {
    setTheme(settings.theme);
    setMaxHistorySizeInput(String(settings.maxHistorySize));
  }, [settings.maxHistorySize, settings.theme]);

  useEffect(() => {
    const desktopBridge = getDesktopBridge();
    if (!desktopBridge?.getDesktopPreferences) return;

    void desktopBridge.getDesktopPreferences()
      .then((preferences) => setDesktopPreferences(preferences))
      .catch((error) => {
        console.error("Failed to load desktop preferences", error);
      });
  }, []);

  useEffect(() => {
    localStorage.setItem("clipm-theme", theme);
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  async function handleThemeChange(nextTheme: Theme): Promise<void> {
    setTheme(nextTheme);
    const desktopBridge = getDesktopBridge();
    try {
      await updateSettings({ theme: nextTheme });
      if (desktopBridge?.setThemePreference) {
        await desktopBridge.setThemePreference(nextTheme);
      }
    } catch (error) {
      console.error("Failed to update theme preference", error);
    }
  }

  async function handleDesktopPreferenceChange(
    patch: Partial<DesktopPreferences>,
  ): Promise<void> {
    const nextPreferences = { ...desktopPreferences, ...patch };
    setDesktopPreferences(nextPreferences);

    try {
      const desktopBridge = getDesktopBridge();
      if (desktopBridge?.setDesktopPreferences) {
        const persisted = await desktopBridge.setDesktopPreferences(patch);
        setDesktopPreferences(persisted);
      }
      await updateSettings({
        startAtLogin: nextPreferences.startAtLogin,
        closeToTray: nextPreferences.closeToTray,
        enableOcr: nextPreferences.enableOcr,
      });
    } catch (error) {
      console.error("Failed to update desktop preferences", error);
    }
  }

  async function handleMaxHistorySizeBlur(): Promise<void> {
    const parsed = Number.parseInt(maxHistorySizeInput, 10);
    const nextValue = Number.isFinite(parsed) ? Math.max(1, parsed) : settings.maxHistorySize;
    setMaxHistorySizeInput(String(nextValue));
    if (nextValue === settings.maxHistorySize) return;

    try {
      await updateSettings({ maxHistorySize: nextValue });
    } catch (error) {
      console.error("Failed to update max history size", error);
    }
  }

  async function handleDeduplicateChange(checked: boolean): Promise<void> {
    try {
      await updateSettings({ deduplicateConsecutive: checked });
    } catch (error) {
      console.error("Failed to update deduplicate setting", error);
    }
  }

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
        <div>
          <h3 className="ui-text-muted text-xs font-medium uppercase tracking-wider">Appearance</h3>
          <div className="mt-2 flex gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => { void handleThemeChange(value); }}
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

        <div>
          <h3 className="ui-text-muted text-xs font-medium uppercase tracking-wider">Desktop</h3>
          <div className="mt-2 space-y-2">
            <SettingRow
              label="Launch at login"
              description="Start Repaste automatically when you sign in."
              control={(
                <input
                  type="checkbox"
                  checked={desktopPreferences.startAtLogin}
                  onChange={(e) => { void handleDesktopPreferenceChange({ startAtLogin: e.target.checked }); }}
                />
              )}
            />
            <SettingRow
              label="Close window to tray"
              description="Hide the window instead of quitting when the close button is used."
              control={(
                <input
                  type="checkbox"
                  checked={desktopPreferences.closeToTray}
                  onChange={(e) => { void handleDesktopPreferenceChange({ closeToTray: e.target.checked }); }}
                />
              )}
            />
          </div>
        </div>

        <div>
          <h3 className="ui-text-muted text-xs font-medium uppercase tracking-wider">Clipboard</h3>
          <div className="mt-2 space-y-2">
            <SettingRow
              label="Max history size"
              description="Limit how many clips remain in history before older unpinned items are evicted."
              control={(
                <input
                  type="number"
                  min={1}
                  value={maxHistorySizeInput}
                  onChange={(e) => setMaxHistorySizeInput(e.target.value)}
                  onBlur={() => { void handleMaxHistorySizeBlur(); }}
                  className="ui-input w-24 rounded px-2 py-1 text-sm"
                />
              )}
            />
            <SettingRow
              label="Deduplicate consecutive copies"
              description="Skip storing a new clip when it matches the latest capture."
              control={(
                <input
                  type="checkbox"
                  checked={settings.deduplicateConsecutive}
                  onChange={(e) => { void handleDeduplicateChange(e.target.checked); }}
                />
              )}
            />
          </div>
        </div>

        <div>
          <h3 className="ui-text-muted text-xs font-medium uppercase tracking-wider">OCR</h3>
          <div className="mt-2 space-y-2">
            <SettingRow
              label="Enable OCR"
              description="Extract text from image clips and include it in search."
              control={(
                <input
                  type="checkbox"
                  checked={desktopPreferences.enableOcr}
                  onChange={(e) => { void handleDesktopPreferenceChange({ enableOcr: e.target.checked }); }}
                />
              )}
            />
          </div>
        </div>

        <div>
          <h3 className="ui-text-muted text-xs font-medium uppercase tracking-wider">About</h3>
          <div className="ui-text-muted mt-2 space-y-1 text-xs">
            <p>Repaste v0.0.1</p>
            <p>Clipboard history for text and images</p>
          </div>
        </div>
      </div>
    </div>
  );
}

applyTheme(getStoredTheme());
