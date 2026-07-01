import { ethers } from 'ethers'
import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react'
import { useNavigate } from 'react-router'
import store, { getSigner } from 'wallet/store'
import { useAppSelector } from '../hooks/reduxHooks'
import { getActiveNetwork } from '../redux/slices/network'
import CMAccount from './CMAccountManagerModule#CMAccount.json'
import CMAccountManager from './ManagerProxyModule#CMAccountManager.json'

const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'

const SmartContractContext = createContext<any>(null)

export const useSmartContract = () => useContext(SmartContractContext)

type SmartContractProviderProps = {
    children?: ReactNode
}

export const SmartContractProvider: React.FC<SmartContractProviderProps> = ({ children }) => {
    const [provider, setProvider] = useState<ethers.JsonRpcProvider | null>(null)
    const [needUpgrade, setNeedUpgrade] = useState(false)
    const [managerReadContract, setManagerReadContract] = useState<ethers.Contract | null>(null)
    const [managerWriteContract, setManagerWriteContract] = useState<ethers.Contract | null>(null)
    const [accountReadContract, setAccountReadContract] = useState<ethers.Contract | null>(null)
    const [accountWriteContract, setAccountWriteContract] = useState<ethers.Contract | null>(null)
    const [isNewImpl, setIsNewImpl] = useState(false)
    const [wallet, setWallet] = useState(null)
    const [account, setAccount] = useState<string | null>(null)
    const [contractCMAccountAddress, setContractCMAccountAddress] = useState<string | null>('')
    const auth = useAppSelector(state => state.appConfig.isAuth)
    const activeNetwork = useAppSelector(getActiveNetwork)

    const CMAccountCreated = async cmAccountAddress => {
        const accountWritableContract = new ethers.Contract(cmAccountAddress, CMAccount, wallet)
        const accountReadOnlyContract = new ethers.Contract(cmAccountAddress, CMAccount, provider)

        if (!account) {
            console.error('Account is not initialized')
            return { success: false, error: 'Account is not initialized' }
        }
        try {
            const WITHDRAWER_ROLE = await accountReadOnlyContract.WITHDRAWER_ROLE()
            const tx = await accountWritableContract.grantRole(WITHDRAWER_ROLE, wallet.address)
            await tx.wait()
            setContractCMAccountAddress(cmAccountAddress)
            setAccountReadContract(accountReadOnlyContract)
            setAccountWriteContract(accountWritableContract)
            return { success: true, message: 'All operations completed successfully' }
        } catch (error) {
            const decodedError = accountWritableContract.interface.parseError(error.data)
            console.error('Message:', error.message)
            console.error(`Reason: ${decodedError?.name} (${decodedError?.args})`)
            return { success: false, error: error.message }
        }
    }

    const initializeCMAccountContract = async () => {
        if (!provider) return
        try {
            const accountWritableContract = new ethers.Contract(
                contractCMAccountAddress,
                CMAccount,
                wallet,
            )
            const accountReadOnlyContract = new ethers.Contract(
                contractCMAccountAddress,
                CMAccount,
                provider,
            )
            setAccountReadContract(accountReadOnlyContract)
            setAccountWriteContract(accountWritableContract)
        } catch (error) {
            console.error('User denied account access:', error)
        }
    }

    const needsUpgrade = useCallback(async () => {
        try {
            if (accountWriteContract) {
                const implementation = await managerReadContract.getAccountImplementation()

                const implAddrPadded = await provider.getStorage(
                    contractCMAccountAddress,
                    IMPLEMENTATION_SLOT,
                )
                const implAddr = '0x' + implAddrPadded.slice(-40)
                if (ethers.getAddress(implementation) !== ethers.getAddress(implAddr)) {
                    setNeedUpgrade(true)
                    return true
                }
                return false
            }
        } catch (error) {
            const decodedError = accountWriteContract.interface.parseError(error.data)
            console.error('Message:', error.message)
            console.error(`Reason: ${decodedError?.name} (${decodedError?.args})`)
        }
    }, [accountWriteContract])

    const upgradeCMAccount = useCallback(async () => {
        try {
            if (accountWriteContract) {
                const implementation = await managerReadContract.getAccountImplementation()
                const tx = await accountWriteContract.upgradeToAndCall(implementation, '0x')
                const receipt = await tx.wait()
                return receipt
            }
        } catch (error) {
            const decodedError = accountWriteContract.interface.parseError(error.data)
            console.error('Message:', error.message)
            console.error(`Reason: ${decodedError?.name} (${decodedError?.args})`)
        }
    }, [accountWriteContract])

    const initializeEthers = async () => {
        const selectedNetwork = store.getters['Network/selectedNetwork']
        // Base Sepolia: flat EVM RPC (no /ext/bc/C/rpc), single CMAccountManager address.
        // batchMaxCount:1 disables ethers' JSON-RPC call batching — the public Base
        // Sepolia RPC mishandles batched eth_calls (returns empty -> CALL_EXCEPTION),
        // even though the same calls succeed individually.
        const ethersProvider = new ethers.JsonRpcProvider(selectedNetwork.rpcUrl, undefined, {
            batchMaxCount: 1,
        })
        try {
            let contractAddress = selectedNetwork.managerAddress
            if (auth) {
                // Signer comes from the injected wallet (MetaMask), not a stored key.
                const signer = await getSigner()
                const managerWritableContract = new ethers.Contract(
                    contractAddress,
                    CMAccountManager.abi,
                    signer,
                )
                setManagerWriteContract(managerWritableContract)
                setWallet(signer)
                setAccount(await signer.getAddress())
            }
            const managerReadOnlyContract = new ethers.Contract(
                contractAddress,
                CMAccountManager.abi,
                ethersProvider,
            )
            setProvider(ethersProvider)
            setManagerReadContract(managerReadOnlyContract)
            try {
                if (managerReadOnlyContract) {
                    const data = managerReadOnlyContract.interface.encodeFunctionData(
                        'getServiceFeeToken',
                        [],
                    )

                    const result = await ethersProvider.call({
                        to: contractAddress,
                        data,
                    })

                    // result === "0x" → function does NOT exist
                    setIsNewImpl(result && result !== '0x')
                }
            } catch (err) {
                setIsNewImpl(false)
            }
        } catch (error) {
            console.error('User denied account access:', error)
        }
    }
    const navigate = useNavigate()
    const path = window.location.pathname
    useEffect(() => {
        if (activeNetwork) {
            setAccountReadContract(null)
            setAccountWriteContract(null)
            if (
                contractCMAccountAddress &&
                (path.includes('partners/messenger-configuration/supplier') ||
                    path.includes('partners/messenger-configuration/distribution') ||
                    path.includes('partners/messenger-configuration/bots'))
            )
                navigate('/partners/messenger-configuration/mydetails')
            setContractCMAccountAddress('')
            initializeEthers()
        }
    }, [activeNetwork, auth])

    useEffect(() => {
        if (contractCMAccountAddress) initializeCMAccountContract()
    }, [provider, contractCMAccountAddress])

    const getCMAccountMappings = useCallback(async () => {
        try {
            const mappings = new Map()
            const CMACCOUNT_ROLE = await readFromContract('manager', 'CMACCOUNT_ROLE')
            const roleMemberCount = await readFromContract(
                'manager',
                'getRoleMemberCount',
                CMACCOUNT_ROLE,
            )

            // Sequential + per-item guard to avoid public-RPC rate-limit CALL_EXCEPTIONs
            // when enumerating all CMAccounts (a burst of parallel calls comes back empty).
            for (let i = 0; i < Number(roleMemberCount || 0); i++) {
                try {
                    const role = await managerReadContract.getRoleMember(CMACCOUNT_ROLE, i)
                    const creator = await readFromContract('manager', 'getCMAccountCreator', role)
                    if (role && creator) mappings.set(role.toLowerCase(), creator.toLowerCase())
                } catch (e) {
                    // skip flaky / reverting entry
                }
            }

            const findAddress = query => {
                query = query.toLowerCase()
                if (mappings.has(query)) {
                    return { role: query, creator: mappings.get(query) }
                }
                for (const [role, creator] of mappings) {
                    if (creator === query) {
                        return { role, creator: query }
                    }
                }
                return null
            }

            return {
                findAddress,
                getAllMappings: () => Object.fromEntries(mappings),
            }
        } catch (error) {
            console.warn(
                'getCMAccountMappings failed:',
                (error as any)?.shortMessage || (error as any)?.message,
            )
            return { findAddress: () => null, getAllMappings: () => ({}) }
        }
    }, [managerReadContract])

    const readFromContract = async (
        contractType: 'manager' | 'account',
        method: string,
        ...args: any[]
    ) => {
        const contract = contractType === 'manager' ? managerReadContract : accountReadContract
        // Guard against ABI drift (c4t -> ttm): if a method no longer exists on the
        // Base Sepolia contract, degrade to undefined instead of crashing the app.
        if (!contract || typeof contract[method] !== 'function') {
            return
        }

        try {
            const result = await contract[method](...args)
            return result
        } catch (error) {
            console.error(`Error reading from ${contractType} contract (method: ${method}):`, error)
            throw error
        }
    }

    const writeToContract = async (
        contractType: 'manager' | 'account',
        method: string,
        ...args: any[]
    ) => {
        const contract = contractType === 'manager' ? managerWriteContract : accountWriteContract
        if (!contract || typeof contract[method] !== 'function') {
            return
        }

        try {
            const tx = await contract[method](...args)
            const receipt = await tx.wait()
            return receipt
        } catch (error) {
            console.error(`Error writing to ${contractType} contract (method: ${method}):`, error)
            throw error
        }
    }

    const value = {
        needUpgrade,
        getCMAccountMappings,
        upgradeCMAccount,
        needsUpgrade,
        contractCMAccountAddress,
        setContractCMAccountAddress,
        wallet,
        provider,
        managerReadContract,
        managerWriteContract,
        accountReadContract,
        accountWriteContract,
        account,
        isNewImpl,
        readFromContract,
        writeToContract,
        CMAccountCreated,
    }

    return <SmartContractContext.Provider value={value}>{children}</SmartContractContext.Provider>
}
