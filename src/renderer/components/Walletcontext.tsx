import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { Balance, Transaction, WalletInfo } from '../types/wallet'
import {
  loadWalletNetwork,
  saveWalletNetwork,
  SUI_NETWORKS,
  type SuiNetwork,
} from '../types/network'

const POLL_INTERVAL_MS = 30_000

interface WalletContextValue {
  walletInfo:      WalletInfo | null
  balance:         Balance | null
  transactions:    Transaction[]
  network:         SuiNetwork
  localNetRunning: boolean
  loading:         boolean
  refreshing:      boolean
  lastUpdated:     Date | null
  setWalletInfo:   (info: WalletInfo | null) => void
  setNetwork:      (network: SuiNetwork) => void
  refresh:         () => Promise<void>
  logout:          () => Promise<void>
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
  const [network,         setNetworkState]    = useState<SuiNetwork>(loadWalletNetwork)
  const [localNetRunning, setLocalNetRunning] = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [refreshing,   setRefreshing]      = useState(false)
  const [lastUpdated,  setLastUpdated]     = useState<Date | null>(null)

  const pollerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const walletRef    = useRef<WalletInfo | null>(null)
  const networkRef   = useRef<SuiNetwork>(network)

  networkRef.current = network

  const fetchData = useCallback(async (isBackground = false) => {
    if (!walletRef.current?.address) return
    if (isBackground) setRefreshing(true)

    try {
      const activeNetwork = networkRef.current
      const [balRes, txRes] = await Promise.all([
        window.sui.getBalance({ network: activeNetwork }),
        window.sui.getTransactions({ limit: 20, network: activeNetwork }),
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

  const setNetwork = useCallback((next: SuiNetwork) => {
    networkRef.current = next
    setNetworkState(next)
    saveWalletNetwork(next)
    if (walletRef.current) {
      fetchData(false).then(startPolling)
    }
  }, [fetchData])

  const refresh = useCallback(async () => {
    await fetchData(true)
    startPolling()
  }, [fetchData])

  const logout = useCallback(async () => {
    await window.sui.deleteWallet()
    setWalletInfo(null)
  }, [])

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
      .catch((err) => {
        console.error('[WalletContext] init error:', err)
      })
      .finally(() => {
        setLoading(false)
        if (walletRef.current) startPolling()
      })

    return () => stopPolling()
  }, [fetchData])

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

  useEffect(() => {
    const pollLocalNet = async () => {
      try {
        const status = await window.playground.getLocalNetworkStatus()
        setLocalNetRunning(status.rpcReady)
        if (!status.rpcReady && networkRef.current === 'localnet') {
          networkRef.current = 'testnet'
          setNetworkState('testnet')
          saveWalletNetwork('testnet')
          if (walletRef.current) fetchData(false)
        }
      } catch {
        setLocalNetRunning(false)
      }
    }

    const pollMs =
      window.electronAPI?.platform === 'win32' ? 8_000 : 3_000
    const pollLocalNetWithVisibility = () => {
      if (document.visibilityState === 'hidden') return
      void pollLocalNet()
    }

    pollLocalNetWithVisibility()
    const timer = window.setInterval(pollLocalNetWithVisibility, pollMs)
    return () => window.clearInterval(timer)
  }, [fetchData])

  return (
    <WalletContext.Provider value={{
      walletInfo,
      balance,
      transactions,
      network,
      localNetRunning,
      loading,
      refreshing,
      lastUpdated,
      setWalletInfo,
      setNetwork,
      refresh,
      logout,
    }}>
      {children}
    </WalletContext.Provider>
  )
}

export { SUI_NETWORKS }