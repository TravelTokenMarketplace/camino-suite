import { mdiWalletOutline } from '@mdi/js'
import Icon from '@mdi/react'
import { Box, Button, Typography } from '@mui/material'
import { ethers } from 'ethers'
import React, { useEffect, useState } from 'react'
import useMetaMask from '../../hooks/useMetaMask'
import { getReadProvider } from '../../remote-shims/walletStore'

const short = (addr?: string) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '')

/**
 * Replaces the old wallet Login/Account UI with a single injected-wallet
 * (MetaMask) connect button. Shows the connected address, its Base Sepolia
 * ETH balance, and disconnect.
 */
export default function ConnectWallet() {
    const { isConnected, address, connect, disconnect } = useMetaMask()
    const [balance, setBalance] = useState<string>('')

    useEffect(() => {
        let cancelled = false
        async function loadBalance() {
            if (!isConnected || !address) {
                setBalance('')
                return
            }
            try {
                const wei = await getReadProvider().getBalance(address)
                if (!cancelled) setBalance(Number(ethers.formatEther(wei)).toFixed(4))
            } catch {
                if (!cancelled) setBalance('')
            }
        }
        loadBalance()
        return () => {
            cancelled = true
        }
    }, [isConnected, address])

    if (!isConnected) {
        return (
            <Box
                onClick={connect}
                sx={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
            >
                <Icon path={mdiWalletOutline} size={1} />
                <Typography variant="body2" component="span">
                    Connect Wallet
                </Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <Icon path={mdiWalletOutline} size={1} />
            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <Typography variant="body2" component="span">
                    {short(address)}
                </Typography>
                {balance !== '' && (
                    <Typography variant="caption" component="span" sx={{ opacity: 0.7 }}>
                        {balance} ETH
                    </Typography>
                )}
            </Box>
            <Button variant="text" size="small" onClick={disconnect} sx={{ minWidth: 'auto' }}>
                Disconnect
            </Button>
        </Box>
    )
}
