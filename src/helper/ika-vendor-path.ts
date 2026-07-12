import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

/** Writable root for vendored @ika.xyz/sdk and ika-wasm (never use process.cwd() in packaged apps). */
export function getIkaVendorRoot(): string {
  const userDataRoot = path.join(app.getPath("userData"), "vendor", "@ika.xyz");

  if (!app.isPackaged) {
    const cwd = process.cwd();
    const devRoot = path.join(cwd, "vendor", "@ika.xyz");
    const looksLikeProjectRoot = fs.existsSync(path.join(cwd, "package.json"));
    if (looksLikeProjectRoot) {
      return devRoot;
    }
  }

  return userDataRoot;
}

export function getIkaWasmWebDir(): string {
  return path.join(getIkaVendorRoot(), "ika-wasm", "dist", "web");
}

export function getIkaWasmJsPath(): string {
  return path.join(getIkaWasmWebDir(), "dwallet_mpc_wasm.js");
}

export function getIkaWasmBinaryPath(): string {
  return path.join(getIkaWasmWebDir(), "dwallet_mpc_wasm_bg.wasm");
}

export function ikaWasmIsInstalled(): boolean {
  try {
    const js = getIkaWasmJsPath();
    const wasm = getIkaWasmBinaryPath();
    return fs.existsSync(js) && fs.existsSync(wasm);
  } catch {
    return false;
  }
}

/** Relative path under getIkaVendorRoot() from a beluga-vendor:// URL. */
export function resolveBelugaVendorUrl(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl);
    if (url.protocol !== "beluga-vendor:") return null;

    const relative = path.join(
      decodeURIComponent(url.hostname),
      decodeURIComponent(url.pathname).replace(/^\/+/, ""),
    );
    const vendorRoot = path.resolve(getIkaVendorRoot());
    const resolved = path.resolve(vendorRoot, relative);

    if (!resolved.startsWith(vendorRoot + path.sep) && resolved !== vendorRoot) {
      return null;
    }

    return resolved;
  } catch {
    return null;
  }
}