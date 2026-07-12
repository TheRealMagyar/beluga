import { ipcMain } from "electron";
import { normalizeApiKey } from "../helper/ai-api-key";
import type { AiSettings, AppSettings } from "../main/types";
import type { MainIpcContext } from "./context";

function normalizeAiSettings(ai: Partial<AiSettings> & { apiKey?: string }): AiSettings {
  const hasApiKey = Boolean(normalizeApiKey(ai.apiKey ?? ""));
  const authMode =
    ai.authMode === "api-key" || ai.authMode === "grok-build"
      ? ai.authMode
      : hasApiKey
        ? "api-key"
        : "grok-build";

  return {
    enabled: ai.enabled ?? false,
    authMode,
    apiKey: normalizeApiKey(ai.apiKey ?? ""),
    model: ai.model ?? (authMode === "grok-build" ? "grok-build-0.1" : "grok-3-fast"),
    includePageContext: ai.includePageContext ?? true,
    allowToolUse: ai.allowToolUse ?? true,
  };
}

export function registerSettingsIpc(ctx: MainIpcContext) {
  ipcMain.handle("settings:get", () => ({
    autoLaunch: ctx.settingsStore.get("autoLaunch"),
    startMinimized: ctx.settingsStore.get("startMinimized"),
    mcpUrl: ctx.settingsStore.get("mcpUrl"),
    walrus: ctx.settingsStore.get("walrus"),
    ai: normalizeAiSettings(ctx.settingsStore.get("ai")),
    github: ctx.settingsStore.get("github") ?? { clientId: "", clientSecret: "" },
  }));

  ipcMain.handle(
    "settings:set",
    (_event, key: keyof AppSettings, value: unknown) => {
      if (key === "ai" && value && typeof value === "object") {
        ctx.settingsStore.set(key, normalizeAiSettings(value as AiSettings));
      } else {
        ctx.settingsStore.set(key, value);
      }

      if (key === "autoLaunch") {
        ctx.applyAutoLaunch(value as boolean);
      }

      if (key === "startMinimized") {
        if (value === true) {
          if (!ctx.getTray()) ctx.setTray(ctx.createTray());
        } else {
          const tray = ctx.getTray();
          if (tray) {
            tray.destroy();
            ctx.setTray(null);
          }
          const mainWindow = ctx.getMainWindow();
          if (mainWindow && !mainWindow.isVisible()) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      }

      return ctx.settingsStore.store;
    },
  );

  ipcMain.handle("settings:reset", () => {
    ctx.settingsStore.clear();
    ctx.applyAutoLaunch(false);
    const tray = ctx.getTray();
    if (tray) {
      tray.destroy();
      ctx.setTray(null);
    }
    return ctx.settingsStore.store;
  });
}