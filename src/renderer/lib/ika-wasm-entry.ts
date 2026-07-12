/**
 * Vite/Electron entry for @ika.xyz/ika-wasm.
 * The stock web build fetches WASM via import.meta.url, which resolves to HTML in dev.
 * We pass an explicit ?url asset so WebAssembly gets real .wasm bytes.
 */
import ikaInit from "../../../vendor/@ika.xyz/ika-wasm/dist/web/dwallet_mpc_wasm.js";
import wasmUrl from "../../../vendor/@ika.xyz/ika-wasm/dist/web/dwallet_mpc_wasm_bg.wasm?url";

export * from "../../../vendor/@ika.xyz/ika-wasm/dist/web/dwallet_mpc_wasm.js";

export default async function init(moduleOrPath?: unknown) {
  if (moduleOrPath === undefined) {
    return ikaInit(wasmUrl);
  }
  return ikaInit(moduleOrPath);
}