interface SuiAPI {
  generateWallet: () => Promise<{ success: boolean; address: string; publicKey: string; error?: string }>
  importWallet: (privateKey: string) => Promise<{ success: boolean; address: string; publicKey: string; error?: string }>
  getWalletInfo: () => Promise<{ success: boolean; address: string; publicKey: string } | null>
  exportPrivateKey: () => Promise<string>
  deleteWallet: () => Promise<void>
  getBalance: (params: { network: string }) => Promise<{ success: boolean; balance: import('./types/wallet').SuiBalance }>
  getTransactions: (params: { limit: number }) => Promise<{ success: boolean; transactions: import('./types/wallet').SuiTransaction[] }>
  send: (params: { to: string; amount: string; asset: string }) => Promise<{ success: boolean; digest: string; error?: string }>
  resolveRecipient: (input: string) => Promise<{ success: boolean; resolved: any } | null>
  swapQuote: (params: { from: string; to: string; amount: string }) => Promise<{ success: boolean; quote: any; error?: string }>
  swap: (params: { from: string; to: string; amount: string; slippage: number }) => Promise<{ success: boolean; result: any; error?: string }>
}

interface Window {
  electronAPI: {
    connectWallet: () => Promise<{ address: string }>;
    onMcpRequest: (
      channel: string,
      callback: (payload: any, responseChannel: string) => void
    ) => () => void;
    sendMcpResponse: (responseChannel: string, data: any) => void;
    windowMinimize: () => Promise<void>;
    windowMaximize: () => Promise<void>;
    windowClose: () => Promise<void>;
    windowIsMaximized: () => Promise<boolean>;
    platform: string;

    // ── T2000 signing ──
    signTransaction: (transactionBytesB64: string) => Promise<{ success: true; bytes: string; signature: string } | { success: false; error: string }>;
    signPersonalMessage: (messageB64: string) => Promise<{ success: true; bytes: string; signature: string } | { success: false; error: string }>;

    // ── Project Manager (filesystem) ──
    getAppPath: () => Promise<string>;
    readdir: (path: string) => Promise<string[]>;
    stat: (path: string) => Promise<{ size: number; mtime: string; isDirectory: boolean }>;
    mkdir: (path: string) => Promise<void>;
    writeFile: (path: string, content: string) => Promise<void>;
    readFile: (path: string) => Promise<string>;
    rename: (oldPath: string, newPath: string) => Promise<void>;
    rmdir: (path: string) => Promise<void>;
    pathJoin: (...parts: string[]) => string;
  };
  sui: SuiAPI;
}