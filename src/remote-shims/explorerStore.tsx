/**
 * Stub for the `Explorer/useStore` remote (a small React context the explorer
 * micro-frontend exposed). The host only used: ExplorerStoreProvider (wrapper),
 * and useStore() -> { updateNetworks, changeNetworkExplorer, changeTheme, state }.
 * Theme actually lives in the host's own redux `theme` slice, so these are no-ops.
 * Aliased via webpack: 'Explorer/useStore' -> this file.
 */
import React from 'react'

export const ExplorerStoreProvider = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>
}

const noop = (..._args: any[]) => undefined

export function useStore() {
    return {
        updateNetworks: noop,
        changeNetworkExplorer: noop,
        changeTheme: noop,
        state: { appConfig: { commitHash: '' } } as any,
    }
}

export default { ExplorerStoreProvider, useStore }
