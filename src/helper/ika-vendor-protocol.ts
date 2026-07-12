import { net, protocol } from "electron";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import { resolveBelugaVendorUrl } from "./ika-vendor-path";

export function registerBelugaVendorScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "beluga-vendor",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

export function installBelugaVendorProtocol(): void {
  try {
    protocol.handle("beluga-vendor", async (request) => {
      const filePath = resolveBelugaVendorUrl(request.url);
      if (!filePath || !fs.existsSync(filePath)) {
        return new Response("Not found", { status: 404 });
      }

      return net.fetch(pathToFileURL(filePath).href);
    });
  } catch (err) {
    console.warn("[MAIN] beluga-vendor protocol already registered:", err);
  }
}