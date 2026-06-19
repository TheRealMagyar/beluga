import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { Balance, Transaction, WalletInfo } from '../types/wallet'

const POLL_INTERVAL_MS = 30_000  // 30 másodpercenként frissít

interface WalletContextValue {
  walletInfo:   WalletInfo | null
  balance:      Balance | null
  transactions: Transaction[]
  loading:      boolean         // első betöltés
  refreshing:   boolean         // háttér frissítés
  lastUpdated:  Date | null
  setWalletInfo: (info: WalletInfo | null) => void
  refresh:      () => Promise<void>
  logout:       () => Promise<void>
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider')
  return ctx
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletInfo,   setWalletInfoState] = useState<WalletInfo | null>(null)
  const [balance,      setBalance]         = useState<Balance | null>(null)
  const [transactions, setTransactions]    = useState<Transaction[]>([])
  const [loading,      setLoading]         = useState(true)   // kezdeti állapot
  const [refreshing,   setRefreshing]      = useState(false)  // háttér frissítés
  const [lastUpdated,  setLastUpdated]     = useState<Date | null>(null)

  const pollerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const walletRef    = useRef<WalletInfo | null>(null)  // mindig aktuális érték a closure-okban

  // ── Adatok betöltése ────────────────────────────────────────────────────────
  const fetchData = useCallback(async (isBackground = false) => {
    if (!walletRef.current?.address) return
    if (isBackground) setRefreshing(true)

    try {
      const [balRes, txRes] = await Promise.all([
        window.sui.getBalance({ network: 'mainnet' }),
        window.sui.getTransactions({ limit: 20 }),
      ])
      if (balRes.success) setBalance(balRes.balance)
      if (txRes.success)  setTransactions(txRes.transactions)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('[WalletContext] fetch error:', err)
    } finally {
      if (isBackground) setRefreshing(false)
    }
  }, [])

  // ── Polling indítása / leállítása ───────────────────────────────────────────
  function startPolling() {
    stopPolling()
    pollerRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS)
  }

  function stopPolling() {
    if (pollerRef.current) {
      clearInterval(pollerRef.current)
      pollerRef.current = null
    }
  }

  // ── Wallet info beállítása (setup / login után) ─────────────────────────────
  function setWalletInfo(info: WalletInfo | null) {
    walletRef.current = info
    setWalletInfoState(info)
    if (info) {
      fetchData(false).then(startPolling)
    } else {
      stopPolling()
      setBalance(null)
      setTransactions([])
      setLastUpdated(null)
    }
  }

  // ── Manuális frissítés (pull-to-refresh gomb) ───────────────────────────────
  const refresh = useCallback(async () => {
    await fetchData(true)
    // Poller resetelése: az intervallum újra 30s-ról indul frissítés után
    startPolling()
  }, [fetchData])

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await window.sui.deleteWallet()
    setWalletInfo(null)
  }, [])

  // ── App induláskor: wallet létezik-e már? ───────────────────────────────────
  useEffect(() => {
    window.sui?.getWalletInfo?.()
      .then((res: any) => {
        if (res?.address) {
          const info = { address: res.address, publicKey: res.publicKey }
          walletRef.current = info
          setWalletInfoState(info)
          return fetchData(false)
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false)
        if (walletRef.current) startPolling()
      })

    return () => stopPolling()
  }, [])

  // ── Visibility change: ha visszatér a tab, azonnal frissít ─────────────────
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && walletRef.current) {
        fetchData(true)
        startPolling()
      } else {
        stopPolling()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchData])

  return (
    <WalletContext.Provider value={{
      walletInfo,
      balance,
      transactions,
      loading,
      refreshing,
      lastUpdated,
      setWalletInfo,
      refresh,
      logout,
    }}>
      {children}
    </WalletContext.Provider>
  )
}