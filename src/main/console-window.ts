import { BrowserWindow } from "electron";
import path from "node:path";

let consoleWindow: BrowserWindow | null = null;

export function getConsoleWindow() {
  return consoleWindow;
}

export function openConsoleWindow() {
  if (consoleWindow && !consoleWindow.isDestroyed()) {
    if (consoleWindow.isMinimized()) consoleWindow.restore();
    consoleWindow.show();
    consoleWindow.focus();
    return consoleWindow;
  }

  consoleWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 520,
    minHeight: 380,
    show: false,
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition: { x: 14, y: 12 },
    backgroundColor: "#07070e",
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  consoleWindow.setMenuBarVisibility(false);

  const showConsole = () => {
    if (consoleWindow && !consoleWindow.isDestroyed() && !consoleWindow.isVisible()) {
      consoleWindow.show();
      consoleWindow.focus();
    }
  };

  consoleWindow.once("ready-to-show", showConsole);
  consoleWindow.webContents.once("did-finish-load", showConsole);
  consoleWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error(
        "[CONSOLE] Failed to load:",
        errorCode,
        errorDescription,
        validatedURL,
      );
      showConsole();
    },
  );

  consoleWindow.on("closed", () => {
    consoleWindow = null;
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const base = MAIN_WINDOW_VITE_DEV_SERVER_URL.replace(/\/$/, "");
    void consoleWindow.loadURL(`${base}#/console`);
  } else {
    void consoleWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: "/console" },
    );
  }

  return consoleWindow;
}

export function closeConsoleWindow() {
  if (consoleWindow && !consoleWindow.isDestroyed()) {
    consoleWindow.close();
  }
}