interface StreamLogEntry {
  id: string;
  message: string;
  timestamp: number;
}

interface SuiAPI {
  generateWallet: () => Promise<{ success: boolean; address: string; publicKey: string; error?: string }>
  importWallet: (privateKey: string) => Promise<{ success: boolean; address: string; publicKey: string; error?: string }>
  getWalletInfo: () => Promise<{ success: boolean; address: string; publicKey: string } | null>
  exportPrivateKey: () => Promise<string>
  deleteWallet: () => Promise<void>
  getBalance: (params: { network?: string }) => Promise<{ success: boolean; balance: import('./types/wallet').SuiBalance; error?: string }>
  getTransactions: (params: { limit?: number; network?: string }) => Promise<{ success: boolean; transactions: import('./types/wallet').SuiTransaction[]; error?: string }>
  requestFaucet: (params: { network: 'testnet' | 'devnet' | 'localnet'; recipient: string }) => Promise<{ success: boolean; amountSui?: number; digest?: string | null; coinsSent?: number; error?: string }>
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
  tools: {
    fetchAddressGraph: (params: {
      address: string;
      network?: 'mainnet' | 'testnet' | 'devnet';
      limit?: number;
    }) => Promise<{
      address: string;
      edges: Array<{
        digest: string;
        from: string;
        to: string;
        amountSui: number;
        timestampMs: string | null;
        coinType: string;
      }>;
      counterparties: string[];
    }>;
    scanToken: (params: {
      input: string;
      network?: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
    }) => Promise<{
      coinType: string;
      packageId: string;
      metadata: {
        name: string;
        symbol: string;
        decimals: number;
        description: string;
        iconUrl: string | null;
      } | null;
      supply: {
        raw: string;
        formatted: string;
      } | null;
      treasuryCap: {
        exists: boolean;
        objectId: string | null;
        ownerType: string | null;
        ownerAddress: string | null;
        mintable: boolean;
      };
      packageInfo: {
        version: number | null;
        immutable: boolean;
        moduleCount: number;
        upgradeCapHeld: boolean;
        upgradeCapOwner: string | null;
      } | null;
      liquidity: {
        checked: boolean;
        hasRoutes: boolean;
        pools: Array<{
          dex: string;
          poolId: string;
          pair: string;
          locked: boolean | null;
          lockDetail: string;
        }>;
      };
      riskScore: number;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      signals: Array<{
        id: string;
        title: string;
        description: string;
        severity: 'info' | 'good' | 'warning' | 'danger';
      }>;
    }>;
    listGrpcQueryCatalog: () => Promise<{
      services: Array<{
        id: string;
        label: string;
        description: string;
      }>;
      presets: Array<{
        id: string;
        service: string;
        method: string;
        label: string;
        description: string;
        defaultRequest: Record<string, unknown>;
      }>;
    }>;
    executeGrpcQuery: (params: {
      network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
      service: string;
      method: string;
      request?: Record<string, unknown>;
      baseUrl?: string;
    }) => Promise<{
      ok: boolean;
      transport: 'grpc' | 'jsonrpc';
      endpoint: string;
      durationMs: number;
      response?: unknown;
      error?: string;
    }>;
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
    }) => Promise<{
      modules: string[];
      dependencies: string[];
      digest: number[];
      stdout: string;
      stderr: string;
      preview: {
        coinTypePlaceholder: string;
        files: Array<{ path: string; content: string }>;
        initialMintBaseUnits: string | null;
      };
    }>;
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
    }) => Promise<{
      modules: string[];
      dependencies: string[];
      digest: number[];
      stdout: string;
      stderr: string;
      preview: {
        nftTypePlaceholder: string;
        files: Array<{ path: string; content: string }>;
      };
    }>;
    prepareWalrusUpload: (params: {
      network: 'mainnet' | 'testnet';
      owner: string;
      fileName: string;
      contentBase64: string;
      epochs?: number;
    }) => Promise<{
      flowId: string;
      blobId: string;
      registerTxBytes: string;
      epochs: number;
      sizeBytes: number;
    }>;
    completeWalrusRegister: (params: {
      flowId: string;
      registerDigest: string;
    }) => Promise<{
      flowId: string;
      certifyTxBytes: string;
    }>;
    finalizeWalrusUpload: (params: { flowId: string }) => Promise<{
      id: string;
      fileName: string;
      blobId: string;
      blobObjectId: string;
      epochs: number;
      uploadedAt: number;
      network: 'mainnet' | 'testnet';
      sizeBytes: number;
    }>;
    prepareWalrusExtend: (params: {
      network: 'mainnet' | 'testnet';
      blobObjectId: string;
      epochs: number;
      sender: string;
    }) => Promise<{ txBytes: string }>;
    getWalrusBlobStatus: (params: {
      network: 'mainnet' | 'testnet';
      blobObjectId: string;
    }) => Promise<{
      blobId: string | null;
      storedEpochs: number | null;
      endEpoch: number | null;
      deletable: boolean | null;
    }>;
  };
  packages: {
    onToolchainProgress: (
      callback: (event: {
        job: string;
        phase: string;
        percent: number | null;
        message: string;
        detail?: string;
        recentLogs: string[];
      }) => void,
    ) => () => void;
    checkNpm: () => Promise<{ installed: boolean; version: string | null }>;
    getToolchainStatus: () => Promise<{
      rust: { installed: boolean; version: string | null; path: string | null };
      cargo: { installed: boolean; version: string | null; path: string | null };
      suiup: { installed: boolean; version: string | null; path: string | null };
      sui: { installed: boolean; version: string | null; path: string | null };
      platform: string;
      ika: {
        git: { installed: boolean; version: string | null; path: string | null };
        repo: { installed: boolean; path: string; version: string | null };
        binary: { installed: boolean; version: string | null; path: string | null };
        sdk: { installed: boolean; version: string | null; path: string | null };
        configReady: boolean;
        configPath: string | null;
        ready: boolean;
      };
    }>;
    installRust: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    installSuiup: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    installSuiCli: (method?: 'suiup' | 'brew') => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    updateRust: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    uninstallRust: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    updateSuiup: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    uninstallSuiup: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    updateSuiCli: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    uninstallSuiCli: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    installGit: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    updateGit: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    cloneIkaRepo: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    buildIkaBinary: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    updateIkaRepo: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    uninstallIkaRepo: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    rebuildIkaBinary: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    uninstallIkaBinary: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    installIkaSdk: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    updateIkaSdk: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    uninstallIkaSdk: () => Promise<{
      success: boolean;
      message: string;
      stdout: string;
      stderr: string;
    }>;
    listCatalog: () => Promise<Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
      docsUrl: string;
      installCommand: string;
      accent: string;
      source?: 'builtin' | 'custom';
      createdAt?: number;
      updatedAt?: number;
    }>>;
    listCustomPackages: () => Promise<Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
      docsUrl: string;
      installCommand: string;
      accent: string;
      source: 'custom';
      createdAt: number;
      updatedAt: number;
    }>>;
    createCustomPackage: (input: {
      name: string;
      description: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      category?: string;
      docsUrl?: string;
      accent?: string;
      id?: string;
    }) => Promise<{
      id: string;
      name: string;
      description: string;
      category: string;
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
      docsUrl: string;
      installCommand: string;
      accent: string;
      source: 'custom';
      createdAt: number;
      updatedAt: number;
    }>;
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
    ) => Promise<{
      id: string;
      name: string;
      description: string;
      category: string;
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
      docsUrl: string;
      installCommand: string;
      accent: string;
      source: 'custom';
      createdAt: number;
      updatedAt: number;
    }>;
    deleteCustomPackage: (id: string) => Promise<boolean>;
    listInstalled: () => Promise<Array<{
      id: string;
      installedAt: number;
      updatedAt: number;
      versions: Record<string, string>;
      path: string;
    }>>;
    install: (id: string) => Promise<{
      id: string;
      installedAt: number;
      updatedAt: number;
      versions: Record<string, string>;
      path: string;
    }>;
    update: (id: string) => Promise<{
      id: string;
      installedAt: number;
      updatedAt: number;
      versions: Record<string, string>;
      path: string;
    }>;
    uninstall: (id: string) => Promise<boolean>;
    installToProject: (projectPath: string, packageIds: string[]) => Promise<boolean>;
    cancelJob: (jobId: string) => Promise<boolean>;
    listActiveJobs: () => Promise<string[]>;
  };
  belugaConsole: {
    open: () => Promise<{ ok: boolean }>;
    getSnapshot: () => Promise<{
      playground: Array<{
        id: string;
        level: 'info' | 'success' | 'warn' | 'error';
        message: string;
        timestamp: number;
      }>;
      sui: StreamLogEntry[];
      ika: StreamLogEntry[];
    }>;
    appendPlaygroundLog: (entry: {
      id?: string;
      level: 'info' | 'success' | 'warn' | 'error';
      message: string;
      timestamp: number;
    }) => Promise<{ ok: boolean }>;
    clearLogs: (target?: 'all' | 'playground' | 'sui' | 'ika') => Promise<{ ok: boolean }>;
    getWorkspace: () => Promise<string>;
    terminalCreate: (size?: { cols: number; rows: number }) => Promise<{
      id: string;
      cwd: string;
      shell: string;
      createdAt: number;
    }>;
    terminalWrite: (sessionId: string, data: string) => Promise<{ ok: boolean }>;
    terminalKill: (sessionId: string) => Promise<{ ok: boolean }>;
    terminalResize: (
      sessionId: string,
      cols: number,
      rows: number,
    ) => Promise<{ ok: boolean }>;
    onLogsUpdated: (
      callback: (payload: {
        playground: Array<{
          id: string;
          level: 'info' | 'success' | 'warn' | 'error';
          message: string;
          timestamp: number;
        }>;
        sui: StreamLogEntry[];
        ika: StreamLogEntry[];
      }) => void,
    ) => () => void;
    onTerminalData: (
      callback: (payload: {
        sessionId: string;
        data: string;
        stream: 'stdout' | 'stderr';
      }) => void,
    ) => () => void;
    onTerminalExit: (
      callback: (payload: { sessionId: string; code: number | null }) => void,
    ) => () => void;
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  skills: {
    listCatalog: () => Promise<Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      accent: string;
      source?: 'builtin' | 'walrus-official';
    }>>;
    list: () => Promise<Array<{
      id: string;
      name: string;
      description: string;
      content: string;
      source: 'builtin' | 'custom';
      catalogId: string | null;
      createdAt: number;
      updatedAt: number;
    }>>;
    get: (id: string) => Promise<{
      id: string;
      name: string;
      description: string;
      content: string;
      source: 'builtin' | 'custom';
      catalogId: string | null;
      createdAt: number;
      updatedAt: number;
    } | null>;
    getMany: (ids: string[]) => Promise<Array<{
      id: string;
      name: string;
      description: string;
      content: string;
      source: 'builtin' | 'custom';
      catalogId: string | null;
      createdAt: number;
      updatedAt: number;
    }>>;
    create: (params: {
      name: string;
      description: string;
      content: string;
      id?: string;
    }) => Promise<{
      id: string;
      name: string;
      description: string;
      content: string;
      source: 'builtin' | 'custom';
      catalogId: string | null;
      createdAt: number;
      updatedAt: number;
    }>;
    update: (
      id: string,
      patch: { name?: string; description?: string; content?: string },
    ) => Promise<{
      id: string;
      name: string;
      description: string;
      content: string;
      source: 'builtin' | 'custom';
      catalogId: string | null;
      createdAt: number;
      updatedAt: number;
    }>;
    delete: (id: string) => Promise<{ ok: boolean }>;
    importFromCatalog: (catalogId: string) => Promise<{
      id: string;
      name: string;
      description: string;
      content: string;
      source: 'builtin' | 'custom';
      catalogId: string | null;
      createdAt: number;
      updatedAt: number;
    }>;
  };
  playground: {
    checkCli: () => Promise<{
      installed: boolean;
      version: string | null;
      path: string | null;
    }>;
    getWorkspace: () => Promise<string>;
    openWorkspace: () => Promise<string>;
    runShellCommand: (command: string) => Promise<{
      stdout: string;
      stderr: string;
      exitCode: number;
    }>;
    syncWorkspace: (files: { path: string; content: string }[]) => Promise<string>;
    build: (files: { path: string; content: string }[]) => Promise<{
      modules: string[];
      dependencies: string[];
      digest: number[];
      stdout: string;
      stderr: string;
    }>;
    getClientStatus: () => Promise<{
      configured: boolean;
      configPath: string;
      activeEnv: string | null;
      activeAddress: string | null;
      environments: Array<{
        alias: string;
        rpc: string;
        active: boolean;
      }>;
    }>;
    initClient: () => Promise<{ message: string }>;
    switchEnv: (alias: string) => Promise<{ message: string }>;
    ensureLocalEnv: () => Promise<{ message: string; created: boolean }>;
    startLocalNetwork: (options?: {
      forceRegenesis?: boolean;
      withFaucet?: boolean;
      fullnodeRpcPort?: number;
      forIka?: boolean;
      epochDurationMs?: string;
    }) => Promise<{
      running: boolean;
      rpcReady: boolean;
      managed: boolean;
      pid: number | null;
      rpcUrl: string;
      faucetUrl: string;
      startedAt: number | null;
      recentLogs: string[];
      chainReset?: boolean;
      persistedGenesisReady?: boolean;
      forIka?: boolean;
    }>;
    stopLocalNetwork: (options?: { stopIka?: boolean }) => Promise<{
      running: boolean;
      rpcReady: boolean;
      managed: boolean;
      pid: number | null;
      rpcUrl: string;
      faucetUrl: string;
      startedAt: number | null;
      recentLogs: string[];
      chainReset?: boolean;
      persistedGenesisReady?: boolean;
      forIka?: boolean;
    }>;
    resetMoveSuiLocalnet: () => Promise<{
      running: boolean;
      rpcReady: boolean;
      managed: boolean;
      pid: number | null;
      rpcUrl: string;
      faucetUrl: string;
      startedAt: number | null;
      recentLogs: string[];
      chainReset?: boolean;
      persistedGenesisReady?: boolean;
      forIka?: boolean;
    }>;
    getLocalNetworkStatus: () => Promise<{
      running: boolean;
      rpcReady: boolean;
      managed: boolean;
      pid: number | null;
      rpcUrl: string;
      faucetUrl: string;
      startedAt: number | null;
      recentLogs: string[];
      chainReset?: boolean;
      persistedGenesisReady?: boolean;
      forIka?: boolean;
    }>;
    getIkaLocalnetStatus: () => Promise<{
      running: boolean;
      configReady: boolean;
      networkDkgReady: boolean;
      dwalletReady: boolean;
      coordinatorEpoch: string | null;
      suiCheckpointLag: number | null;
      encryptionKeyState: string | null;
      dkgChunkCount: number;
      readinessHint: string | null;
      resumeAvailable: boolean;
      stateOutOfSync: boolean;
      pid: number | null;
      repoPath: string;
      repoReady: boolean;
      startedAt: number | null;
      recentLogs: string[];
    }>;
    getLocalnetResumeStatus: () => Promise<{
      ikaConfigReady: boolean;
      ikaNetworkConfigReady: boolean;
      configMatchesPersisted: boolean;
      suiGenesisReady: boolean;
      canResumeSui: boolean;
      canResumeIka: boolean;
      suiCheckpointLag: number | null;
      session: {
        coordinatorObjectId: string;
        suiChainId: string | null;
        networkDkgReady: boolean;
        savedAt: number;
      } | null;
      toolchainWritable: boolean;
      toolchainRoot: string;
    }>;
    getIkaLocalnetStackStatus: () => Promise<{
      phase: "stopped" | "starting" | "bootstrapping" | "dkg" | "ready" | "error";
      label: string;
      sui: {
        running: boolean;
        rpcReady: boolean;
        managed: boolean;
        pid: number | null;
        rpcUrl: string;
        faucetUrl: string;
        startedAt: number | null;
        recentLogs: string[];
        chainReset?: boolean;
        persistedGenesisReady?: boolean;
      };
      ika: {
        running: boolean;
        configReady: boolean;
        networkDkgReady: boolean;
        dwalletReady: boolean;
        coordinatorEpoch: string | null;
        suiCheckpointLag: number | null;
        encryptionKeyState: string | null;
        dkgChunkCount: number;
        readinessHint: string | null;
        resumeAvailable: boolean;
        stateOutOfSync: boolean;
        pid: number | null;
        repoPath: string;
        repoReady: boolean;
        startedAt: number | null;
        recentLogs: string[];
      };
    }>;
    startIkaLocalnetStack: () => Promise<{
      message: string;
      sui: {
        running: boolean;
        rpcReady: boolean;
        managed: boolean;
        pid: number | null;
        rpcUrl: string;
        faucetUrl: string;
        startedAt: number | null;
        recentLogs: string[];
      };
      ika: {
        running: boolean;
        configReady: boolean;
        networkDkgReady: boolean;
        dwalletReady: boolean;
        readinessHint: string | null;
        resumeAvailable: boolean;
        recentLogs: string[];
      };
    }>;
    stopIkaLocalnetStack: () => Promise<{
      message: string;
      sui: {
        running: boolean;
        rpcReady: boolean;
        managed: boolean;
        pid: number | null;
        rpcUrl: string;
        faucetUrl: string;
        startedAt: number | null;
        recentLogs: string[];
      };
      ika: {
        running: boolean;
        configReady: boolean;
        networkDkgReady: boolean;
        dwalletReady: boolean;
        recentLogs: string[];
      };
    }>;
    resetIkaLocalnetStack: () => Promise<{
      message: string;
      sui: {
        running: boolean;
        rpcReady: boolean;
        managed: boolean;
        pid: number | null;
        rpcUrl: string;
        faucetUrl: string;
        startedAt: number | null;
        recentLogs: string[];
      };
      ika: {
        running: boolean;
        configReady: boolean;
        networkDkgReady: boolean;
        dwalletReady: boolean;
        recentLogs: string[];
      };
    }>;
    startIkaLocalnet: (options?: { reset?: boolean }) => Promise<{
      running: boolean;
      configReady: boolean;
      networkDkgReady: boolean;
      dwalletReady: boolean;
      coordinatorEpoch: string | null;
      suiCheckpointLag: number | null;
      encryptionKeyState: string | null;
      dkgChunkCount: number;
      readinessHint: string | null;
      resumeAvailable: boolean;
      stateOutOfSync: boolean;
      pid: number | null;
      repoPath: string;
      repoReady: boolean;
      startedAt: number | null;
      recentLogs: string[];
    }>;
    resetIkaLocalnetState: () => Promise<{ message: string }>;
    healIkaLocalnet: () => Promise<{
      message: string;
      ikaStatus: {
        running: boolean;
        configReady: boolean;
        networkDkgReady: boolean;
        dwalletReady: boolean;
        coordinatorEpoch: string | null;
        suiCheckpointLag: number | null;
        encryptionKeyState: string | null;
        dkgChunkCount: number;
        readinessHint: string | null;
        resumeAvailable: boolean;
        stateOutOfSync: boolean;
        pid: number | null;
        repoPath: string;
        repoReady: boolean;
        startedAt: number | null;
        recentLogs: string[];
      };
      localStatus: {
        running: boolean;
        rpcReady: boolean;
        managed: boolean;
        pid: number | null;
        rpcUrl: string;
        faucetUrl: string;
        startedAt: number | null;
        recentLogs: string[];
      };
    }>;
    needsIkaLocalnetHeal: () => Promise<{
      needed: boolean;
      reason: string | null;
      suiCheckpointLag: number | null;
    }>;
    getIkaConfig: () => Promise<{
      ready: boolean;
      path: string | null;
      config: {
        packages: {
          ika_package_id: string;
          ika_common_package_id: string;
          ika_dwallet_2pc_mpc_package_id: string;
          ika_dwallet_2pc_mpc_package_id_v2?: string;
          ika_system_package_id: string;
          ika_system_original_package_id?: string;
          ika_dwallet_2pc_mpc_original_package_id?: string;
        };
        objects: {
          ika_system_object_id: string;
          ika_dwallet_coordinator_object_id: string;
        };
      } | null;
    }>;
    ensureIkaRepo: () => Promise<{
      message: string;
      cloned: boolean;
      repoPath: string;
    }>;
    stopIkaLocalnet: () => Promise<{
      running: boolean;
      configReady: boolean;
      networkDkgReady: boolean;
      dwalletReady: boolean;
      coordinatorEpoch: string | null;
      suiCheckpointLag: number | null;
      encryptionKeyState: string | null;
      dkgChunkCount: number;
      readinessHint: string | null;
      resumeAvailable: boolean;
      stateOutOfSync: boolean;
      pid: number | null;
      repoPath: string;
      repoReady: boolean;
      startedAt: number | null;
      recentLogs: string[];
    }>;
    requestLocalFaucet: (recipient?: string) => Promise<{ message: string }>;
    getLocalNetworkStats: () => Promise<{
      totalTransactions: string | null;
      latestCheckpoint: string | null;
      rpcUrl: string;
    }>;
    getLocalNetworkOverview: () => Promise<{
      totalTransactions: string | null;
      latestCheckpoint: string | null;
      epoch: string | null;
      epochDurationMs: string | null;
      referenceGasPrice: string | null;
      chainId: string | null;
      rpcUrl: string;
      faucetUrl: string;
      running: boolean;
      pid: number | null;
      startedAt: number | null;
    }>;
    getLocalCheckpoints: (params?: { limit?: number }) => Promise<Array<{
      sequenceNumber: string;
      digest: string;
      timestampMs: string | null;
      transactionCount: number;
      networkTotalTransactions: string | null;
    }>>;
    getLocalRecentTransactions: (params?: { limit?: number }) => Promise<Array<{
      digest: string;
      timestampMs: string | null;
      sender: string | null;
      status: string | null;
      gasUsed: string | null;
      checkpoint: string | null;
      kind: string | null;
    }>>;
    getLocalTransactions: (params?: {
      address?: string;
      limit?: number;
    }) => Promise<Array<{
      digest: string;
      timestampMs: string | null;
      sender: string | null;
      status: string | null;
      gasUsed: string | null;
      checkpoint: string | null;
      kind: string | null;
    }>>;
    getLocalTransactionDetail: (params: { digest: string }) => Promise<{
      digest: string;
      timestampMs: string | null;
      sender: string | null;
      status: string | null;
      gasUsed: string | null;
      checkpoint: string | null;
      kind: string | null;
      error: string | null;
      computationCost: string | null;
      storageCost: string | null;
      storageRebate: string | null;
      commandCount: number;
      objectChanges: Array<{
        type: string;
        objectId: string | null;
        packageId: string | null;
        objectType: string | null;
      }>;
      events: Array<{
        packageId: string;
        module: string;
        type: string;
        sender: string | null;
        parsedJson: unknown | null;
        eventSeq: string | null;
      }>;
    }>;
    getLocalAddressOverview: (params: { address: string }) => Promise<{
      address: string;
      balanceSui: number;
      coinCount: number;
      objectCount: number;
    }>;
    getLocalObject: (params: { objectId: string }) => Promise<{
      objectId: string;
      version: string | null;
      digest: string | null;
      objectType: string | null;
      owner: string | null;
      content: string | null;
    }>;
    getIkaExplorerOverview: () => Promise<{
      rpcReady: boolean;
      rpcUrl: string;
      chainId: string | null;
      suiEpoch: string | null;
      latestCheckpoint: string | null;
      totalTransactions: string | null;
      configPath: string | null;
      config: {
        packages: {
          ika_package_id: string;
          ika_common_package_id: string;
          ika_dwallet_2pc_mpc_package_id: string;
          ika_dwallet_2pc_mpc_package_id_v2?: string;
          ika_system_package_id: string;
          ika_system_original_package_id?: string;
          ika_dwallet_2pc_mpc_original_package_id?: string;
        };
        objects: {
          ika_system_object_id: string;
          ika_dwallet_coordinator_object_id: string;
        };
      } | null;
      persistedSystemId: string | null;
      persistedCoordinatorId: string | null;
      configMatchesPersisted: boolean;
      ikaRunning: boolean;
      ikaPid: number | null;
      networkDkgReady: boolean;
      resumeAvailable: boolean;
      stateOutOfSync: boolean;
      canResumeIka: boolean;
      sessionSavedAt: number | null;
      objects: {
        system: {
          objectId: string;
          exists: boolean;
          version: string | null;
          objectType: string | null;
          innerObjectId: string | null;
          innerFields: Record<string, string | null>;
        } | null;
        coordinator: {
          objectId: string;
          exists: boolean;
          version: string | null;
          objectType: string | null;
          innerObjectId: string | null;
          innerFields: Record<string, string | null>;
        } | null;
      };
      dkg: {
        ready: boolean;
        coordinatorInnerId: string | null;
        keysTableId: string | null;
        encryptionKeyCount: number;
        totalChunkCount: number;
        encryptionKeys: Array<{
          objectId: string;
          dkgAtEpoch: string | null;
          state: string | null;
          chunkCount: number;
          dkgTableId: string | null;
          supportedCurves: string | null;
        }>;
      };
      packages: Array<{ label: string; packageId: string }>;
      coordinatorDynamicFieldCount: number;
      fetchedAt: number;
    }>;
    getIkaRelatedTransactions: (params?: { limit?: number }) => Promise<Array<{
      digest: string;
      timestampMs: string | null;
      sender: string | null;
      status: string | null;
      gasUsed: string | null;
      checkpoint: string | null;
      kind: string | null;
      ikaRelated: boolean;
      ikaPackageHits: string[];
    }>>;
    ensureTestWallets: () => Promise<{
      wallets: Array<{
        id: `test-${number}`;
        label: string;
        address: string;
        secretKey: string;
      }>;
      funded: boolean;
    }>;
    getTestWallets: () => Promise<{
      activeSignerId: "beluga" | `test-${number}`;
      signers: Array<{
        id: "beluga" | `test-${number}`;
        label: string;
        address: string;
        balanceSui: number | null;
        isBeluga: boolean;
      }>;
    }>;
    setActiveSigner: (signerId: "beluga" | `test-${number}`) => Promise<{
      activeSignerId: "beluga" | `test-${number}`;
      address: string | null;
    }>;
    getActiveSigner: () => Promise<{
      activeSignerId: "beluga" | `test-${number}`;
      address: string | null;
    }>;
    signTransaction: (params: {
      signerId: "beluga" | `test-${number}`;
      transactionBytesB64: string;
    }) => Promise<{
      success: boolean;
      signature?: string;
      bytes?: string;
      error?: string;
    }>;
    onLocalnetLogs: (
      callback: (payload: {
        source: "sui" | "ika";
        lines: StreamLogEntry[];
      }) => void,
    ) => () => void;
    getLocalnetLogSnapshot: () => Promise<{
      sui: StreamLogEntry[];
      ika: StreamLogEntry[];
    }>;
  };
  belugaAi: {
    getStatus: () => Promise<{
      enabled: boolean;
      authMode: 'grok-build' | 'api-key';
      model: string;
      includePageContext: boolean;
      allowToolUse: boolean;
      hasApiKey: boolean;
      hasGrokAuth: boolean;
      hasAuth: boolean;
      keyHint: string | null;
      grokEmail: string | null;
      grokAuthSource: 'beluga' | 'grok-cli' | null;
    }>;
    testConnection: (params?: {
      apiKey?: string;
      model?: string;
      authMode?: 'grok-build' | 'api-key';
    }) => Promise<{ ok: boolean; message: string; suggestedModel?: string }>;
    oauthStart: () => Promise<{ ok: boolean; authUrl?: string; message?: string }>;
    oauthExchangeCode: (code: string) => Promise<{ ok: boolean; message: string }>;
    oauthStatus: () => Promise<{
      connected: boolean;
      email: string | null;
      expiresAt: string | null;
      source: 'beluga' | 'grok-cli' | null;
    }>;
    oauthLogout: () => Promise<{ ok: boolean }>;
    onOauthComplete: (
      callback: (payload: { ok: boolean; message: string }) => void,
    ) => () => void;
    chat: (params: {
      requestId: string;
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      pageContext?: string;
    }) => Promise<{ ok: boolean }>;
    abort: (requestId: string) => Promise<{ ok: boolean }>;
    onStreamChunk: (
      callback: (payload: { requestId: string; delta: string }) => void,
    ) => () => void;
    onStreamDone: (
      callback: (payload: {
        requestId: string;
        usage: { promptTokens: number; completionTokens: number } | null;
      }) => void,
    ) => () => void;
    onStreamError: (
      callback: (payload: { requestId: string; message: string }) => void,
    ) => () => void;
    onToolCall: (
      callback: (payload: {
        requestId: string;
        toolCallId: string;
        toolName: string;
        args: Record<string, unknown>;
        argsDisplay: string;
      }) => void,
    ) => () => void;
    onToolResult: (
      callback: (payload: {
        requestId: string;
        toolCallId: string;
        toolName: string;
        result: string;
      }) => void,
    ) => () => void;
  };
  belugaGitHub: {
    getStatus: () => Promise<{
      connected: boolean;
      login: string | null;
      scope: string | null;
      source: "oauth" | "pat" | "device" | null;
      gitInstalled: boolean;
      clientId: string;
      hasClientSecret: boolean;
    }>;
    verify: () => Promise<{ ok: boolean; login?: string; message: string }>;
    logout: () => Promise<{ ok: boolean }>;
    savePat: (token: string) => Promise<{ ok: boolean; message: string }>;
    oauthStart: () => Promise<{ ok: boolean; message?: string }>;
    deviceStart: () => Promise<{
      ok: boolean;
      message?: string;
      userCode?: string;
      verificationUri?: string;
    }>;
    devicePoll: () => Promise<{ ok: boolean; pending: boolean; message: string }>;
    listRepos: (page?: number) => Promise<
      Array<{
        name: string;
        full_name: string;
        private: boolean;
        html_url: string;
        default_branch: string;
      }>
    >;
    projectStatus: (projectName: string) => Promise<unknown>;
    createRepo: (params: {
      projectName: string;
      repoName?: string;
      description?: string;
      private?: boolean;
      push?: boolean;
    }) => Promise<unknown>;
    connectRepo: (params: {
      projectName: string;
      owner: string;
      repo: string;
      push?: boolean;
    }) => Promise<unknown>;
    setRepoVisibility: (projectName: string, isPrivate: boolean) => Promise<unknown>;
    gitInit: (projectName: string, branch?: string) => Promise<unknown>;
    gitAdd: (projectName: string, paths?: string[]) => Promise<unknown>;
    gitCommit: (projectName: string, message: string) => Promise<unknown>;
    gitPush: (projectName: string, branch?: string) => Promise<unknown>;
    gitPull: (projectName: string, branch?: string) => Promise<unknown>;
    gitFetch: (projectName: string) => Promise<unknown>;
    gitMerge: (projectName: string, branch: string, message?: string) => Promise<unknown>;
    gitBranches: (projectName: string) => Promise<string[]>;
    gitCheckout: (projectName: string, branch: string) => Promise<unknown>;
    gitBranchCreate: (
      projectName: string,
      branch: string,
      checkout?: boolean,
    ) => Promise<unknown>;
    gitLog: (
      projectName: string,
      limit?: number,
    ) => Promise<
      Array<{ hash: string; subject: string; author: string; date: string }>
    >;
    onOauthComplete: (
      callback: (payload: { ok: boolean; message: string }) => void,
    ) => () => void;
  };
}