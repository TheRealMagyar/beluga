// src/config.ts  (vagy ahol a CONFIG van)
import puzzleSvg from './assets/puzzle.svg'
import devFolderSvg from './assets/dev-folder.svg'
import bookSvg from './assets/book.svg'
import cogwheelSvg from './assets/cogwheel.svg'
import walletSvg from './assets/wallet.svg'
import applicationSvg from './assets/application.svg'
import linkSvg from './assets/link.svg'
import walrusPng from './assets/walrus.png'
import folderSvg from './assets/folder.svg'
import pencilSvg from './assets/pencil.svg'
import trashSvg from './assets/trash.svg'
import searchSvg from './assets/search.svg'
import refreshSvg from './assets/refresh.svg'
import folderEditSvg from './assets/folder-edit.svg'

export const CONFIG = {
  appName: "Beluga",
  sidebar: {
    NAV_ITEMS: [
      { path: "/", icon: puzzleSvg, label: "Memory" },
      {
        path: "/projects",
        icon: devFolderSvg,
        label: "Projects",
      },
    ],
    docsIcon: bookSvg,
    settingsIcon: cogwheelSvg,
    walletIcon: walletSvg,
    backgroundcolor: "#202020",
  },
  settingsPage: {
    SIDEBAR_ITEMS: [
      {
        id: "application",
        label: "Application",
        icon: applicationSvg,
      },
      {
        id: "mcp",
        label: "MCP endpoint",
        icon: linkSvg,
      },
      {
        id: "walrus",
        label: "Walrus",
        icon: walrusPng,
      },
    ],
  },
  projectManager: {
    projectCard: {
      folderIcon: folderSvg,
      memoryIcon: puzzleSvg,
      editIcon: pencilSvg,
      deleteIcon: trashSvg,
      searchIcon: searchSvg,
      refreshIcon: refreshSvg,
      noProjectIcon: folderEditSvg,
    },
  },
};