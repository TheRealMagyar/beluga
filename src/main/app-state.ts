import type { BrowserWindow, Tray } from "electron";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

export function getMainWindow() {
  return mainWindow;
}

export function setMainWindow(window: BrowserWindow | null) {
  mainWindow = window;
}

export function getTray() {
  return tray;
}

export function setTray(next: Tray | null) {
  tray = next;
}