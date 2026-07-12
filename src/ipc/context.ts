import type { BrowserWindow, Tray } from "electron";
import type Store from "electron-store";
import type { ToolchainProgressEvent } from "../helper/toolchain-progress";
import type { AppSettings, FileTreeNode } from "../main/types";

export interface MainIpcContext {
  settingsStore: Store<AppSettings>;
  applyAutoLaunch: (enabled: boolean) => void;
  getMainWindow: () => BrowserWindow | null;
  getTray: () => Tray | null;
  setTray: (tray: Tray | null) => void;
  createTray: () => Tray | null;
  getAgent: () => Promise<unknown>;
  resetAgent: () => void;
  setAgent: (agent: unknown) => void;
  getProjectsDir: () => Promise<string>;
  resolveProjectPath: (projectName: string) => Promise<string>;
  resolveFilePath: (projectName: string, filePath: string) => Promise<string>;
  treeText: (dirPath: string, prefix?: string) => Promise<string>;
  buildTree: (dirPath: string) => Promise<FileTreeNode[]>;
  broadcastToolchainProgress: (progress: ToolchainProgressEvent) => void;
}