import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from './reduxHooks'
import { updateAccount } from '../redux/slices/app-config'
import { updateAuthStatus } from '../redux/slices/utils'
import {
    BASE_SEPOLIA,
    BASE_SEPOLIA_HEX_CHAIN_ID,
    setConnected,
} from '../remote-shims/walletStore'

/**
 * Minimal injected-wallet (MetaMask) connector that replaces the old
 * mnemonic/keystore login. Sets the app auth state + the wallet shim so the
 * existing Partners on-chain code (ethers) can obtain a signer.
 */
export default function useMetaMask() {
    const dispatch = useAppDispatch()
    const isAuth = useAppSelector(state => state.appConfig.isAuth)
    const account = useAppSelector(state => state.appConfig.account)

    const ensureBaseSepolia = useCallback(async () => {
        const eth = (window as any).ethereum
        if (!eth) return
        try {
            await eth.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BASE_SEPOLIA_HEX_CHAIN_ID }],
            })
        } catch (switchError: any) {
            // 4902 = chain not added to the wallet yet -> add it
            if (switchError?.code === 4902) {
                await eth.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        {
                            chainId: BASE_SEPOLIA_HEX_CHAIN_ID,
                            chainName: 'Base Sepolia',
                            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                            rpcUrls: [BASE_SEPOLIA.rpcUrl],
                            blockExplorerUrls: [BASE_SEPOLIA.explorerUrl],
                        },
                    ],
                })
            }
        }
    }, [])

    const setAuthed = useCallback(
        (address: string | null) => {
            setConnected(address)
            dispatch(updateAuthStatus(!!address))
            dispatch(updateAccount(address ? { address } : null))
        },
        [dispatch],
    )

    const connect = useCallback(async () => {
        const eth = (window as any).ethereum
        if (!eth) {
            // eslint-disable-next-line no-alert
            window.alert('MetaMask (or another EVM wallet) is required to connect.')
            return
        }
        const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' })
        await ensureBaseSepolia()
        if (accounts && accounts[0]) setAuthed(accounts[0])
    }, [ensureBaseSepolia, setAuthed])

    const disconnect = useCallback(() => {
        setAuthed(null)
    }, [setAuthed])

    // Keep app state in sync with the wallet
    useEffect(() => {
        const eth = (window as any).ethereum
        if (!eth?.on) return
        // Restore the session on load if the wallet already granted permission for this
        // site (silent — no prompt). Without this, a page refresh drops `isAuth` and
        // bounces the user off the config pages back to the Showroom.
        eth.request({ method: 'eth_accounts' })
            .then((accounts: string[]) => {
                if (accounts && accounts.length > 0) setAuthed(accounts[0])
            })
            .catch(() => {})
        const onAccountsChanged = (accounts: string[]) => {
            if (!accounts || accounts.length === 0) setAuthed(null)
            else setAuthed(accounts[0])
        }
        const onChainChanged = () => {
            // simplest robust behaviour: reload so providers re-init on the new chain
            window.location.reload()
        }
        eth.on('accountsChanged', onAccountsChanged)
        eth.on('chainChanged', onChainChanged)
        return () => {
            eth.removeListener?.('accountsChanged', onAccountsChanged)
            eth.removeListener?.('chainChanged', onChainChanged)
        }
    }, [setAuthed])

    return {
        isConnected: isAuth,
        address: account?.address as string | undefined,
        connect,
        disconnect,
    }
}
