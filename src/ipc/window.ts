import { ipcMain } from "electron";
import type { MainIpcContext } from "./context";

export function registerWindowIpc(ctx: MainIpcContext) {
  ipcMain.handle("window-minimize", () => ctx.getMainWindow()?.minimize());
  ipcMain.handle("window-maximize", () => {
    const mainWindow = ctx.getMainWindow();
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle("window-close", () => {
    const mainWindow = ctx.getMainWindow();
    if (!mainWindow) return;
    if (ctx.getTray() && ctx.settingsStore.get("startMinimized")) {
      mainWindow.hide();
    } else {
      mainWindow.close();
    }
  });
  ipcMain.handle(
    "window-is-maximized",
    () => ctx.getMainWindow()?.isMaximized() ?? false,
  );
}

export function unregisterWindowIpc() {
  ipcMain.removeHandler("window-minimize");
  ipcMain.removeHandler("window-maximize");
  ipcMain.removeHandler("window-close");
  ipcMain.removeHandler("window-is-maximized");
}