// src/config.ts  (vagy ahol a CONFIG van)
import puzzleSvg from './assets/puzzle.svg'
import devFolderSvg from './assets/dev-folder.svg'
import bookSvg from './assets/book.svg'
import cogwheelSvg from './assets/cogwheel.svg'
import walletSvg from './assets/wallet.svg'
import applicationSvg from './assets/application.svg'
import linkSvg from './assets/link.svg'
import githubSvg from './assets/github.svg'
import walrusPng from './assets/walrus.png'
import folderSvg from './assets/folder.svg'
import pencilSvg from './assets/pencil.svg'
import trashSvg from './assets/trash.svg'
import searchSvg from './assets/search.svg'
import refreshSvg from './assets/refresh.svg'
import folderEditSvg from './assets/folder-edit.svg'
import playgroundSvg from './assets/playground.svg'
import packagesSvg from './assets/packages.svg'
import toolsSvg from './assets/tools.svg'
import skillsSvg from './assets/skills.svg'
import sparklesSvg from './assets/sparkles.svg'
import graduationSvg from './assets/graduation.svg'

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
      {
        path: "/skills",
        icon: skillsSvg,
        label: "Skills",
      },
      {
        path: "/playground",
        icon: playgroundSvg,
        label: "Playground",
      },
      {
        path: "/packages",
        icon: packagesSvg,
        label: "Packages",
      },
      {
        path: "/tools",
        icon: toolsSvg,
        label: "Tools",
      },
    ],
    docsIcon: bookSvg,
    learningIcon: graduationSvg,
    settingsIcon: cogwheelSvg,
    walletIcon: walletSvg,
    chartsIcon: toolsSvg,
    strategyIcon: skillsSvg,
    feedIcon: linkSvg,
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
        id: "ai",
        label: "AI Assistant",
        icon: sparklesSvg,
      },
      {
        id: "mcp",
        label: "MCP endpoint",
        icon: linkSvg,
      },
      {
        id: "github",
        label: "GitHub",
        icon: githubSvg,
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
      packageIcon: packagesSvg,
      skillIcon: skillsSvg,
      editIcon: pencilSvg,
      deleteIcon: trashSvg,
      searchIcon: searchSvg,
      refreshIcon: refreshSvg,
      noProjectIcon: folderEditSvg,
    },
  },
};