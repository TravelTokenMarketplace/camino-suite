import { mdiWalletOutline } from '@mdi/js'
import Icon from '@mdi/react'
import { Box, Button, Typography } from '@mui/material'
import React from 'react'
import useMetaMask from '../../hooks/useMetaMask'

const short = (addr?: string) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '')

/**
 * Replaces the old wallet Login/Account UI with a single injected-wallet
 * (MetaMask) connect button. Shows the connected address + disconnect.
 */
export default function ConnectWallet() {
    const { isConnected, address, connect, disconnect } = useMetaMask()

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
            <Typography variant="body2" component="span">
                {short(address)}
            </Typography>
            <Button variant="text" size="small" onClick={disconnect} sx={{ minWidth: 'auto' }}>
                Disconnect
            </Button>
        </Box>
    )
}
