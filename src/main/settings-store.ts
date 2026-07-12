import { app } from "electron";
import Store from "electron-store";
import type { AppSettings } from "./types";

export const settingsStore = new Store<AppSettings>({
  name: "settings",
  defaults: {
    autoLaunch: false,
    startMinimized: false,
    mcpUrl: "http://0.0.0.0:47823",
    ai: {
      enabled: false,
      authMode: "grok-build",
      apiKey: "",
      model: "grok-build-0.1",
      includePageContext: true,
      allowToolUse: true,
    },
    github: {
      clientId: "",
      clientSecret: "",
    },
    walrus: {
      mainnet: {
        target: "https://relayer.memory.walrus.xyz",
        packageId:
          "0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6",
        registryId:
          "0x0da982cefa26864ae834a8a0504b904233d49e20fcc17c373c8bed99c75a7edd",
        rpc: "https://fullnode.mainnet.sui.io:443",
      },
      testnet: {
        target: "https://relayer-staging.memory.walrus.xyz",
        packageId:
          "0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6",
        registryId:
          "0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437",
        rpc: "https://fullnode.testnet.sui.io:443",
      },
    },
  },
});

export function applyAutoLaunch(enabled: boolean) {
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: enabled });
  } else {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: [app.getAppPath()],
    });
  }
}