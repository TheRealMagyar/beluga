import { BrowserWindow } from "electron";
import type { ToolchainProgressEvent } from "../helper/toolchain-progress";
import { getAgent, resetAgent, setAgent } from "../main/agent";
import {
  buildTree,
  getProjectsDir,
  resolveFilePath,
  resolveProjectPath,
  treeText,
} from "../main/project-fs";
import { applyAutoLaunch, settingsStore } from "../main/settings-store";
import { createTray } from "../main/tray";
import { getMainWindow, getTray, setTray } from "../main/app-state";
import type { MainIpcContext } from "./context";
import { registerFsIpc } from "./fs";
import { registerMcpIpc } from "./mcp";
import { registerSkillsIpc } from "./skills";
import {
  broadcastTerminalExit,
  broadcastTerminalOutput,
  registerConsoleIpc,
} from "./console";
import { attachConsoleLogBroadcaster } from "../helper/console-log-hub";
import { setTerminalListeners } from "../helper/console-terminal";
import { getConsoleWindow } from "../main/console-window";
import { registerPackagesIpc } from "./packages";
import { registerPlaygroundIpc } from "./playground";
import { registerAiIpc } from "./ai";
import { registerSettingsIpc } from "./settings";
import { registerToolsIpc } from "./tools";
import { registerWalletIpc } from "./wallet";
import { registerGitHubIpc } from "./github";
import { registerFeedsIpc } from "./feeds";

function broadcastToolchainProgress(progress: ToolchainProgressEvent) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("packages:toolchain-progress", progress);
    }
  }
}

export function createMainIpcContext(): MainIpcContext {
  return {
    settingsStore,
    applyAutoLaunch,
    getMainWindow,
    getTray,
    setTray,
    createTray,
    getAgent,
    resetAgent,
    setAgent,
    getProjectsDir,
    resolveProjectPath,
    resolveFilePath,
    treeText,
    buildTree,
    broadcastToolchainProgress,
  };
}

let consoleLogUnsubscribe: (() => void) | null = null;

export function registerAllIpc(ctx: MainIpcContext = createMainIpcContext()) {
  if (!consoleLogUnsubscribe) {
    consoleLogUnsubscribe = attachConsoleLogBroadcaster(() => {
      const windows = [];
      const main = ctx.getMainWindow();
      const consoleWin = getConsoleWindow();
      if (main && !main.isDestroyed()) windows.push(main);
      if (consoleWin && !consoleWin.isDestroyed()) windows.push(consoleWin);
      return windows;
    });
    setTerminalListeners({
      onOutput: broadcastTerminalOutput,
      onExit: broadcastTerminalExit,
    });
  }
  registerSettingsIpc(ctx);
  registerGitHubIpc(ctx);
  registerAiIpc(ctx);
  registerWalletIpc(ctx);
  registerFeedsIpc(ctx);
  registerFsIpc(ctx);
  registerToolsIpc();
  registerPackagesIpc(ctx);
  registerPlaygroundIpc(ctx);
  registerMcpIpc(ctx);
  registerSkillsIpc();
  registerConsoleIpc();
}