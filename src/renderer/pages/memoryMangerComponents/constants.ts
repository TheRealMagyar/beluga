export const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

export const MAINNET = {
  PACKAGE_ID: "0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6",
  REGISTRY_ID: "0x0da982cefa26864ae834a8a0504b904233d49e20fcc17c373c8bed99c75a7edd",
  RELAYER: isElectron ? "http://127.0.0.1:47821" : "/api/relayer-mainnet",
  NETWORK: "mainnet" as const,
  RPC: "https://fullnode.mainnet.sui.io:443",
};

export const TESTNET = {
  PACKAGE_ID: "0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6",
  REGISTRY_ID: "0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437",
  RELAYER: isElectron ? "http://127.0.0.1:47822" : "/api/relayer-testnet",
  NETWORK: "testnet" as const,
  RPC: "https://fullnode.testnet.sui.io:443",
};
