/**
 * Stub for the `wallet/caminoClient` remote (the caminojs `ava` client used for
 * P/X/C-chain RPC). This dApp targets Base (EVM) only via ethers, so the P/X-chain
 * surface is neutralised — every method returns an empty/resolved value so any
 * stray legacy call is harmless. Aliased via webpack: 'wallet/caminoClient'.
 */
const pChainStub = {
    getRegisteredShortIDLink: async (_address?: string) => '',
    getCurrentValidators: async () => ({ validators: [] }),
    getUpgradePhases: async () => ({}),
    parseAddress: (_address?: string) => new Uint8Array(),
    addressFromBuffer: (_buf?: any) => '',
    getBlockchainID: () => '',
}

const noopChainStub = {
    getBlockchainID: () => '',
}

export const ava: any = {
    PChain: () => pChainStub,
    XChain: () => noopChainStub,
    CChain: () => noopChainStub,
    Info: () => ({ getNetworkID: async () => 1000 }),
    getNetworkID: () => 1000,
}

export default ava
