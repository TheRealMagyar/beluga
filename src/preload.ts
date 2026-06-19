import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  connectWallet: () => Promise<{ address: string }>;
  signTransaction: (transactionBytesB64: string) => Promise<{ success: boolean; bytes?: string; signature?: string; error?: string }>;
  signPersonalMessage: (messageB64: string) => Promise<{ success: boolean; bytes?: string; signature?: string; error?: string }>;
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
}

export interface AppSettings {
  autoLaunch: boolean;
  startMinimized: boolean;
  mcpUrl: string;
  walrus: {
    mainnet: { target: string; port: number };
    testnet: { target: string; port: number };
  };
}
 
// és a Window globálhoz (ha van globals.d.ts vagy a preload alján):
declare global {
  interface Window {
    settings: {
      get:   () => Promise<AppSettings>;
      set:   <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<AppSettings>;
      reset: () => Promise<AppSettings>;
    };
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  connectWallet: (): Promise<{ address: string }> =>
    ipcRenderer.invoke('wallet:connect'),

  // transactionBytesB64: a Transaction.build({ client }) eredménye base64-be kódolva
  // Visszaad: { success, bytes (b64, aláírt tx bytes), signature } | { success: false, error }
  signTransaction: (transactionBytesB64: string) =>
    ipcRenderer.invoke('wallet:signTransaction', { transactionBytesB64 }),

  // messageB64: a personal message bytes base64-be kódolva
  // Visszaad: { success, bytes (b64), signature } | { success: false, error }
  signPersonalMessage: (messageB64: string) =>
    ipcRenderer.invoke('wallet:signPersonalMessage', { messageB64 }),

  onMcpRequest: (channel: string, callback: (payload: any, responseChannel: string) => void) => {
    const handler = (_event: any, { payload, responseChannel }: any) => {
      callback(payload, responseChannel);
    };
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },

  sendMcpResponse: (responseChannel: string, data: any) => {
    ipcRenderer.send(responseChannel, data);
  },

  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  platform: process.platform,
} satisfies ElectronAPI);

contextBridge.exposeInMainWorld('sui', {
  // Wallet lifecycle
  walletExists:     ()         => ipcRenderer.invoke('wallet:exists'),
  generateWallet:   ()         => ipcRenderer.invoke('wallet:generate'),
  importWallet:     (pk: string) => ipcRenderer.invoke('wallet:import', pk),
  loadWallet:       ()         => ipcRenderer.invoke('wallet:load'),
  exportPrivateKey: ()         => ipcRenderer.invoke('wallet:exportPrivateKey'),
  deleteWallet:     ()         => ipcRenderer.invoke('wallet:delete'),
  getWalletInfo:    ()         => ipcRenderer.invoke('wallet:getInfo'),
  // Balance & history
  getBalance:       (params: any) => ipcRenderer.invoke('sui:getBalance', params),
  getTransactions:  (params: any) => ipcRenderer.invoke('sui:getTransactions', params),
  // Payments
  send:             (params: any) => ipcRenderer.invoke('sui:send', params),
  swap:             (params: any) => ipcRenderer.invoke('sui:swap', params),
  swapQuote:        (params: any) => ipcRenderer.invoke('sui:swapQuote', params),
  pay:              (params: any) => ipcRenderer.invoke('sui:pay', params),
  resolveRecipient: (input: any)  => ipcRenderer.invoke('sui:resolveRecipient', input),
});

contextBridge.exposeInMainWorld('fs', {
  getAppPath: () => ipcRenderer.invoke('fs:getAppPath'),
  openFolder: (folderPath: string) => ipcRenderer.invoke('fs:openFolder', folderPath),
  readdir: (dirPath: string) => ipcRenderer.invoke('fs:readdir', dirPath),
  stat: (targetPath: string) => ipcRenderer.invoke('fs:stat', targetPath),
  mkdir: (dirPath: string) => ipcRenderer.invoke('fs:mkdir', dirPath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
  rmdir: (dirPath: string) => ipcRenderer.invoke('fs:rmdir', dirPath),
  pathJoin: (...parts: string[]) => ipcRenderer.invoke('fs:pathJoin', ...parts),
  /**
   * Projekt mappa fa-struktúrájának lekérése.
   * @returns { name, path, tree: FileTreeNode[] }
   */
  selectProject: (projectPath: string) =>
    ipcRenderer.invoke('fs:selectProject', projectPath),
  /**
   * Új fájl létrehozása tetszőleges helyen a projekten belül.
   * A közbülső mappák automatikusan létrejönnek.
   * @param filePath  Teljes abszolút útvonal
   * @param content   Opcionális kezdeti tartalom (default: '')
   */
  createFile: (filePath: string, content?: string) =>
    ipcRenderer.invoke('fs:createFile', { filePath, content }),
  readFileContent: (filePath: string) =>
    ipcRenderer.invoke('fs:readFileContent', filePath),
  writeFileContent: (filePath: string, content: string) =>
    ipcRenderer.invoke('fs:writeFileContent', { filePath, content }),
  deleteFile: (filePath: string) =>
    ipcRenderer.invoke('fs:deleteFile', filePath),
  renameFile: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke('fs:renameFile', { oldPath, newPath }),
  createFolder: (folderPath: string) =>
    ipcRenderer.invoke('fs:createFolder', folderPath),
  deleteFolder: (folderPath: string) =>
    ipcRenderer.invoke('fs:deleteFolder', folderPath),
  renameFolder: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke('fs:renameFolder', { oldPath, newPath }),
});

contextBridge.exposeInMainWorld('mcp', {
  projectList: () => ipcRenderer.invoke('mcp:project-list'),
  projectOpen: (project_name: string) => ipcRenderer.invoke('mcp:project-open', { project_name }),
  projectCreate: (project_name: string) => ipcRenderer.invoke('mcp:project-create', { project_name }),
  projectDelete: (project_name: string) => ipcRenderer.invoke('mcp:project-delete', { project_name }),
  projectRename: (old_name: string, new_name: string) => ipcRenderer.invoke('mcp:project-rename', { old_name, new_name }),
  fileRead: (project_name: string, file_path: string) => ipcRenderer.invoke('mcp:file-read', { project_name, file_path }),
  fileWrite: (project_name: string, file_path: string, content: string) => ipcRenderer.invoke('mcp:file-write', { project_name, file_path, content }),
  fileDelete: (project_name: string, file_path: string) => ipcRenderer.invoke('mcp:file-delete', { project_name, file_path }),
  fileRename: (project_name: string, old_path: string, new_path: string) => ipcRenderer.invoke('mcp:file-rename', { project_name, old_path, new_path }),
  folderCreate: (project_name: string, folder_path: string) => ipcRenderer.invoke('mcp:folder-create', { project_name, folder_path }),
  folderDelete: (project_name: string, folder_path: string) => ipcRenderer.invoke('mcp:folder-delete', { project_name, folder_path }),
  folderRename: (project_name: string, old_path: string, new_path: string) => ipcRenderer.invoke('mcp:folder-rename', { project_name, old_path, new_path }),
});

contextBridge.exposeInMainWorld('settings', {
  get:   () => ipcRenderer.invoke('settings:get'),
  set:   (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
  reset: () => ipcRenderer.invoke('settings:reset'),
});