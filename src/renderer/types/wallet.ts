export interface Balance {
  USDC?: number
  SUI?: number
  USDsui?: number
  totalUsd?: number
  [key: string]: number | undefined
}

export interface WalletInfo {
  address: string
  publicKey?: string
}

export interface Transaction {
  digest?: string
  type?: string
  timestamp?: number | string
  amount?: number
  asset?: string
}