/**
 * Minimal stand-in for the caminojs `AvaNetwork` class that used to come from
 * the `wallet/AvaNetwork` remote. The host only constructs it and reads a few
 * fields (name, url, ...). We keep a permissive shape. Aliased via webpack.
 */
export class AvaNetwork {
    name: string
    url: string
    networkId: number
    [key: string]: any

    constructor(name?: string, url?: string, networkId?: number, ...rest: any[]) {
        this.name = name ?? 'base-sepolia'
        this.url = url ?? 'https://sepolia.base.org'
        this.networkId = networkId ?? 84532
        // tolerate any extra positional args the old call sites passed
        rest.forEach((v, i) => {
            this[`arg${i}`] = v
        })
    }
}

export default AvaNetwork
