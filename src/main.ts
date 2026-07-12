import { app, BrowserWindow } from "electron";
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
import { resolveBelugaToolchainRoot } from "./helper/beluga-toolchain-path";
import { cleanupIkaLocalnet } from "./helper/ika-localnet";
import { cleanupLocalNetwork } from "./helper/sui-client-manager";
import { getMainWindow, getTray } from "./main/app-state";
import { applyAutoLaunch, settingsStore } from "./main/settings-store";
import { createWindow } from "./main/window";
import { registerAllIpc } from "./ipc/register-all";
import { unregisterWindowIpc } from "./ipc/window";

export { RELAYER_PORT } from "./main/types";

console.log("[MAIN] 🚀 Electron app indítása...");

registerAllIpc();

if (started) {
  console.log("[MAIN] ⚠️ Squirrel startup detektálva, kilépés...");
  app.quit();
}

registerDeepLinkHandler();

if (!app.requestSingleInstanceLock()) {
  console.log("[MAIN] ❌ Másik példány már fut, kilépés...");
  app.quit();
}

app.on("second-instance", () => {
  const mainWindow = getMainWindow();
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

  if (process.getuid?.() === 0) {
    console.warn(
      "[MAIN] Beluga is running as root. Do not use sudo — it breaks ~/.beluga permissions. Run as your normal user.",
    );
  }

  try {
    const toolchainRoot = await resolveBelugaToolchainRoot();
    console.log(`[MAIN] Toolchain root: ${toolchainRoot}`);
  } catch (err) {
    console.error("[MAIN] Toolchain root resolution failed:", err);
  }

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
  if (getTray()) return;

  console.log("[MAIN] 🪟 Minden ablak bezárult, takarítás...");
  unregisterWindowIpc();

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

  try {
    cleanupLocalNetwork();
  } catch (err) {
    console.error("[MAIN] ❌ Hiba cleanupLocalNetwork()-ben:", err);
  }

  try {
    cleanupIkaLocalnet();
  } catch (err) {
    console.error("[MAIN] ❌ Hiba cleanupIkaLocalnet()-ben:", err);
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
  } else {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  }
});