/**
 * wallet-connect-server.ts
 * Electron main process — Sui/Slush wallet connect böngészőn keresztül
 */

import { shell, app, ipcMain } from 'electron';
import * as http from 'http';
import * as crypto from 'crypto';

const PORT         = 54321;
const FRONTEND_URL = 'https://wal-electron-app-web.vercel.app'; //http://localhost:5173 ha dev modeban ha nem akkor url és vercel

// ─── State ────────────────────────────────────────────────────────────────────

export interface WalletConnectResult {
  address: string;
}

let pendingResolve  : ((r: WalletConnectResult) => void) | null = null;
let pendingReject   : ((e: Error) => void) | null = null;
let pendingNonce    : string | null = null;
let server          : http.Server | null = null;
let connectTimeout  : ReturnType<typeof setTimeout> | null = null;
let lastHandledNonce: string | null = null;
let ipcBusy         : boolean = false; // párhuzamos IPC hívás guard

// ─── Deep link ────────────────────────────────────────────────────────────────

export function registerDeepLinkHandler(): void {
  // macOS
  app.on('open-url', (event, url) => {
    event.preventDefault();
    console.log('[open-url]', url);
    handleDeepLink(url);
  });

  // Windows
  app.on('second-instance', (_event, argv) => {
    console.log('[second-instance] argv:', argv);
    const url = argv.find(a => a.startsWith('myapp://'));
    if (url) handleDeepLink(url);
  });
}

function handleDeepLink(url: string): void {
  console.log('[deeplink] url:', url);
  console.log('[deeplink] pendingNonce:', pendingNonce);
  console.log('[deeplink] lastHandledNonce:', lastHandledNonce);

  try {
    const parsed = new URL(url);

    // myapp://callback/ vagy myapp://callback
    const isCallback = parsed.host === 'callback';
    if (!isCallback) {
      console.log('[deeplink] nem callback, host:', parsed.host);
      return;
    }

    const address = parsed.searchParams.get('address');
    const nonce   = parsed.searchParams.get('nonce');

    console.log('[deeplink] address:', address);
    console.log('[deeplink] nonce:', nonce);

    if (!address || !nonce) {
      console.log('[deeplink] hiányzó paraméterek');
      pendingReject?.(new Error('Hiányzó paraméterek a callback URL-ben'));
      cleanup();
      return;
    }

    // Duplikált callback védelem — ugyanazzal a nonce-szal már feldolgoztuk
    if (nonce === lastHandledNonce) {
      console.log('[deeplink] duplikált callback, eldobva');
      return;
    }

    // Nincs aktív kérés
    if (!pendingNonce || !pendingResolve) {
      console.log('[deeplink] nincs aktív kérés, eldobva');
      return;
    }

    // Nonce mismatch
    if (nonce !== pendingNonce) {
      console.log('[deeplink] NONCE MISMATCH:', nonce, '!==', pendingNonce);
      // Ne reject-eljük, csak eldobjuk — lehet régi böngésző tab küldte
      return;
    }

    // Siker
    console.log('[deeplink] sikeres callback, address:', address);
    lastHandledNonce = nonce;
    const resolve = pendingResolve;
    cleanup();
    resolve({ address });

  } catch (e) {
    console.log('[deeplink] hiba:', e);
    pendingReject?.(e instanceof Error ? e : new Error(String(e)));
    cleanup();
  }
}

// ─── HTTP szerver ─────────────────────────────────────────────────────────────

function startServer(nonce: string): Promise<string> {
  return new Promise((resolve, reject) => {
    stopServer();

    server = http.createServer((req, res) => {
      const target = `${FRONTEND_URL}/connect?nonce=${encodeURIComponent(nonce)}`;
      res.writeHead(302, { Location: target });
      res.end();
    });

    server.listen(PORT, 'localhost', () => {
      resolve(`http://localhost:${PORT}`);
    });

    server.on('error', reject);
  });
}

export function stopServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

function cleanup(): void {
  if (connectTimeout) {
    clearTimeout(connectTimeout);
    connectTimeout = null;
  }
  pendingResolve = null;
  pendingReject  = null;
  pendingNonce   = null;
  stopServer();
  // lastHandledNonce itt NEM nullázódik — ez véd a duplikált callbackek ellen
  // ipcBusy itt NEM nullázódik — azt az IPC handler kezeli
}

// ─── Fő belépési pont ─────────────────────────────────────────────────────────

export async function startWalletConnect(): Promise<WalletConnectResult> {
  // Előző pending kérés leállítása
  if (pendingReject) {
    const reject = pendingReject;
    cleanup();
    reject(new Error('Új kapcsolódási kérés érkezett'));
  } else {
    cleanup();
  }

  // Reset a lastHandledNonce-t, mert ez új connect session
  lastHandledNonce = null;

  await new Promise(r => setTimeout(r, 50));

  pendingNonce = crypto.randomBytes(16).toString('hex');
  console.log('[wallet-connect] új nonce:', pendingNonce);

  const url = await startServer(pendingNonce);
  console.log('[wallet-connect] szerver elindítva:', url);

  return new Promise<WalletConnectResult>((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject  = reject;

    shell.openExternal(url);

    connectTimeout = setTimeout(() => {
      console.log('[wallet-connect] timeout');
      const r = pendingReject;
      cleanup();
      r?.(new Error('Wallet connect timeout (5 perc)'));
    }, 5 * 60 * 1000);
  });
}

// ─── IPC regisztráció ─────────────────────────────────────────────────────────

export function registerWalletConnectIPC(): void {
  ipcMain.handle('wallet:connect', async () => {
    // Ha már fut egy connect, ne indítsunk újat
    if (ipcBusy) {
      console.log('[ipc] wallet:connect már folyamatban, visszautasítva');
      throw new Error('Wallet connect már folyamatban van');
    }

    ipcBusy = true;
    try {
      const result = await startWalletConnect();
      return result;
    } finally {
      ipcBusy = false;
    }
  });
}