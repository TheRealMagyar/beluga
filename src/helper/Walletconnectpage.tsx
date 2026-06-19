// WalletConnectPage.tsx
import { useEffect } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import '@mysten/dapp-kit/dist/index.css';

const SCHEME = 'myapp'; // egyezzen az Electron app.setAsDefaultProtocolClient() argumentumával

export function WalletConnectPage() {
  const account = useCurrentAccount();

  // Ha van account, visszaküldjük az Electron appnak deep linken
  useEffect(() => {
    if (!account?.address) return;

    const params = new URLSearchParams(window.location.search);
    const nonce  = params.get('nonce');
    if (!nonce) return;

    const callbackUrl =
      `${SCHEME}://callback` +
      `?address=${encodeURIComponent(account.address)}` +
      `&nonce=${encodeURIComponent(nonce)}`;

    window.location.href = callbackUrl;
  }, [account?.address]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>🦭</div>
        <h1 style={styles.h1}>Walrus Memory</h1>
        <p style={styles.sub}>Csatlakoztasd a Sui walletted az alkalmazáshoz.</p>

        {account ? (
          <div style={styles.connected}>
            <div style={styles.checkmark}>✓</div>
            <div style={styles.addressLabel}>Visszairányítás...</div>
            <div style={styles.address}>{account.address}</div>
          </div>
        ) : (
          <ConnectButton style={styles.connectBtn} />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: '#0f0f13',
    color: '#e8e8f0',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    background: '#1a1a24',
    border: '1px solid #2a2a3a',
    borderRadius: 20,
    padding: 40,
    maxWidth: 400,
    width: '90%',
    textAlign: 'center',
  },
  logo:         { fontSize: 52, marginBottom: 20 },
  h1:           { fontSize: 20, fontWeight: 700, margin: 0 },
  sub:          { color: '#8888aa', fontSize: 13, lineHeight: 1.6, margin: '8px 0 28px' },
  connectBtn:   { width: '100%', padding: '14px 18px', fontSize: 15, fontWeight: 600, borderRadius: 12 },
  connected:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  checkmark:    { fontSize: 36, color: '#00d4aa' },
  addressLabel: { fontSize: 13, color: '#00d4aa', fontWeight: 600 },
  address:      { fontSize: 11, color: '#8888aa', fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 4 },
};