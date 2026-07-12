import { app, Menu, Tray, nativeImage } from "electron";
import path from "node:path";
import { CONFIG } from "../config";
import { getMainWindow, setTray } from "./app-state";

export function createTray(): Tray | null {
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
            getMainWindow()?.show();
            getMainWindow()?.focus();
          },
        },
        { type: "separator" },
        {
          label: "Quit",
          click: () => {
            const tray = t;
            tray.destroy();
            setTray(null);
            app.quit();
          },
        },
      ]),
    );

    t.on("double-click", () => {
      getMainWindow()?.show();
      getMainWindow()?.focus();
    });

    console.log("✅ Tray sikeresen létrehozva Mac-en!");
    return t;
  } catch (err) {
    console.error("❌ Tray létrehozási hiba:", err);
    return null;
  }
}