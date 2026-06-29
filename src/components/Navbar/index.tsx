import { mdiClose, mdiMenu } from '@mdi/js'
import { AppBar, Box, Drawer, IconButton, Stack, Toolbar, useTheme } from '@mui/material'
import React, { useState } from 'react'
import { DRAWER_WIDTH } from '../../constants/apps-consts'
import { useAppSelector } from '../../hooks/reduxHooks'

import Icon from '@mdi/react'
import { getActiveNetwork } from '../../redux/slices/network'
import MHidden from '../@material-extend/MHidden'
import MIconButton from '../@material-extend/MIconButton'
import PlatformSwitcher from '../PlatformSwitcher'
import ConnectWallet from './ConnectWallet'
import NetworkSwitcher from './NetworkSwitcher'
import ThemeSwitcher from './ThemeSwitcher'

export default function Navbar() {
    const theme = useTheme()
    const activeNetwork = useAppSelector(getActiveNetwork)

    const [openSidebar, setOpenSidebar] = useState(false)
    const handleCloseSidebar = () => setOpenSidebar(false)
    const handleOpenSidebar = () => setOpenSidebar(true)

    return (
        <AppBar
            sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                minHeight: '65px',
                px: '1.5rem !important',
                bgcolor: theme.palette.background.paper,
            }}
            position="fixed"
        >
            <Toolbar
                sx={{
                    width: '100%',
                    maxWidth: 'xxl',
                    display: 'flex',
                    height: 'auto',
                    p: '0',
                    gap: '1rem',
                    px: '0px !important',
                    alignItems: 'normal',
                    justifyContent: 'space-between',
                }}
            >
                <PlatformSwitcher />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    {/* Mobile */}
                    <MHidden width="smUp">
                        <Drawer
                            anchor="right"
                            ModalProps={{ keepMounted: true }}
                            open={openSidebar}
                            onClose={handleCloseSidebar}
                            sx={{
                                '& .MuiDrawer-paper': {
                                    width: DRAWER_WIDTH,
                                    maxWidth: '100%',
                                    bgcolor: theme.palette.background.secondary,
                                    justifyContent: 'space-between',
                                },
                                '& .MuiPaper-root': { border: 'none', pb: '1rem' },
                                borderRadius: '0',
                            }}
                        >
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="center"
                                    sx={{ padding: theme.spacing(2) }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <ThemeSwitcher />
                                        <ConnectWallet />
                                    </Box>
                                    <Box sx={{ flexGrow: 1 }} />
                                    <MIconButton onClick={handleCloseSidebar}>
                                        <Icon path={mdiClose} size={1} />
                                    </MIconButton>
                                </Stack>
                                {activeNetwork && (
                                    <NetworkSwitcher handleCloseSidebar={handleCloseSidebar} />
                                )}
                            </Box>
                        </Drawer>
                        <MIconButton onClick={handleOpenSidebar}>
                            <Icon path={mdiMenu} size={1} />
                        </MIconButton>
                    </MHidden>
                    {/* Desktop */}
                    <MHidden width="smDown">
                        <>
                            <ThemeSwitcher />
                            {activeNetwork && <NetworkSwitcher />}
                            <ConnectWallet />
                        </>
                    </MHidden>
                </Box>
            </Toolbar>
        </AppBar>
    )
}
