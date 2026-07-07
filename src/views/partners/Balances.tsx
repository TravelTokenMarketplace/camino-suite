import { RefreshOutlined } from '@mui/icons-material'
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import React, { useEffect, useState } from 'react'
import Blockies from 'react-blockies'
import { useAppDispatch } from '../../hooks/reduxHooks'

import { mdiClose } from '@mdi/js'
import Icon from '@mdi/react'
import { ethers } from 'ethers'
import DialogAnimate from '../../components/Animate/DialogAnimate'
import CamWithdraw from '../../components/CamWithdraw'
import { ERC20_ABI } from '../../constants/apps-consts'
import { usePartnerConfig } from '../../helpers/usePartnerConfig'
import { useSmartContract } from '../../helpers/useSmartContract'
import useWalletBalance from '../../helpers/useWalletBalance'
import { updateNotificationStatus } from '../../redux/slices/app-config'
import { Configuration } from './Configuration'

// Preconfigured payment tokens on Base Sepolia — always shown in the tab.
// Balances are read on-chain; the hardcoded metadata is the fallback so the
// row still renders when the public RPC hiccups. EURe (Monerium sandbox,
// sandbox.monerium.dev) is TTM's primary settlement currency.
const KNOWN_TOKENS = [
    {
        address: '0x29F37F6adCa168B79B8d9567eab9BE3fBF21db85',
        symbol: 'EURe',
        name: 'Monerium EURe',
        decimal: 18,
    },
    {
        address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        symbol: 'USDC',
        name: 'USDC',
        decimal: 6,
    },
    {
        address: '0x808456652fdb597867f38412077A9182bf77359F',
        symbol: 'EURC',
        name: 'EURC',
        decimal: 6,
    },
    {
        address: '0x4200000000000000000000000000000000000006',
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimal: 18,
    },
]

export const Balances = () => {
    const [open, setOpen] = useState(false)
    const [selectedToken, setSelectedToken] = useState(null)
    const [isOffChainPaymentSupported, setIsOffChainPaymentSupported] = useState(false)
    const [isNativeSupported, setIsNativeSupported] = useState(false)
    const [isEditMode, setIsEditMode] = useState(false)
    const [tempOffChainPaymentSupported, setTempOffChainPaymentSupported] = useState(false)
    const [tempSupportedTokens, setTempSupportedTokens] = useState([])
    const [supportedTokens, setSupportedTokens] = useState([])
    const [tempNativeSupported, setTempNativeSupported] = useState(false)
    const { balanceOfAnAddress, getBalanceOfAnAddress } = useWalletBalance()
    const [isLoading, setIsLoading] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const [tokens, setTokens] = useState([])
    const [customAddress, setCustomAddress] = useState('')
    const [customError, setCustomError] = useState('')
    const { contractCMAccountAddress, provider } = useSmartContract()
    const {
        getSupportedTokens,
        getOffChainPaymentSupported,
        setOffChainPaymentSupported,
        addSupportedToken,
        removeSupportedToken,
    } = usePartnerConfig()

    const appDispatch = useAppDispatch()
    const handleOpenModal = token => {
        setOpen(true)
    }
    async function checkIfOffChainPaymentSupported() {
        let res = await getOffChainPaymentSupported()
        setIsOffChainPaymentSupported(!!res)
    }

    const handleCloseModal = () => {
        setSelectedToken(null)
        setOpen(false)
    }

    const handleEditClick = () => {
        setTempSupportedTokens(tokens.map(token => ({ ...token })))
        setTempOffChainPaymentSupported(isOffChainPaymentSupported)
        setTempNativeSupported(isNativeSupported)
        setCustomAddress('')
        setCustomError('')
        setIsEditMode(true)
    }

    const handleCancelEdit = () => {
        setIsEditMode(false)
    }

    // Read a token's metadata + the CMAccount's balance of it. Sequential reads:
    // the public Base Sepolia RPC mishandles bursts (see useSmartContract).
    async function readToken(address, supportedLower) {
        const contract = new ethers.Contract(address, ERC20_ABI, provider)
        const [name, symbol, decimal] = [
            await contract.name(),
            await contract.symbol(),
            await contract.decimals(),
        ]
        const balance = await contract.balanceOf(contractCMAccountAddress)
        return {
            address,
            name,
            symbol,
            decimal: Number(decimal),
            balance: ethers.formatUnits(balance, decimal),
            supported: supportedLower.includes(address.toLowerCase()),
        }
    }

    // wallet_watchAsset prompts MetaMask to track the token. This is also the
    // reliable way to surface tokens on custom networks like Base Sepolia,
    // where MetaMask's manual "import token" flow is broken.
    const addTokenToMetaMask = async token => {
        try {
            await (window as any).ethereum?.request({
                method: 'wallet_watchAsset',
                params: {
                    type: 'ERC20',
                    options: {
                        address: token.address,
                        symbol: token.symbol,
                        decimals: token.decimal,
                    },
                },
            })
        } catch (error) {
            console.error('wallet_watchAsset failed:', error)
        }
    }

    const handleAddCustomToken = async () => {
        setCustomError('')
        if (!ethers.isAddress(customAddress)) {
            setCustomError('Invalid EVM address')
            return
        }
        const addr = customAddress.toLowerCase()
        if (tempSupportedTokens.find(t => t.address.toLowerCase() === addr)) {
            setCustomError('Token is already in the list')
            return
        }
        try {
            setIsLoading(true)
            const supportedLower = supportedTokens.map(a => a.toLowerCase())
            const token = await readToken(ethers.getAddress(customAddress), supportedLower)
            setTempSupportedTokens(prev => [...prev, { ...token, supported: true }])
            setCustomAddress('')
        } catch (error) {
            console.error('Error reading token metadata:', error)
            setCustomError('Could not read ERC-20 metadata at this address')
        } finally {
            setIsLoading(false)
        }
    }

    const handleConfirmEdit = async () => {
        setIsLoading(true)
        try {
            if (tempOffChainPaymentSupported !== isOffChainPaymentSupported) {
                await setOffChainPaymentSupported(tempOffChainPaymentSupported)
            }
            if (tempNativeSupported !== isNativeSupported) {
                // Native ETH is represented on-chain as the zero address.
                if (tempNativeSupported) {
                    await addSupportedToken(ethers.ZeroAddress)
                } else {
                    await removeSupportedToken(ethers.ZeroAddress)
                }
            }
            const previouslySupported = new Set(supportedTokens.map(addr => addr.toLowerCase()))
            for (const token of tempSupportedTokens) {
                const addr = token.address.toLowerCase()
                if (addr === ethers.ZeroAddress) continue
                const wasSupported = previouslySupported.has(addr)
                if (!wasSupported && token.supported) {
                    await addSupportedToken(token.address)
                } else if (wasSupported && !token.supported) {
                    await removeSupportedToken(token.address)
                }
            }
            appDispatch(
                updateNotificationStatus({
                    message: 'Accepted currencies updated successfully',
                    severity: 'success',
                }),
            )
            await checkIfOffChainPaymentSupported()
            await fetchTokens()
            setIsEditMode(false)
        } catch (error) {
            console.error('Error saving configuration:', error)
            appDispatch(
                updateNotificationStatus({
                    message: 'Failed to update accepted currencies',
                    severity: 'error',
                }),
            )
        } finally {
            setIsLoading(false)
        }
    }

    // Token universe = curated Base Sepolia tokens + whatever the CMAccount already
    // supports on-chain (covers tokens added elsewhere, e.g. the developer UI).
    async function fetchTokens() {
        if (!contractCMAccountAddress || !provider) return
        setIsFetching(true)
        try {
            const res = (await getSupportedTokens()) || []
            const supported = [...res]
            setSupportedTokens(supported)
            setIsNativeSupported(!!supported.find(elem => elem === ethers.ZeroAddress))
            const supportedLower = supported.map(a => a.toLowerCase())

            const knownLower = KNOWN_TOKENS.map(t => t.address.toLowerCase())
            const universe = [
                ...KNOWN_TOKENS,
                ...supported
                    .filter(a => a !== ethers.ZeroAddress && !knownLower.includes(a.toLowerCase()))
                    .map(address => ({ address })),
            ]

            const fetched = []
            for (const token of universe) {
                try {
                    fetched.push(await readToken(token.address, supportedLower))
                } catch (err) {
                    console.error(`Error fetching token ${token.address}`, err)
                    // Preconfigured tokens still render on hardcoded metadata
                    // when the RPC read fails; balance is simply unknown.
                    if (token.symbol) {
                        fetched.push({
                            ...token,
                            balance: '?',
                            supported: supportedLower.includes(token.address.toLowerCase()),
                        })
                    }
                }
            }
            setTokens(fetched)
        } catch (error) {
            console.error('Error fetching supported tokens:', error)
        } finally {
            setIsFetching(false)
        }
    }

    useEffect(() => {
        if (!contractCMAccountAddress) return
        getBalanceOfAnAddress(contractCMAccountAddress)
        checkIfOffChainPaymentSupported()
        fetchTokens()
    }, [contractCMAccountAddress])

    const checkboxSx = {
        m: '0 8px 0 0',
        color: theme => (!isEditMode ? theme.palette.action.disabled : theme.palette.secondary.main),
        '&.Mui-checked': {
            color: theme =>
                !isEditMode ? theme.palette.action.disabled : theme.palette.secondary.main,
        },
        '&.MuiCheckbox-colorSecondary.Mui-checked': {
            color: theme =>
                !isEditMode ? theme.palette.action.disabled : theme.palette.secondary.main,
        },
    }

    const displayedTokens = isEditMode ? tempSupportedTokens : tokens
    // While the first token read is in flight, hide the whole accepted-currencies list
    // (off-chain + ETH + tokens) behind one spinner, so it never shows a partial list
    // (e.g. just ETH + off-chain) that looks final and then reflows when the slow
    // sequential public-RPC reads resolve. Not applied in edit mode (no fetch there).
    const currenciesLoading = isFetching && !isEditMode

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
            }}
        >
            <Configuration>
                <Configuration.Title>Balances</Configuration.Title>
                <Configuration.Paragraphe>
                    Your Messenger Account holds its own funds on Base Sepolia. Configure which
                    currencies you accept as payment, and withdraw balances to any address.
                </Configuration.Paragraphe>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        width: 'fit-content',
                        minWidth: '420px',
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <Typography variant="body2">Accepted Currencies</Typography>
                        {isFetching ? (
                            <CircularProgress size={16} />
                        ) : (
                            <RefreshOutlined
                                onClick={() => {
                                    getBalanceOfAnAddress(contractCMAccountAddress)
                                    fetchTokens()
                                }}
                                sx={{
                                    cursor: 'pointer',
                                    color: theme => `${theme.palette.text.primary} !important`,
                                }}
                            />
                        )}
                    </Box>
                    {currenciesLoading ? (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                py: '24px',
                            }}
                        >
                            <CircularProgress size={20} />
                            <Typography variant="body2" color="text.secondary">
                                Loading accepted currencies…
                            </Typography>
                        </Box>
                    ) : (
                        <>
                    <FormControlLabel
                        disabled={!isEditMode}
                        label={<Typography variant="body2">Fiat: off-chain</Typography>}
                        control={
                            <Checkbox
                                sx={checkboxSx}
                                checked={
                                    isEditMode
                                        ? tempOffChainPaymentSupported
                                        : isOffChainPaymentSupported
                                }
                                onChange={e => setTempOffChainPaymentSupported(e.target.checked)}
                            />
                        }
                    />
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            justifyContent: 'space-between',
                        }}
                    >
                        <FormControlLabel
                            disabled={!isEditMode}
                            label={
                                <Typography variant="body2">
                                    ETH: {Number(balanceOfAnAddress || 0).toFixed(6)}
                                </Typography>
                            }
                            control={
                                <Checkbox
                                    sx={checkboxSx}
                                    checked={isEditMode ? tempNativeSupported : isNativeSupported}
                                    onChange={e => setTempNativeSupported(e.target.checked)}
                                />
                            }
                        />
                        {!isEditMode && (
                            <Button
                                variant="contained"
                                onClick={() => {
                                    setSelectedToken(null)
                                    handleOpenModal({
                                        symbol: 'ETH',
                                    })
                                }}
                            >
                                Withdraw
                            </Button>
                        )}
                    </Box>
                        </>
                    )}
                    {!currenciesLoading &&
                        displayedTokens.length > 0 &&
                        displayedTokens.map((elem, index) => {
                            return (
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        justifyContent: 'space-between',
                                    }}
                                    key={elem.address}
                                >
                                    <Tooltip
                                        title={
                                            <Typography
                                                sx={{
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.75rem',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'visible',
                                                    display: 'inline-block',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '4px',
                                                    padding: '2px 6px',
                                                    backgroundColor: theme =>
                                                        theme.palette.mode === 'dark'
                                                            ? '#0F172A'
                                                            : '#F8FAFC',
                                                    color: theme =>
                                                        theme.palette.mode === 'dark'
                                                            ? '#F8FAFC'
                                                            : '#1E293B',
                                                }}
                                            >
                                                {elem.address}
                                            </Typography>
                                        }
                                        placement="right"
                                        arrow
                                        slotProps={{
                                            tooltip: {
                                                sx: {
                                                    backgroundColor: theme =>
                                                        theme.palette.mode === 'dark'
                                                            ? '#1E293B'
                                                            : '#E2E8F0',
                                                    color: theme =>
                                                        theme.palette.mode === 'dark'
                                                            ? '#F8FAFC'
                                                            : '#1E293B',
                                                    borderRadius: 1,
                                                    p: 1,
                                                    overflow: 'visible',
                                                    maxWidth: 'none',
                                                },
                                            },
                                        }}
                                    >
                                        <FormControlLabel
                                            disabled={!isEditMode}
                                            label={
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                    }}
                                                >
                                                    <Blockies
                                                        seed={elem.address.toLowerCase()}
                                                        size={8}
                                                        scale={3}
                                                        className="token-icon"
                                                        style={{
                                                            borderRadius: 8,
                                                            width: 24,
                                                            height: 24,
                                                        }}
                                                    />
                                                    <Typography variant="body2">
                                                        {elem.name}: {elem.balance} {elem.symbol}
                                                    </Typography>
                                                </Box>
                                            }
                                            control={
                                                <Checkbox
                                                    sx={checkboxSx}
                                                    checked={!!elem.supported}
                                                    onChange={e => {
                                                        if (!isEditMode) return
                                                        setTempSupportedTokens(prev =>
                                                            prev.map((t, i) =>
                                                                i === index
                                                                    ? {
                                                                          ...t,
                                                                          supported:
                                                                              e.target.checked,
                                                                      }
                                                                    : t,
                                                            ),
                                                        )
                                                    }}
                                                />
                                            }
                                        />
                                    </Tooltip>
                                    {!isEditMode && (
                                        <Box sx={{ display: 'flex', gap: '8px' }}>
                                            <Tooltip
                                                title="Track this token in MetaMask (importing custom tokens manually is broken on Base Sepolia)"
                                                placement="top"
                                                arrow
                                            >
                                                <Button
                                                    variant="outlined"
                                                    onClick={() => addTokenToMetaMask(elem)}
                                                >
                                                    + MetaMask
                                                </Button>
                                            </Tooltip>
                                            <Button
                                                variant="contained"
                                                onClick={() => {
                                                    setSelectedToken(elem)
                                                    handleOpenModal(elem)
                                                }}
                                            >
                                                Withdraw
                                            </Button>
                                        </Box>
                                    )}
                                </Box>
                            )
                        })}
                    {isEditMode && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <Box sx={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <TextField
                                    value={customAddress}
                                    onChange={e => setCustomAddress(e.target.value)}
                                    placeholder="Custom token address 0x…"
                                    sx={{
                                        flex: '1',
                                        '& .MuiInputBase-root': { height: '40px' },
                                        '& input': { fontSize: '14px' },
                                    }}
                                />
                                <Button
                                    variant="contained"
                                    disabled={isLoading || !customAddress}
                                    onClick={handleAddCustomToken}
                                >
                                    <Typography variant="caption">Add token</Typography>
                                </Button>
                            </Box>
                            {customError && (
                                <Typography variant="caption" color="error">
                                    {customError}
                                </Typography>
                            )}
                        </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                        {!isEditMode ? (
                            <Button variant="contained" onClick={handleEditClick}>
                                Configure Currencies
                            </Button>
                        ) : (
                            <>
                                <Button
                                    disabled={isLoading}
                                    variant="outlined"
                                    onClick={handleCancelEdit}
                                    sx={{ mr: '8px' }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    disabled={isLoading}
                                    variant="contained"
                                    onClick={handleConfirmEdit}
                                >
                                    {isLoading ? (
                                        <CircularProgress size={24} color="inherit" />
                                    ) : (
                                        'Save Changes'
                                    )}
                                </Button>
                            </>
                        )}
                    </Box>
                </Box>
            </Configuration>
            <DialogAnimate open={open} onClose={handleCloseModal}>
                <DialogTitle
                    sx={{
                        m: 0,
                        p: 2,
                        width: '768px',
                        backgroundColor: theme =>
                            theme.palette.mode === 'dark' ? '#020617' : '#F1F5F9',
                    }}
                >
                    <Typography variant="body1" component="span">
                        Withdraw {selectedToken ? selectedToken.symbol : 'ETH'}
                    </Typography>
                    <IconButton
                        aria-label="close"
                        onClick={handleCloseModal}
                        sx={{
                            position: 'absolute',
                            right: 10,
                            top: 15,
                            cursor: 'pointer',
                            color: theme => theme.palette.grey[500],
                        }}
                    >
                        <Icon path={mdiClose} size={1} />
                    </IconButton>
                </DialogTitle>

                <Divider sx={{ borderWidth: '1.5px' }} />
                <DialogContent
                    sx={{
                        backgroundColor: theme =>
                            theme.palette.mode === 'dark' ? '#020617' : '#F1F5F9',
                    }}
                >
                    <CamWithdraw
                        setOpen={setOpen}
                        token={selectedToken}
                        fetchTokenBalances={fetchTokens}
                    />
                </DialogContent>
            </DialogAnimate>
        </Box>
    )
}

export default Balances
