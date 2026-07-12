import { BrowserWindow } from "electron";
import path from "node:path";
import { setLocalnetLogSink } from "../helper/localnet-log-broadcast";
import { setLocalnetLogs } from "../helper/console-log-hub";
import { refreshLocalNetworkStatus } from "../helper/sui-client-manager";
import { registerWindowIpc } from "../ipc/window";
import { createMainIpcContext } from "../ipc/register-all";
import { getMainWindow, getTray, setMainWindow, setTray } from "./app-state";
import { settingsStore } from "./settings-store";
import { createTray } from "./tray";

export function createWindow() {
  console.log("[MAIN] 🪟 createWindow() hívása...");
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
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

  setMainWindow(mainWindow);

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  setLocalnetLogSink((payload) => {
    setLocalnetLogs(payload.source, payload.lines);
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send("localnet:logs", payload);
  });

  void refreshLocalNetworkStatus().catch(() => undefined);

  mainWindow.once("ready-to-show", () => {
    const win = getMainWindow();
    if (!win) return;
    if (settingsStore.get("startMinimized")) {
      if (!getTray()) {
        setTray(createTray());
      }
    } else {
      win.show();
    }
  });

  mainWindow.on("close", (e) => {
    if (getTray() && settingsStore.get("startMinimized")) {
      e.preventDefault();
      getMainWindow()?.hide();
    }
  });

  registerWindowIpc(createMainIpcContext());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    console.log("[MAIN] 🌐 Ablak betöltve: DEV server URL");
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
    console.log("[MAIN] 📄 Ablak betöltve: index.html");
  }
}