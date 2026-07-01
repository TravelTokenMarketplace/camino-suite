/**
 * MetaMask-backed replacement for the old `wallet/store` Module-Federation remote
 * (which was the camino-wallet Vuex store).
 *
 * The React host consumed only a small, well-known surface of that store
 * (see `store.state.*`, `store.getters[...]`, `store.dispatch(...)` across src).
 * We reproduce exactly that surface here, backed by an injected EVM wallet
 * (MetaMask) connected to Base Sepolia. P/X-chain concepts are stubbed away.
 *
 * Wired in via webpack `resolve.alias`: 'wallet/store' -> this file.
 */
import { ethers } from 'ethers'

// ---- Base Sepolia network descriptor (the single network this dApp targets) ----
export const BASE_SEPOLIA = {
    name: 'base-sepolia',
    displayName: 'Base Sepolia',
    readableName: 'Base Sepolia',
    protocol: 'https',
    ip: 'sepolia.base.org',
    port: 443,
    rpcUrl: 'https://sepolia.base.org',
    url: 'https://sepolia.base.org',
    chainId: 84532,
    networkId: 84532,
    explorerUrl: 'https://base-sepolia.blockscout.com',
    explorerSiteUrl: 'https://base-sepolia.blockscout.com',
    // CMAccountManager proxy deployed on Base Sepolia (chain 84532)
    managerAddress: '0xEcf9b5ca23257969B4F9bb3Efca2d5bb850FAcE9',
    predefined: true,
    status: 'connected',
} as const

export const BASE_SEPOLIA_HEX_CHAIN_ID = '0x14a34' // 84532

// ---- Mutable shim state (updated by the MetaMask connect flow) ----
const activeWallet: any = {
    ethAddress: '',
    ethKey: null,
    name: 'MetaMask',
    type: 'metamask',
}

const state: any = {
    isAuth: false,
    activeWallet,
    wallets: [] as any[],
    Network: {
        selectedNetwork: BASE_SEPOLIA,
        networksCustom: [] as any[],
        status: 'connected',
    },
}

// Vuex-style getters. Most are plain values; `staticAddresses` is a method getter.
const getters: any = {
    'Network/allNetworks': [BASE_SEPOLIA],
    'Network/selectedNetwork': BASE_SEPOLIA,
    'Assets/networkErc20Tokens': [] as any[],
    'Accounts/kycStatus': true,
    'Accounts/kybStatus': true,
    'Platform/isOfferCreator': false,
    // method-style getter: store.getters['staticAddresses']('P')
    staticAddresses: (_chain?: string) => '',
    // defensive: some legacy P-chain reducers read store.getters.addresses[0]
    addresses: ['X-0000000000000000000000000000000000000000'],
}

const store: any = {
    state,
    getters,
    // every action the host dispatched is a no-op on Base except `logout`
    dispatch: async (action: string, _payload?: any) => {
        if (action === 'logout') setConnected(null)
        return undefined
    },
    commit: (_mutation: string, _payload?: any) => undefined,
    getState: () => state,
}

// ---- helpers used by the MetaMask connect hook / contract services ----
export function setConnected(address: string | null) {
    if (address) {
        state.isAuth = true
        activeWallet.ethAddress = address
        state.wallets = [activeWallet]
    } else {
        state.isAuth = false
        activeWallet.ethAddress = ''
        state.wallets = []
    }
}

export function getAddress(): string {
    return activeWallet.ethAddress
}

/** Read-only provider for contract reads (no wallet required). */
export function getReadProvider(): ethers.JsonRpcProvider {
    // batchMaxCount:1 — public Base Sepolia RPC mishandles batched eth_calls.
    return new ethers.JsonRpcProvider(BASE_SEPOLIA.rpcUrl, undefined, { batchMaxCount: 1 })
}

/** Signer from the injected wallet, for contract writes. */
export async function getSigner(): Promise<ethers.Signer> {
    const eth = (window as any).ethereum
    if (!eth) throw new Error('No injected wallet (MetaMask) found')
    const provider = new ethers.BrowserProvider(eth)
    return provider.getSigner()
}

export default store
