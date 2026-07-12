/**
 * Vite/Electron entry for @ika.xyz/ika-wasm.
 * Dev: loads from project vendor/ via static imports.
 * Packaged app: loads from userData via beluga-vendor:// after Toolchain install.
 */
import devIkaInit from "../../../vendor/@ika.xyz/ika-wasm/dist/web/dwallet_mpc_wasm.js";
import devWasmUrl from "../../../vendor/@ika.xyz/ika-wasm/dist/web/dwallet_mpc_wasm_bg.wasm?url";

export * from "../../../vendor/@ika.xyz/ika-wasm/dist/web/dwallet_mpc_wasm.js";

const BELUGA_VENDOR_JS =
  "beluga-vendor://ika-wasm/dist/web/dwallet_mpc_wasm.js";
const BELUGA_VENDOR_WASM =
  "beluga-vendor://ika-wasm/dist/web/dwallet_mpc_wasm_bg.wasm";

async function initFromUserData() {
  const mod = await import(/* @vite-ignore */ BELUGA_VENDOR_JS);
  return mod.default(BELUGA_VENDOR_WASM);
}

export default async function init(moduleOrPath?: unknown) {
  if (moduleOrPath !== undefined) {
    return devIkaInit(moduleOrPath);
  }

  if (window.electronAPI?.isPackaged) {
    const installed = await window.packages?.hasIkaWasm?.();
    if (installed) {
      return initFromUserData();
    }
    throw new Error(
      "Ika WASM is not installed. Install Ika SDK from Packages → Toolchain, then restart Beluga.",
    );
  }

  return devIkaInit(devWasmUrl);
}