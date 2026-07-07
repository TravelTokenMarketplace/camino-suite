import {
    CONTRACTCMACCOUNTMANAGERADDRESSCAMINO,
    CONTRACTCMACCOUNTMANAGERADDRESSCOLUMBUS,
    ERC20_ABI,
} from '../../constants/apps-consts'

import { ethers } from 'ethers'
import { ava as caminoClient } from 'wallet/caminoClient'
import store from 'wallet/store'
import { PartnersResponseType } from '../../@types/partners'
import CMAccount from '../../helpers/CMAccountManagerModule#CMAccount.json'
import CMAccountManager from '../../helpers/ManagerProxyModule#CMAccountManager.json'
import { BusinessField } from '../../helpers/partnersReducer'

// Partner CMS data now comes from the local "dummy Strapi" (partner-showroom-api),
// which reproduces the Strapi v4 envelope. Override with STRAPI_BASE_URL at build time.
const STRAPI_BASE = process.env.STRAPI_BASE_URL || 'http://localhost:1337'

const BASE_URLS = {
    dev: `${STRAPI_BASE}/api/partners`,
    prod: `${STRAPI_BASE}/api/partners`,
}

const BUSINESS_BASE_URLS = {
    dev: `${STRAPI_BASE}/api/business-fields`,
    prod: `${STRAPI_BASE}/api/business-fields`,
}

function createPartnerContract(address: string, provider: ethers.Provider) {
    try {
        const contract = new ethers.Contract(address, CMAccount, provider)
        return contract
    } catch (e) {
        return null
    }
}

const getListOfBots = async contract => {
    try {
        const MESSENGER_BOT_ROLE = await contract.MESSENGER_BOT_ROLE()
        const roleMemberCount = await contract.getRoleMemberCount(MESSENGER_BOT_ROLE)

        const botPromises = []
        for (let i = 0; i < roleMemberCount; i++) {
            botPromises.push(contract.getRoleMember(MESSENGER_BOT_ROLE, i))
        }

        const bots = await Promise.all(botPromises)
        return bots
    } catch (error) {
        throw error
    }
}

const getSupportedCurrencies = async (contract, provider) => {
    try {
        const offChainPaymentSupported = await contract.offChainPaymentSupported()
        const supportedTokens = await contract.getSupportedTokens()
        let tokens = []
        for (const token of supportedTokens) {
            if (token !== ethers.ZeroAddress) {
                const tokenContract = new ethers.Contract(token, ERC20_ABI, provider)
                const name = await tokenContract.name()
                const symbol = await tokenContract.symbol()
                const decimals = await tokenContract.decimals()
                tokens.push({ name, symbol, decimals })
            }
        }
        const isCam = supportedTokens.find(elem => elem === ethers.ZeroAddress)
        return { offChainPaymentSupported, isCam: !!isCam, tokens }
    } catch (error) {
        throw error
    }
}

async function fetchContractServices(contractAddress: string, provider: ethers.Provider) {
    const contract = createPartnerContract(contractAddress, provider)

    try {
        if (contract) {
            const [supportedServices, wantedServices, bots, supportedCurrencies] =
                await Promise.all([
                    contract.getSupportedServices(),
                    contract.getWantedServices(),
                    getListOfBots(contract),
                    getSupportedCurrencies(contract, provider),
                ])
            return { supportedServices, wantedServices, bots, supportedCurrencies }
        }
        return { supportedServices: [], wantedServices: [] }
    } catch (error) {
        return { supportedServices: [], wantedServices: [] }
    }
}

async function getContractMappings(): Promise<Map<string, string>> {
    const selectedNetwork = store.getters['Network/selectedNetwork']
    const provider = new ethers.JsonRpcProvider(selectedNetwork.rpcUrl, undefined, {
        batchMaxCount: 1,
    })
    let contractAddress = selectedNetwork.managerAddress
    const managerReadOnlyContract = new ethers.Contract(
        contractAddress,
        CMAccountManager.abi,
        provider,
    )

    const mappings = new Map<string, string>()
    try {
        const CMACCOUNT_ROLE = await managerReadOnlyContract.CMACCOUNT_ROLE()
        const roleMemberCount = await managerReadOnlyContract.getRoleMemberCount(CMACCOUNT_ROLE)

        // Sequential + per-item guard: the public Base Sepolia RPC rate-limits bursts
        // (parallel calls come back empty -> ethers CALL_EXCEPTION), and an individual
        // account can revert on getCMAccountCreator. Tolerate both instead of crashing.
        for (let i = 0; i < Number(roleMemberCount); i++) {
            try {
                const role = await managerReadOnlyContract.getRoleMember(CMACCOUNT_ROLE, i)
                const creator = await managerReadOnlyContract.getCMAccountCreator(role)
                mappings.set(role.toLowerCase(), creator.toLowerCase())
            } catch (e) {
                // skip flaky / reverting entry
            }
        }
    } catch (e) {
        console.warn('getContractMappings failed:', (e as any)?.shortMessage || (e as any)?.message)
    }

    return mappings
}

async function getRegisteredNode(address: string): Promise<string> {
    return await caminoClient.PChain().getRegisteredShortIDLink(address)
}
const getAddress = address => {
    if (address) {
        let res = caminoClient
            .PChain()
            .addressFromBuffer(caminoClient.PChain().parseAddress(address))
        return res
    }
    return ''
}

function checkMatch(data): boolean {
    if (data.supportedResult.length === 0 && data.wantedResult.length === 0) {
        return false
    }

    const supportedResultSet = new Set(data.supportedResult.map(getServiceName))
    const wantedResultSet = new Set(data.wantedResult.map(getServiceName))

    const wantedServicesSet = new Set(
        data.wantedServices?.map(service => getServiceName(service.name)),
    )
    const supportedServicesSet = new Set(
        data.supportedServices?.map(service => getServiceName(service.name)),
    )

    if (data.supportedResult.length === 0) {
        return Array.from(wantedResultSet).some(service => supportedServicesSet.has(service))
    }

    if (data.wantedResult.length === 0) {
        return Array.from(supportedResultSet).some(service => wantedServicesSet.has(service))
    }

    const match1 = Array.from(supportedResultSet).some(service => wantedServicesSet.has(service))
    const match2 = Array.from(wantedResultSet).some(service => supportedServicesSet.has(service))

    return match1 || match2
}

function getServiceName(fullName: unknown): string {
    if (typeof fullName !== 'string') {
        console.error(`Expected string, but got ${typeof fullName}:`, fullName)
        return ''
    }
    const parts = fullName.split('.')
    return parts[parts.length - 1] || ''
}

export const getBaseUrl = () => {
    const currentPath = typeof window !== 'undefined' ? window.location.hostname : ''
    if (currentPath === 'localhost' || currentPath.includes('dev')) {
        return BASE_URLS.dev
    } else if (currentPath) {
        return BASE_URLS.prod
    } else {
        return BASE_URLS.prod
    }
}

export const getBusinessBaseUrl = () => {
    const currentPath = typeof window !== 'undefined' ? window.location.hostname : ''
    if (currentPath === 'localhost' || currentPath.includes('dev')) {
        return BUSINESS_BASE_URLS.dev + '?pagination[pageSize]=1000'
    } else if (currentPath) {
        return BUSINESS_BASE_URLS.prod + '?pagination[pageSize]=1000'
    } else {
        return BUSINESS_BASE_URLS.prod + '?pagination[pageSize]=1000'
    }
}

export const groupedBusinessFields = (businessField: any) => {
    const grouped: Record<string, BusinessField> = {}
    businessField?.forEach(field => {
        const [category, subCategory] = field?.attributes?.BusinessField.split(' / ')

        if (!grouped[category]) {
            grouped[category] = {
                category,
                fields: [],
            }
        }

        grouped[category].fields.push({
            name: subCategory || field?.attributes?.BusinessField,
            active: false,
            fullName: field?.attributes?.BusinessField,
        })
    })

    return Object.values(grouped)
}

export const getPartnersWithServices = async (response: PartnersResponseType) => {
    const selectedNetwork = store.getters['Network/selectedNetwork']
    const networkName = selectedNetwork.name.toLowerCase()

    // Enrich on any network with deployed Messenger contracts (legacy gate was
    // columbus/camino only, which skipped enrichment entirely on Base Sepolia).
    if (networkName !== 'columbus' && networkName !== 'camino' && networkName !== 'base-sepolia') {
        return response
    }

    const providerUrl = selectedNetwork.rpcUrl
    const provider = new ethers.JsonRpcProvider(providerUrl, undefined, { batchMaxCount: 1 })

    const contractMappings = await getContractMappings()
    const partnersWithServices = await Promise.all(
        response.data.map(async partner => {
            const partnerCChainAddress = partner?.attributes?.cChainAddresses?.find(
                elem => elem.Network === networkName,
            )

            if (partnerCChainAddress?.cAddress) {
                const contractAddress = Array.from(contractMappings.entries()).find(
                    ([_, partnerAddress]) =>
                        partnerAddress.toLowerCase() ===
                        partnerCChainAddress.cAddress.toLowerCase(),
                )?.[0]

                if (contractAddress) {
                    const { supportedServices, wantedServices, bots, supportedCurrencies } =
                        await fetchContractServices(contractAddress, provider)

                    // TTM CMAccount service tuple is (restrictedRate, capabilities) — no fee.
                    const parsedSupportedServices =
                        supportedServices?.[0]?.map((service, index) => ({
                            name: service,
                            fee: '0',
                            rackRates: supportedServices[1][index][0],
                            capabilities: supportedServices[1][index][1],
                        })) || []

                    const parsedWantedServices = wantedServices.map(elem => ({
                        name: elem,
                    }))

                    return {
                        ...partner,
                        supportedServices: parsedSupportedServices,
                        wantedServices: parsedWantedServices,
                        contractAddress,
                        bots,
                        supportedCurrencies,
                        isOnMessenger: Boolean(partnerCChainAddress?.cAddress),
                    }
                }
            }

            return {
                ...partner,
                supportedServices: [],
                wantedServices: [],
                contractAddress: '',
                bots: [],
                supportedCurrencies: {},
                isOnMessenger: false,
            }
        }),
    )

    const validators = (await caminoClient.PChain().getCurrentValidators()).validators
    const partnersWithValidatorStatus = await Promise.all(
        partnersWithServices.map(async p => {
            const pChainAddress = p.attributes.pChainAddresses.find(
                elem => elem.Network.toLowerCase() === networkName,
            )

            if (pChainAddress?.pAddress) {
                try {
                    const nodeID = await getRegisteredNode(getAddress(pChainAddress.pAddress))
                    const isValidator = validators.some(v => v.nodeID === nodeID)
                    return { ...p, isValidator }
                } catch (error) {
                    return { ...p, isValidator: false }
                }
            }
            return { ...p, isValidator: false }
        }),
    )

    return { data: partnersWithValidatorStatus, meta: response.meta }
}

export const getPartnerData = (partners: any, companyName: string, cChainAddress: string) => {
    const selectedNetwork = store.getters['Network/selectedNetwork']

    if (!partners?.data) return null

    return (
        partners.data.find(partner => {
            const cChainAddresses = partner.attributes?.cChainAddresses ?? []

            // Case 1: Both cChainAddress and companyName are provided
            if (cChainAddress) {
                const matchingAddress = cChainAddresses.find(
                    elem =>
                        elem.cAddress?.toLowerCase() === cChainAddress.toLowerCase() &&
                        elem.Network === selectedNetwork.name.toLowerCase(),
                )

                if (matchingAddress) {
                    if (companyName) {
                        return partner.attributes?.companyName === companyName
                    }
                    return true
                }
            }

            // Case 2: Only companyName is provided
            if (companyName) {
                return partner.attributes?.companyName === companyName
            }

            return false
        }) || null
    )
}

export const getMatchingPartners = (partners: any, filters: any) => {
    const filtredMatchingPartners = partners.data
        .map(partner => {
            const isMatch = checkMatch({
                supportedResult: filters.supportedResult?.map(elem => elem.name) || [],
                wantedResult: filters.wantedResult?.map(elem => elem.name) || [],
                supportedServices: partner.supportedServices,
                wantedServices: partner.wantedServices,
            })

            // Add isMatch to the partner object
            return { ...partner, isMatch }
        })
        .filter(partner => partner.isMatch && partner.contractAddress)

    return filtredMatchingPartners
}
