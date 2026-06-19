import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  shell,
} from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import {
  registerDeepLinkHandler,
  registerWalletConnectIPC,
  stopServer,
} from "./helper/wallet-connect-server";
import {
  startRelayerProxy,
  stopRelayerProxy,
  startMcpHttpServer,
  stopMcpServer,
} from "./api";
import fsPromises from "node:fs/promises";
import { DEFAULT_FILES } from "./helper/default-files";
import Store from "electron-store";
import fs from "fs";
import { CONFIG } from "./config";

interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  mtime?: string;
  children?: FileTreeNode[];
}

// ── Settings ──────────────────────────────────────────────────────────────────

interface WalrusNetworkConfig {
  target: string;
  packageId: string;
  registryId: string;
  rpc: string;
}

interface AppSettings {
  autoLaunch: boolean;
  startMinimized: boolean;
  mcpUrl: string;
  walrus: {
    mainnet: WalrusNetworkConfig;
    testnet: WalrusNetworkConfig;
  };
}

export const RELAYER_PORT = { mainnet: 47821, testnet: 47822 } as const;

const settingsStore = new Store<AppSettings>({
  name: "settings",
  defaults: {
    autoLaunch: false,
    startMinimized: false,
    mcpUrl: "http://0.0.0.0:47823",
    walrus: {
      mainnet: {
        target: "https://relayer.memory.walrus.xyz",
        packageId:
          "0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6",
        registryId:
          "0x0da982cefa26864ae834a8a0504b904233d49e20fcc17c373c8bed99c75a7edd",
        rpc: "https://fullnode.mainnet.sui.io:443",
      },
      testnet: {
        target: "https://relayer-staging.memory.walrus.xyz",
        packageId:
          "0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6",
        registryId:
          "0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437",
        rpc: "https://fullnode.testnet.sui.io:443",
      },
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────

console.log("[MAIN] 🚀 Electron app indítása...");

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// ── T2000 agent singleton ────────────────────────────────────────────────────
let _agent: any = null;

async function getAgent() {
  if (_agent) return _agent;
  const { T2000 } = await import("@t2000/sdk");
  _agent = await T2000.create();
  return _agent;
}

// ── autoLaunch ────────────────────────────────────────────────────────────────
// app.setLoginItemSettings() — cross-platform, nincs külső csomag
// macOS: LaunchAgent | Windows: HKCU\Software\Microsoft\Windows\CurrentVersion\Run

function applyAutoLaunch(enabled: boolean) {
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: enabled });
  } else {
    // Dev módban a futó electron binárist regisztráljuk a projekt útvonalával
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: [app.getAppPath()],
    });
  }
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray(): Tray | null {
  try {
    let iconPath: string;

    if (app.isPackaged) {
      iconPath = path.join(
        process.resourcesPath,
        "assets/tray-icons/darwin.png",
      );
    } else {
      iconPath = path.join(process.cwd(), "src/assets/tray-icons/darwin.png");
    }

    let icon = nativeImage.createFromPath(iconPath);

    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    }

    // Mac-re kötelező template image
    if (process.platform === "darwin") {
      icon.setTemplateImage(true);
    }

    const t = new Tray(icon);

    t.setToolTip(CONFIG.appName);

    t.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Show",
          click: () => {
            mainWindow?.show();
            mainWindow?.focus();
          },
        },
        { type: "separator" },
        {
          label: "Quit",
          click: () => {
            tray?.destroy();
            tray = null;
            app.quit();
          },
        },
      ]),
    );

    t.on("double-click", () => {
      mainWindow?.show();
      mainWindow?.focus();
    });

    console.log("✅ Tray sikeresen létrehozva Mac-en!");
    return t;
  } catch (err) {
    console.error("❌ Tray létrehozási hiba:", err);
    return null;
  }
}

// ── Segédfüggvények ────────────────────────────────────────────────────────────

async function getProjectsDir(): Promise<string> {
  const base = app.getPath("userData");
  const dir = path.join(base, "projects");
  await fsPromises.mkdir(dir, { recursive: true });
  return dir;
}

async function resolveProjectPath(projectName: string): Promise<string> {
  const dir = await getProjectsDir();
  const p = path.join(dir, projectName);
  if (!p.startsWith(dir)) throw new Error("Érvénytelen projekt név.");
  return p;
}

async function resolveFilePath(
  projectName: string,
  filePath: string,
): Promise<string> {
  const projectPath = await resolveProjectPath(projectName);
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.join(projectPath, filePath);
  if (!resolved.startsWith(projectPath)) {
    throw new Error("A fájlútvonal kimutat a projekt mappájából.");
  }
  return resolved;
}

async function treeText(dirPath: string, prefix = ""): Promise<string> {
  const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const lines: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const icon = entry.isDirectory() ? "📁 " : "";
    lines.push(`${prefix}${connector}${icon}${entry.name}`);
    if (entry.isDirectory()) {
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      lines.push(await treeText(path.join(dirPath, entry.name), childPrefix));
    }
  }
  return lines.filter(Boolean).join("\n");
}

async function buildTree(dirPath: string): Promise<FileTreeNode[]> {
  const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: "folder",
        children: await buildTree(fullPath),
      });
    } else {
      const s = await fsPromises.stat(fullPath);
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: "file",
        size: s.size,
        mtime: s.mtime.toISOString(),
      });
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// ── Settings ──────────────────────────────────────────────────────────────────

ipcMain.handle("settings:get", () => settingsStore.store);

ipcMain.handle(
  "settings:set",
  (_event, key: keyof AppSettings, value: unknown) => {
    settingsStore.set(key, value);

    if (key === "autoLaunch") {
      applyAutoLaunch(value as boolean);
    }

    if (key === "startMinimized") {
      if (value === true) {
        // Tray létrehozása ha nincs még
        if (!tray) tray = createTray();
      } else {
        // Tray eltávolítása és ablak előhozása ha rejtve volt
        if (tray) {
          tray.destroy();
          tray = null;
        }
        if (mainWindow && !mainWindow.isVisible()) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    }

    return settingsStore.store;
  },
);

ipcMain.handle("settings:reset", () => {
  settingsStore.clear();
  applyAutoLaunch(false);
  if (tray) {
    tray.destroy();
    tray = null;
  }
  return settingsStore.store;
});

// ── Wallet ────────────────────────────────────────────────────────────────────

ipcMain.handle("wallet:exists", async () => {
  const { walletExists } = await import("@t2000/sdk");
  return walletExists();
});

ipcMain.handle("wallet:generate", async () => {
  try {
    const { T2000 } = await import("@t2000/sdk");
    const { agent, address } = await T2000.init();
    _agent = agent;
    const publicKey = _agent.keypair.getPublicKey().toSuiPublicKey();
    return { success: true, address, publicKey };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("wallet:getInfo", async () => {
  try {
    const { T2000, walletExists } = await import("@t2000/sdk");
    if (!walletExists()) return null;
    const agent = await T2000.create();
    _agent = agent;
    const address = agent.address();
    const publicKey = agent.keypair.getPublicKey().toSuiPublicKey();
    return { success: true, address, publicKey };
  } catch {
    return null;
  }
});

ipcMain.handle("wallet:import", async (_, privateKey: string) => {
  try {
    const { T2000, saveKey, keypairFromPrivateKey } =
      await import("@t2000/sdk");
    const keypair = keypairFromPrivateKey(privateKey);
    await saveKey(keypair, undefined);
    _agent = await T2000.create();
    return { success: true, address: _agent.address() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("wallet:load", async () => {
  try {
    const agent = await getAgent();
    const address = agent.address();
    return { address };
  } catch {
    return null;
  }
});

ipcMain.handle("wallet:exportPrivateKey", async () => {
  try {
    const agent = await getAgent();
    return agent.exportKey();
  } catch {
    return null;
  }
});

ipcMain.handle("wallet:delete", async () => {
  const fs = await import("fs");
  const os = await import("os");
  const keyPath = path.join(os.homedir(), ".t2000", "wallet.key");
  if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
  _agent = null;
  return true;
});

ipcMain.handle(
  "wallet:signTransaction",
  async (_, { transactionBytesB64 }: { transactionBytesB64: string }) => {
    try {
      const agent = await getAgent();
      const bytes = Buffer.from(transactionBytesB64, "base64");
      const { signature, bytes: signedBytes } =
        await agent.keypair.signTransaction(bytes);
      return {
        success: true,
        bytes: Buffer.from(signedBytes).toString("base64"),
        signature,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle(
  "wallet:signPersonalMessage",
  async (_, { messageB64 }: { messageB64: string }) => {
    try {
      const agent = await getAgent();
      const message = Buffer.from(messageB64, "base64");
      const { signature, bytes: signedBytes } =
        await agent.keypair.signPersonalMessage(message);
      return {
        success: true,
        bytes: Buffer.from(signedBytes).toString("base64"),
        signature,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle(
  "sui:getBalance",
  async (_, { network }: { network: string }) => {
    try {
      const agent = await getAgent();
      const balance = await agent.balance();
      return { success: true, balance };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle(
  "sui:getTransactions",
  async (_, { limit = 20 }: { limit?: number }) => {
    try {
      const agent = await getAgent();
      const transactions = await agent.history({ limit });
      return { success: true, transactions };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle(
  "sui:send",
  async (
    _,
    { to, amount, asset }: { to: string; amount: string; asset: string },
  ) => {
    try {
      const agent = await getAgent();
      const result = await agent.send({ to, amount: Number(amount), asset });
      return { success: true, digest: result.digest };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle("sui:swap", async (_, { from, to, amount, slippage }: any) => {
  try {
    const agent = await getAgent();
    const result = await agent.swap({
      from,
      to,
      amount: Number(amount),
      slippage,
    });
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("sui:swapQuote", async (_, { from, to, amount }: any) => {
  try {
    const agent = await getAgent();
    const quote = await agent.swapQuote({ from, to, amount: Number(amount) });
    return { success: true, quote };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("sui:pay", async (_, { url, method, body, maxPrice }: any) => {
  try {
    const agent = await getAgent();
    const result = await agent.pay({ url, method, body, maxPrice });
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("sui:resolveRecipient", async (_, input: any) => {
  try {
    const agent = await getAgent();
    const resolved = await agent.resolveRecipient(input);
    return { success: true, resolved };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ── Filesystem ────────────────────────────────────────────────────────────────

ipcMain.handle("fs:getAppPath", async () => app.getPath("userData"));

ipcMain.handle("fs:readdir", async (_, dirPath: string) => {
  return await fsPromises.readdir(dirPath);
});

ipcMain.handle("fs:stat", async (_, targetPath: string) => {
  const s = await fsPromises.stat(targetPath);
  return {
    size: s.size,
    mtime: s.mtime.toISOString(),
    isDirectory: s.isDirectory(),
  };
});

ipcMain.handle("fs:mkdir", async (_, dirPath: string) => {
  await fsPromises.mkdir(dirPath, { recursive: true });
});

ipcMain.handle("fs:writeFile", async (_, filePath: string, content: string) => {
  await fsPromises.writeFile(filePath, content, "utf-8");
});

ipcMain.handle("fs:readFile", async (_, filePath: string) => {
  try {
    return await fsPromises.readFile(filePath, "utf-8");
  } catch (err: any) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
});

ipcMain.handle("fs:rename", async (_, oldPath: string, newPath: string) => {
  await fsPromises.rename(oldPath, newPath);
});

ipcMain.handle("fs:rmdir", async (_, dirPath: string) => {
  await fsPromises.rm(dirPath, { recursive: true, force: true });
});

ipcMain.handle("fs:pathJoin", (_event, ...parts: string[]) =>
  path.join(...parts),
);

ipcMain.handle("fs:openFolder", async (_event, folderPath: string) => {
  await shell.openPath(folderPath);
});

ipcMain.handle("fs:selectProject", async (_, projectPath: string) => {
  const s = await fsPromises.stat(projectPath);
  if (!s.isDirectory()) throw new Error("Nem mappa: " + projectPath);
  const tree = await buildTree(projectPath);
  return { name: path.basename(projectPath), path: projectPath, tree };
});

ipcMain.handle(
  "fs:createFile",
  async (
    _,
    { filePath, content = "" }: { filePath: string; content?: string },
  ) => {
    await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
    await fsPromises.writeFile(filePath, content, "utf-8");
  },
);

ipcMain.handle("fs:readFileContent", async (_, filePath: string) => {
  return await fsPromises.readFile(filePath, "utf-8");
});

ipcMain.handle(
  "fs:writeFileContent",
  async (_, { filePath, content }: { filePath: string; content: string }) => {
    await fsPromises.writeFile(filePath, content, "utf-8");
  },
);

ipcMain.handle("fs:deleteFile", async (_, filePath: string) => {
  await fsPromises.unlink(filePath);
});

ipcMain.handle(
  "fs:renameFile",
  async (_, { oldPath, newPath }: { oldPath: string; newPath: string }) => {
    await fsPromises.mkdir(path.dirname(newPath), { recursive: true });
    await fsPromises.rename(oldPath, newPath);
  },
);

ipcMain.handle("fs:createFolder", async (_, folderPath: string) => {
  await fsPromises.mkdir(folderPath, { recursive: true });
});

ipcMain.handle("fs:deleteFolder", async (_, folderPath: string) => {
  await fsPromises.rm(folderPath, { recursive: true, force: true });
});

ipcMain.handle(
  "fs:renameFolder",
  async (_, { oldPath, newPath }: { oldPath: string; newPath: string }) => {
    await fsPromises.rename(oldPath, newPath);
  },
);

// ── MCP ───────────────────────────────────────────────────────────────────────

ipcMain.handle("mcp:project-list", async () => {
  const projectsDir = await getProjectsDir();
  const dirs = await fsPromises.readdir(projectsDir);
  const projects = [];

  for (const dir of dirs) {
    const dirPath = path.join(projectsDir, dir);
    const stat = await fsPromises.stat(dirPath).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const entries = await fsPromises
      .readdir(dirPath)
      .catch(() => [] as string[]);
    const fileCount = (
      await Promise.all(
        entries.map(async (e) => {
          const s = await fsPromises
            .stat(path.join(dirPath, e))
            .catch(() => null);
          return s && !s.isDirectory() ? 1 : 0;
        }),
      )
    ).reduce((a, b) => a + b, 0 as number);

    projects.push({
      name: dir,
      path: dirPath,
      fileCount,
      createdAt: stat.mtime.toISOString(),
    });
  }

  return { projects };
});

ipcMain.handle(
  "mcp:project-open",
  async (_event, { project_name }: { project_name: string }) => {
    const projectPath = await resolveProjectPath(project_name);
    const stat = await fsPromises.stat(projectPath);
    if (!stat.isDirectory())
      throw new Error(`Nem létező projekt: ${project_name}`);

    const tree = await treeText(projectPath);

    let linkedIds: string[] = [];
    try {
      const memoriesPath = path.join(projectPath, ".memories.json");
      const content = await fsPromises.readFile(memoriesPath, "utf-8");
      const parsed = JSON.parse(content);
      linkedIds = Array.isArray(parsed?.ids) ? parsed.ids : [];
    } catch {}

    return {
      name: project_name,
      path: projectPath,
      tree: tree || "(üres projekt)",
      linkedIds,
    };
  },
);

ipcMain.handle(
  "mcp:project-create",
  async (_event, { project_name }: { project_name: string }) => {
    if (!/^[a-zA-Z0-9_\-]+$/.test(project_name)) {
      throw new Error(
        "Érvénytelen projekt név. Csak betűk, számok, - és _ megengedett.",
      );
    }
    const projectPath = await resolveProjectPath(project_name);
    await fsPromises.mkdir(projectPath, { recursive: true });
    for (const f of DEFAULT_FILES) {
      await fsPromises.writeFile(
        path.join(projectPath, f.name),
        f.content,
        "utf-8",
      );
    }
  },
);

ipcMain.handle(
  "mcp:project-delete",
  async (_event, { project_name }: { project_name: string }) => {
    const projectPath = await resolveProjectPath(project_name);
    await fsPromises.rm(projectPath, { recursive: true, force: true });
  },
);

ipcMain.handle(
  "mcp:project-rename",
  async (
    _event,
    { old_name, new_name }: { old_name: string; new_name: string },
  ) => {
    if (!/^[a-zA-Z0-9_\-]+$/.test(new_name))
      throw new Error("Érvénytelen projekt név.");
    const oldPath = await resolveProjectPath(old_name);
    const newPath = await resolveProjectPath(new_name);
    await fsPromises.rename(oldPath, newPath);
  },
);

ipcMain.handle(
  "mcp:file-read",
  async (
    _event,
    { project_name, file_path }: { project_name: string; file_path: string },
  ) => {
    const resolved = await resolveFilePath(project_name, file_path);
    const content = await fsPromises.readFile(resolved, "utf-8");
    return { content, path: resolved };
  },
);

ipcMain.handle(
  "mcp:file-write",
  async (
    _event,
    {
      project_name,
      file_path,
      content,
    }: { project_name: string; file_path: string; content: string },
  ) => {
    const resolved = await resolveFilePath(project_name, file_path);
    const exists = await fsPromises
      .stat(resolved)
      .then(() => true)
      .catch(() => false);
    await fsPromises.mkdir(path.dirname(resolved), { recursive: true });
    await fsPromises.writeFile(resolved, content, "utf-8");
    return { path: resolved, created: !exists };
  },
);

ipcMain.handle(
  "mcp:file-delete",
  async (
    _event,
    { project_name, file_path }: { project_name: string; file_path: string },
  ) => {
    const resolved = await resolveFilePath(project_name, file_path);
    await fsPromises.unlink(resolved);
    return { path: resolved };
  },
);

ipcMain.handle(
  "mcp:file-rename",
  async (
    _event,
    {
      project_name,
      old_path,
      new_path,
    }: { project_name: string; old_path: string; new_path: string },
  ) => {
    const resolvedOld = await resolveFilePath(project_name, old_path);
    const resolvedNew = await resolveFilePath(project_name, new_path);
    await fsPromises.mkdir(path.dirname(resolvedNew), { recursive: true });
    await fsPromises.rename(resolvedOld, resolvedNew);
    return { old_path: resolvedOld, new_path: resolvedNew };
  },
);

ipcMain.handle(
  "mcp:folder-create",
  async (
    _event,
    {
      project_name,
      folder_path,
    }: { project_name: string; folder_path: string },
  ) => {
    const resolved = await resolveFilePath(project_name, folder_path);
    await fsPromises.mkdir(resolved, { recursive: true });
    return { path: resolved };
  },
);

ipcMain.handle(
  "mcp:folder-delete",
  async (
    _event,
    {
      project_name,
      folder_path,
    }: { project_name: string; folder_path: string },
  ) => {
    const resolved = await resolveFilePath(project_name, folder_path);
    await fsPromises.rm(resolved, { recursive: true, force: true });
    return { path: resolved };
  },
);

ipcMain.handle(
  "mcp:folder-rename",
  async (
    _event,
    {
      project_name,
      old_path,
      new_path,
    }: { project_name: string; old_path: string; new_path: string },
  ) => {
    const resolvedOld = await resolveFilePath(project_name, old_path);
    const resolvedNew = await resolveFilePath(project_name, new_path);
    await fsPromises.rename(resolvedOld, resolvedNew);
    return { old_path: resolvedOld, new_path: resolvedNew };
  },
);

// ─── Window ───────────────────────────────────────────────────────────────────

export const createWindow = () => {
  console.log("[MAIN] 🪟 createWindow() hívása...");
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // ← mindig rejtve indul, ready-to-show mutatja meg
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: "#0a0a0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  // ── Startup visibility ────────────────────────────────────────────────────
  mainWindow.once("ready-to-show", () => {
    if (!mainWindow) return;
    if (settingsStore.get("startMinimized")) {
      // Tray-ben indul — ablak rejtve marad
      if (!tray) tray = createTray();
      // macOS-on megjelenik a dock ikon nélkül is; ha el akarod rejteni:
      // if (process.platform === 'darwin') app.dock?.hide();
    } else {
      mainWindow.show();
    }
  });

  // ── Bezárás: ha tray aktív, csak elrejt (nem zár be) ─────────────────────
  mainWindow.on("close", (e) => {
    if (tray && settingsStore.get("startMinimized")) {
      e.preventDefault(); // megakadályozza a valódi bezárást
      mainWindow?.hide();
    }
  });

  ipcMain.handle("window-minimize", () => mainWindow?.minimize());
  ipcMain.handle("window-maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  // window-close: ha tray aktív → elrejt, különben bezár
  ipcMain.handle("window-close", () => {
    if (!mainWindow) return;
    if (tray && settingsStore.get("startMinimized")) {
      mainWindow.hide();
    } else {
      mainWindow.close();
    }
  });
  ipcMain.handle(
    "window-is-maximized",
    () => mainWindow?.isMaximized() ?? false,
  );

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    console.log("[MAIN] 🌐 Ablak betöltve: DEV server URL");
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
    console.log("[MAIN] 📄 Ablak betöltve: index.html");
  }
};

// ─── App lifecycle ────────────────────────────────────────────────────────────

if (started) {
  console.log("[MAIN] ⚠️ Squirrel startup detektálva, kilépés...");
  app.quit();
}

registerDeepLinkHandler();

if (!app.requestSingleInstanceLock()) {
  console.log("[MAIN] ❌ Másik példány már fut, kilépés...");
  app.quit();
}

// Ha egy második példányt próbálnak indítani, az elsőt hozza előre
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

if (process.defaultApp) {
  app.setAsDefaultProtocolClient("myapp", process.execPath, [
    path.resolve(process.argv[1]),
  ]);
} else {
  app.setAsDefaultProtocolClient("myapp");
}

app.whenReady().then(async () => {
  console.log("[MAIN] ✅ app.whenReady() kész!");

  // Elmentett autoLaunch beállítás alkalmazása
  applyAutoLaunch(settingsStore.get("autoLaunch"));

  try {
    await startRelayerProxy();
    console.log("[MAIN] ✅ startRelayerProxy() sikeres!");
  } catch (err) {
    console.error("[MAIN] ❌ Hiba startRelayerProxy()-ben:", err);
  }

  try {
    startMcpHttpServer();
    console.log("[MAIN] ✅ startMcpHttpServer() sikeres!");
  } catch (err) {
    console.error("[MAIN] ❌ Hiba startMcpHttpServer()-ben:", err);
  }

  try {
    registerWalletConnectIPC();
    console.log("[MAIN] ✅ registerWalletConnectIPC() sikeres!");
  } catch (err) {
    console.error("[MAIN] ❌ Hiba registerWalletConnectIPC()-ben:", err);
  }

  try {
    createWindow();
    console.log("[MAIN] ✅ createWindow() sikeres!");
  } catch (err) {
    console.error("[MAIN] ❌ Hiba createWindow()-ben:", err);
  }
});

app.on("window-all-closed", () => {
  // Ha van tray, az app fut a háttérben — ne lépjen ki
  if (tray) return;

  console.log("[MAIN] 🪟 Minden ablak bezárult, takarítás...");

  ipcMain.removeHandler("window-minimize");
  ipcMain.removeHandler("window-maximize");
  ipcMain.removeHandler("window-close");
  ipcMain.removeHandler("window-is-maximized");

  try {
    stopRelayerProxy();
    console.log("[MAIN] ✅ stopRelayerProxy() sikeres!");
  } catch (err) {
    console.error("[MAIN] ❌ Hiba stopRelayerProxy()-ben:", err);
  }

  try {
    stopMcpServer();
    console.log("[MAIN] ✅ stopMcpServer() sikeres!");
  } catch (err) {
    console.error("[MAIN] ❌ Hiba stopMcpServer()-ben:", err);
  }

  try {
    stopServer();
    console.log("[MAIN] ✅ stopServer() sikeres!");
  } catch (err) {
    console.error("[MAIN] ❌ Hiba stopServer()-ben:", err);
  }

  if (process.platform !== "darwin") {
    console.log("[MAIN] 🛑 Kilépés (nem macOS)...");
    app.quit();
  }
});

app.on("activate", () => {
  console.log("[MAIN] ⚡ App aktiválva, ablak létrehozása...");
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      createWindow();
      console.log("[MAIN] ✅ createWindow() (activate) sikeres!");
    } catch (err) {
      console.error("[MAIN] ❌ Hiba createWindow()-ben (activate):", err);
    }
  } else if (mainWindow) {
    // macOS: Dock ikonra kattintáskor hozza elő az ablakot
    mainWindow.show();
    mainWindow.focus();
  }
});
