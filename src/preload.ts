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
  isPackaged: boolean;
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
  // Sandboxed preload cannot use electron.app — defaultApp is false in .app bundles.
  isPackaged: !process.defaultApp,
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
  requestFaucet:    (params: { network: 'testnet' | 'devnet' | 'localnet'; recipient: string }) =>
    ipcRenderer.invoke('sui:requestFaucet', params),
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

contextBridge.exposeInMainWorld('belugaAi', {
  getStatus: () => ipcRenderer.invoke('ai:get-status'),
  testConnection: (params?: {
    apiKey?: string;
    model?: string;
    authMode?: 'grok-build' | 'api-key';
  }) => ipcRenderer.invoke('ai:test-connection', params ?? {}),
  oauthStart: () => ipcRenderer.invoke('ai:oauth-start'),
  oauthExchangeCode: (code: string) =>
    ipcRenderer.invoke('ai:oauth-exchange-code', { code }),
  oauthStatus: () => ipcRenderer.invoke('ai:oauth-status'),
  oauthLogout: () => ipcRenderer.invoke('ai:oauth-logout'),
  onOauthComplete: (
    callback: (payload: { ok: boolean; message: string }) => void,
  ) => {
    const handler = (_event: unknown, payload: Parameters<typeof callback>[0]) =>
      callback(payload);
    ipcRenderer.on('ai:oauth-complete', handler);
    return () => ipcRenderer.removeListener('ai:oauth-complete', handler);
  },
  chat: (params: {
    requestId: string;
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    pageContext?: string;
  }) => ipcRenderer.invoke('ai:chat', params),
  abort: (requestId: string) => ipcRenderer.invoke('ai:abort', { requestId }),
  onStreamChunk: (
    callback: (payload: { requestId: string; delta: string }) => void,
  ) => {
    const handler = (_event: unknown, payload: Parameters<typeof callback>[0]) =>
      callback(payload);
    ipcRenderer.on('ai:stream-chunk', handler);
    return () => ipcRenderer.removeListener('ai:stream-chunk', handler);
  },
  onStreamDone: (
    callback: (payload: {
      requestId: string;
      usage: { promptTokens: number; completionTokens: number } | null;
    }) => void,
  ) => {
    const handler = (_event: unknown, payload: Parameters<typeof callback>[0]) =>
      callback(payload);
    ipcRenderer.on('ai:stream-done', handler);
    return () => ipcRenderer.removeListener('ai:stream-done', handler);
  },
  onStreamError: (
    callback: (payload: { requestId: string; message: string }) => void,
  ) => {
    const handler = (_event: unknown, payload: Parameters<typeof callback>[0]) =>
      callback(payload);
    ipcRenderer.on('ai:stream-error', handler);
    return () => ipcRenderer.removeListener('ai:stream-error', handler);
  },
  onToolCall: (
    callback: (payload: {
      requestId: string;
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      argsDisplay: string;
    }) => void,
  ) => {
    const handler = (_event: unknown, payload: Parameters<typeof callback>[0]) =>
      callback(payload);
    ipcRenderer.on('ai:tool-call', handler);
    return () => ipcRenderer.removeListener('ai:tool-call', handler);
  },
  onToolResult: (
    callback: (payload: {
      requestId: string;
      toolCallId: string;
      toolName: string;
      result: string;
    }) => void,
  ) => {
    const handler = (_event: unknown, payload: Parameters<typeof callback>[0]) =>
      callback(payload);
    ipcRenderer.on('ai:tool-result', handler);
    return () => ipcRenderer.removeListener('ai:tool-result', handler);
  },
});

contextBridge.exposeInMainWorld('belugaGitHub', {
  getStatus: () => ipcRenderer.invoke('github:get-status'),
  verify: () => ipcRenderer.invoke('github:verify'),
  logout: () => ipcRenderer.invoke('github:logout'),
  savePat: (token: string) => ipcRenderer.invoke('github:save-pat', { token }),
  oauthStart: () => ipcRenderer.invoke('github:oauth-start'),
  deviceStart: () => ipcRenderer.invoke('github:device-start'),
  devicePoll: () => ipcRenderer.invoke('github:device-poll'),
  listRepos: (page?: number) => ipcRenderer.invoke('github:list-repos', { page }),
  projectStatus: (projectName: string) =>
    ipcRenderer.invoke('github:project-status', { projectName }),
  createRepo: (params: {
    projectName: string;
    repoName?: string;
    description?: string;
    private?: boolean;
    push?: boolean;
  }) => ipcRenderer.invoke('github:create-repo', params),
  connectRepo: (params: {
    projectName: string;
    owner: string;
    repo: string;
    push?: boolean;
  }) => ipcRenderer.invoke('github:connect-repo', params),
  setRepoVisibility: (projectName: string, isPrivate: boolean) =>
    ipcRenderer.invoke('github:set-repo-visibility', {
      projectName,
      private: isPrivate,
    }),
  gitInit: (projectName: string, branch?: string) =>
    ipcRenderer.invoke('github:git-init', { projectName, branch }),
  gitAdd: (projectName: string, paths?: string[]) =>
    ipcRenderer.invoke('github:git-add', { projectName, paths }),
  gitCommit: (projectName: string, message: string) =>
    ipcRenderer.invoke('github:git-commit', { projectName, message }),
  gitPush: (projectName: string, branch?: string) =>
    ipcRenderer.invoke('github:git-push', { projectName, branch }),
  gitPull: (projectName: string, branch?: string) =>
    ipcRenderer.invoke('github:git-pull', { projectName, branch }),
  gitFetch: (projectName: string) =>
    ipcRenderer.invoke('github:git-fetch', { projectName }),
  gitMerge: (projectName: string, branch: string, message?: string) =>
    ipcRenderer.invoke('github:git-merge', { projectName, branch, message }),
  gitBranches: (projectName: string) =>
    ipcRenderer.invoke('github:git-branches', { projectName }),
  gitCheckout: (projectName: string, branch: string) =>
    ipcRenderer.invoke('github:git-checkout', { projectName, branch }),
  gitBranchCreate: (projectName: string, branch: string, checkout?: boolean) =>
    ipcRenderer.invoke('github:git-branch-create', { projectName, branch, checkout }),
  gitLog: (projectName: string, limit?: number) =>
    ipcRenderer.invoke('github:git-log', { projectName, limit }),
  onOauthComplete: (
    callback: (payload: { ok: boolean; message: string }) => void,
  ) => {
    const handler = (_event: unknown, payload: Parameters<typeof callback>[0]) =>
      callback(payload);
    ipcRenderer.on('github:oauth-complete', handler);
    return () => ipcRenderer.removeListener('github:oauth-complete', handler);
  },
});

contextBridge.exposeInMainWorld('tools', {
  fetchAddressGraph: (params: {
    address: string;
    network?: 'mainnet' | 'testnet' | 'devnet';
    limit?: number;
  }) => ipcRenderer.invoke('tools:fetch-address-graph', params),
  scanToken: (params: {
    input: string;
    network?: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  }) => ipcRenderer.invoke('tools:scan-token', params),
  listGrpcQueryCatalog: () =>
    ipcRenderer.invoke('tools:list-grpc-query-catalog'),
  executeGrpcQuery: (params: {
    network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
    service: string;
    method: string;
    request?: Record<string, unknown>;
    baseUrl?: string;
  }) => ipcRenderer.invoke('tools:execute-grpc-query', params),
  buildTokenPackage: (config: {
    name: string;
    symbol: string;
    description: string;
    iconUrl?: string;
    decimals: number;
    moduleName: string;
    coinTypeName: string;
    supplyMode: 'unlimited' | 'fixed';
    freezeMetadata: boolean;
    initialMint: {
      enabled: boolean;
      amount: string;
      recipientMode: 'publisher' | 'custom';
      recipient?: string;
    };
  }) => ipcRenderer.invoke('tools:build-token-package', config),
  buildNftPackage: (config: {
    mode: 'generative-collection' | 'editions' | 'open-editions';
    name: string;
    symbol: string;
    description: string;
    moduleName: string;
    typeName: string;
    maxSupply: number;
    royaltyBps: number;
    mintPriceMist: number;
    transferable: boolean;
    frozenDisplay: boolean;
  }) => ipcRenderer.invoke('tools:build-nft-package', config),
  prepareWalrusUpload: (params: {
    network: 'mainnet' | 'testnet';
    owner: string;
    fileName: string;
    contentBase64: string;
    epochs?: number;
  }) => ipcRenderer.invoke('tools:prepare-walrus-upload', params),
  completeWalrusRegister: (params: {
    flowId: string;
    registerDigest: string;
  }) => ipcRenderer.invoke('tools:complete-walrus-register', params),
  finalizeWalrusUpload: (params: { flowId: string }) =>
    ipcRenderer.invoke('tools:finalize-walrus-upload', params),
  prepareWalrusExtend: (params: {
    network: 'mainnet' | 'testnet';
    blobObjectId: string;
    epochs: number;
    sender: string;
  }) => ipcRenderer.invoke('tools:prepare-walrus-extend', params),
  getWalrusBlobStatus: (params: {
    network: 'mainnet' | 'testnet';
    blobObjectId: string;
  }) => ipcRenderer.invoke('tools:get-walrus-blob-status', params),
});

contextBridge.exposeInMainWorld('packages', {
  onToolchainProgress: (
    callback: (event: {
      job: string;
      phase: string;
      percent: number | null;
      message: string;
      detail?: string;
      recentLogs: string[];
    }) => void,
  ) => {
    const handler = (_event: unknown, payload: Parameters<typeof callback>[0]) =>
      callback(payload);
    ipcRenderer.on('packages:toolchain-progress', handler);
    return () => ipcRenderer.removeListener('packages:toolchain-progress', handler);
  },
  checkNpm: () => ipcRenderer.invoke('packages:check-npm'),
  getToolchainStatus: () => ipcRenderer.invoke('packages:get-toolchain-status'),
  installRust: () => ipcRenderer.invoke('packages:install-rust'),
  installSuiup: () => ipcRenderer.invoke('packages:install-suiup'),
  installSuiCli: (method: 'suiup' | 'brew' = 'suiup') =>
    ipcRenderer.invoke('packages:install-sui-cli', { method }),
  updateRust: () => ipcRenderer.invoke('packages:update-rust'),
  uninstallRust: () => ipcRenderer.invoke('packages:uninstall-rust'),
  updateSuiup: () => ipcRenderer.invoke('packages:update-suiup'),
  uninstallSuiup: () => ipcRenderer.invoke('packages:uninstall-suiup'),
  updateSuiCli: () => ipcRenderer.invoke('packages:update-sui-cli'),
  uninstallSuiCli: () => ipcRenderer.invoke('packages:uninstall-sui-cli'),
  installGit: () => ipcRenderer.invoke('packages:install-git'),
  updateGit: () => ipcRenderer.invoke('packages:update-git'),
  cloneIkaRepo: () => ipcRenderer.invoke('packages:clone-ika-repo'),
  buildIkaBinary: () => ipcRenderer.invoke('packages:build-ika-binary'),
  updateIkaRepo: () => ipcRenderer.invoke('packages:update-ika-repo'),
  uninstallIkaRepo: () => ipcRenderer.invoke('packages:uninstall-ika-repo'),
  rebuildIkaBinary: () => ipcRenderer.invoke('packages:rebuild-ika-binary'),
  uninstallIkaBinary: () => ipcRenderer.invoke('packages:uninstall-ika-binary'),
  installIkaSdk: () => ipcRenderer.invoke('packages:install-ika-sdk'),
  updateIkaSdk: () => ipcRenderer.invoke('packages:update-ika-sdk'),
  uninstallIkaSdk: () => ipcRenderer.invoke('packages:uninstall-ika-sdk'),
  hasIkaWasm: () => ipcRenderer.invoke('packages:has-ika-wasm') as Promise<boolean>,
  listCatalog: () => ipcRenderer.invoke('packages:list-catalog'),
  listCustomPackages: () => ipcRenderer.invoke('packages:list-custom'),
  createCustomPackage: (input: {
    name: string;
    description: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    category?: string;
    docsUrl?: string;
    accent?: string;
    id?: string;
  }) => ipcRenderer.invoke('packages:create-custom', input),
  updateCustomPackage: (
    id: string,
    patch: {
      name?: string;
      description?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      category?: string;
      docsUrl?: string;
      accent?: string;
    },
  ) => ipcRenderer.invoke('packages:update-custom', { id, patch }),
  deleteCustomPackage: (id: string) =>
    ipcRenderer.invoke('packages:delete-custom', { id }),
  listInstalled: () => ipcRenderer.invoke('packages:list-installed'),
  install: (id: string) => ipcRenderer.invoke('packages:install', { id }),
  update: (id: string) => ipcRenderer.invoke('packages:update', { id }),
  uninstall: (id: string) => ipcRenderer.invoke('packages:uninstall', { id }),
  installToProject: (projectPath: string, packageIds: string[]) =>
    ipcRenderer.invoke('packages:install-to-project', { projectPath, packageIds }),
  cancelJob: (jobId: string) =>
    ipcRenderer.invoke('packages:cancel-job', { jobId }),
  listActiveJobs: () => ipcRenderer.invoke('packages:list-active-jobs'),
});

contextBridge.exposeInMainWorld('belugaConsole', {
  open: () => ipcRenderer.invoke('console:open'),
  getSnapshot: () => ipcRenderer.invoke('console:get-snapshot'),
  appendPlaygroundLog: (entry: {
    id?: string;
    level: 'info' | 'success' | 'warn' | 'error';
    message: string;
    timestamp: number;
  }) => ipcRenderer.invoke('console:append-playground-log', entry),
  clearLogs: (target?: 'all' | 'playground' | 'sui' | 'ika') =>
    ipcRenderer.invoke('console:clear-logs', { target }),
  getWorkspace: () => ipcRenderer.invoke('console:get-workspace'),
  terminalCreate: (size?: { cols: number; rows: number }) =>
    ipcRenderer.invoke('console:terminal-create', size),
  terminalWrite: (sessionId: string, data: string) =>
    ipcRenderer.invoke('console:terminal-write', { sessionId, data }),
  terminalKill: (sessionId: string) =>
    ipcRenderer.invoke('console:terminal-kill', { sessionId }),
  terminalResize: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('console:terminal-resize', { sessionId, cols, rows }),
  onLogsUpdated: (
    callback: (payload: {
      playground: Array<{
        id: string;
        level: 'info' | 'success' | 'warn' | 'error';
        message: string;
        timestamp: number;
      }>;
      sui: Array<{ id: string; message: string; timestamp: number }>;
      ika: Array<{ id: string; message: string; timestamp: number }>;
    }) => void,
  ) => {
    const handler = (_event: unknown, payload: Parameters<typeof callback>[0]) =>
      callback(payload);
    ipcRenderer.on('console:logs-updated', handler);
    return () => ipcRenderer.removeListener('console:logs-updated', handler);
  },
  onTerminalData: (
    callback: (payload: {
      sessionId: string;
      data: string;
      stream: 'stdout' | 'stderr';
    }) => void,
  ) => {
    const handler = (_event: unknown, payload: Parameters<typeof callback>[0]) =>
      callback(payload);
    ipcRenderer.on('console:terminal-data', handler);
    return () => ipcRenderer.removeListener('console:terminal-data', handler);
  },
  onTerminalExit: (
    callback: (payload: { sessionId: string; code: number | null }) => void,
  ) => {
    const handler = (_event: unknown, payload: Parameters<typeof callback>[0]) =>
      callback(payload);
    ipcRenderer.on('console:terminal-exit', handler);
    return () => ipcRenderer.removeListener('console:terminal-exit', handler);
  },
  minimize: () => ipcRenderer.invoke('console-window-minimize'),
  maximize: () => ipcRenderer.invoke('console-window-maximize'),
  close: () => ipcRenderer.invoke('console-window-close'),
  isMaximized: () => ipcRenderer.invoke('console-window-is-maximized'),
});

contextBridge.exposeInMainWorld('skills', {
  listCatalog: () => ipcRenderer.invoke('skills:list-catalog'),
  list: () => ipcRenderer.invoke('skills:list'),
  get: (id: string) => ipcRenderer.invoke('skills:get', { id }),
  getMany: (ids: string[]) => ipcRenderer.invoke('skills:get-many', { ids }),
  create: (params: { name: string; description: string; content: string; id?: string }) =>
    ipcRenderer.invoke('skills:create', params),
  update: (id: string, patch: { name?: string; description?: string; content?: string }) =>
    ipcRenderer.invoke('skills:update', { id, patch }),
  delete: (id: string) => ipcRenderer.invoke('skills:delete', { id }),
  importFromCatalog: (catalogId: string) =>
    ipcRenderer.invoke('skills:import-from-catalog', { catalogId }),
});

contextBridge.exposeInMainWorld('playground', {
  checkCli: () => ipcRenderer.invoke('playground:check-cli'),
  getWorkspace: () => ipcRenderer.invoke('playground:get-workspace'),
  openWorkspace: () => ipcRenderer.invoke('playground:open-workspace'),
  runShellCommand: (command: string) =>
    ipcRenderer.invoke('playground:run-shell-command', { command }),
  syncWorkspace: (files: { path: string; content: string }[]) =>
    ipcRenderer.invoke('playground:sync-workspace', { files }),
  build: (files: { path: string; content: string }[]) =>
    ipcRenderer.invoke('playground:build', { files }),
  getClientStatus: () => ipcRenderer.invoke('playground:get-client-status'),
  initClient: () => ipcRenderer.invoke('playground:init-client'),
  switchEnv: (alias: string) =>
    ipcRenderer.invoke('playground:switch-env', { alias }),
  ensureLocalEnv: () => ipcRenderer.invoke('playground:ensure-local-env'),
  startLocalNetwork: (options?: {
    forceRegenesis?: boolean;
    withFaucet?: boolean;
    fullnodeRpcPort?: number;
    forIka?: boolean;
    epochDurationMs?: string;
  }) => ipcRenderer.invoke('playground:start-local-network', options),
  stopLocalNetwork: (options?: { stopIka?: boolean }) =>
    ipcRenderer.invoke('playground:stop-local-network', options),
  resetMoveSuiLocalnet: () =>
    ipcRenderer.invoke('playground:reset-move-sui-localnet'),
  getIkaLocalnetStatus: () =>
    ipcRenderer.invoke('playground:get-ika-localnet-status'),
  getIkaConfig: () => ipcRenderer.invoke('playground:get-ika-config'),
  ensureIkaRepo: () => ipcRenderer.invoke('playground:ensure-ika-repo'),
  startIkaLocalnet: (options?: { reset?: boolean }) =>
    ipcRenderer.invoke('playground:start-ika-localnet', options),
  healIkaLocalnet: () => ipcRenderer.invoke('playground:heal-ika-localnet'),
  needsIkaLocalnetHeal: () =>
    ipcRenderer.invoke('playground:needs-ika-localnet-heal'),
  stopIkaLocalnet: () => ipcRenderer.invoke('playground:stop-ika-localnet'),
  getLocalnetResumeStatus: () =>
    ipcRenderer.invoke('playground:get-localnet-resume-status'),
  getIkaLocalnetStackStatus: () =>
    ipcRenderer.invoke('playground:get-ika-localnet-stack-status'),
  startIkaLocalnetStack: () =>
    ipcRenderer.invoke('playground:start-ika-localnet-stack'),
  stopIkaLocalnetStack: () =>
    ipcRenderer.invoke('playground:stop-ika-localnet-stack'),
  resetIkaLocalnetStack: () =>
    ipcRenderer.invoke('playground:reset-ika-localnet-stack'),
  resetIkaLocalnetState: () =>
    ipcRenderer.invoke('playground:reset-ika-localnet-state'),
  getLocalNetworkStatus: () =>
    ipcRenderer.invoke('playground:get-local-network-status'),
  getLocalnetLogSnapshot: () =>
    ipcRenderer.invoke('playground:get-localnet-log-snapshot'),
  requestLocalFaucet: (recipient?: string) =>
    ipcRenderer.invoke('playground:request-local-faucet', { recipient }),
  getLocalNetworkStats: () => ipcRenderer.invoke('playground:get-local-network-stats'),
  getLocalNetworkOverview: () =>
    ipcRenderer.invoke('playground:get-local-network-overview'),
  getLocalCheckpoints: (params?: { limit?: number }) =>
    ipcRenderer.invoke('playground:get-local-checkpoints', params ?? {}),
  getLocalRecentTransactions: (params?: { limit?: number }) =>
    ipcRenderer.invoke('playground:get-local-recent-transactions', params ?? {}),
  getLocalTransactions: (params?: { address?: string; limit?: number }) =>
    ipcRenderer.invoke('playground:get-local-transactions', params ?? {}),
  getLocalTransactionDetail: (params: { digest: string }) =>
    ipcRenderer.invoke('playground:get-local-transaction-detail', params),
  getLocalAddressOverview: (params: { address: string }) =>
    ipcRenderer.invoke('playground:get-local-address-overview', params),
  getLocalObject: (params: { objectId: string }) =>
    ipcRenderer.invoke('playground:get-local-object', params),
  getIkaExplorerOverview: () =>
    ipcRenderer.invoke('playground:get-ika-explorer-overview'),
  getIkaRelatedTransactions: (params?: { limit?: number }) =>
    ipcRenderer.invoke('playground:get-ika-related-transactions', params ?? {}),
  ensureTestWallets: () => ipcRenderer.invoke('playground:ensure-test-wallets'),
  getTestWallets: () => ipcRenderer.invoke('playground:get-test-wallets'),
  setActiveSigner: (signerId: string) =>
    ipcRenderer.invoke('playground:set-active-signer', { signerId }),
  getActiveSigner: () => ipcRenderer.invoke('playground:get-active-signer'),
  signTransaction: (params: { signerId: string; transactionBytesB64: string }) =>
    ipcRenderer.invoke('playground:sign-transaction', params),
  onLocalnetLogs: (
    callback: (payload: { source: 'sui' | 'ika'; lines: string[] }) => void,
  ) => {
    const handler = (
      _event: unknown,
      payload: { source: 'sui' | 'ika'; lines: string[] },
    ) => callback(payload);
    ipcRenderer.on('localnet:logs', handler);
    return () => {
      ipcRenderer.removeListener('localnet:logs', handler);
    };
  },
});