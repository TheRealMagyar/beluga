import { BrowserWindow, ipcMain } from "electron";

export async function callRenderer<T>(channel: string, payload?: unknown): Promise<T> {
  const win =
    BrowserWindow.getAllWindows().find(
      (w) =>
        !w.isDestroyed() &&
        (w.webContents.getURL().includes("index.html") ||
          w.webContents.getURL().includes("localhost")),
    ) ?? BrowserWindow.getAllWindows()[0];

  if (!win) throw new Error("No active BrowserWindow");

  return new Promise((resolve, reject) => {
    const responseChannel = `${channel}-response-${Date.now() + Math.random()}`;

    const timeoutId = setTimeout(() => {
      ipcMain.removeAllListeners(responseChannel);
      reject(new Error(`Renderer IPC timeout: ${channel} (60s)`));
    }, 60_000);

    ipcMain.once(responseChannel, (_event, result: { error?: string }) => {
      clearTimeout(timeoutId);
      if (result?.error) {
        reject(new Error(result.error));
      } else {
        resolve(result as T);
      }
    });

    win.webContents.send(channel, { responseChannel, payload });
  });
}