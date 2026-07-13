import { app, ipcMain, shell } from "electron";
import path from "node:path";
import fsPromises from "node:fs/promises";
import type { MainIpcContext } from "./context";

export function registerFsIpc(ctx: MainIpcContext) {
  ipcMain.handle("fs:getAppPath", async () => app.getPath("userData"));

  ipcMain.handle("fs:readdir", async (_, dirPath: string) => {
    return await fsPromises.readdir(dirPath);
  });

  ipcMain.handle("fs:stat", async (_, targetPath: string) => {
    try {
      const s = await fsPromises.stat(targetPath);
      return {
        size: s.size,
        mtime: s.mtime.toISOString(),
        isDirectory: s.isDirectory(),
      };
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "ENOENT"
      ) {
        return null;
      }
      throw err;
    }
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
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "ENOENT"
      ) {
        return null;
      }
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
    const tree = await ctx.buildTree(projectPath);
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
}