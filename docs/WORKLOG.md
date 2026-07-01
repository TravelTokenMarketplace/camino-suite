# Worklog — TTM Partners dApp (Phase 1)

Chronological log of the "butcher the Camino Suite → Partners-only on Base Sepolia" work,
kept for undo/redo. Newest entries at the bottom. See `docs/PHASE1-PLAN.md` for the plan.

## Scaffold
- Forked `c4t/camino-suite` → `ttm/camino-suite` (rsync, excluded `.git`, `node_modules`,
  `dist`, `camino-wallet-sdk` submodule, `cypress`).
- `package.json`: removed `@c4tplatform/camino-wallet-sdk` (file: submodule, unused in `src/`)
  and the `preinstall` git-submodule step. Removed `.gitmodules`, `yarn.lock`, `bun.lockb`.
- `npm install --legacy-peer-deps` → clean (all public deps). Later added `bn.js`
  (was transitive via the removed sdk; imported by `helpers/usePartnerConfig.tsx`).

## A1 — Remove Module Federation remotes
- `webpack.local.js` / `webpack.dev.js` / `webpack.prod.js`: `remotes: {}` (dropped
  Explorer@5002, wallet@5003, DAC@5005).

## A2 — Local shims for the former remotes (key minimal-surgery move)
- Added `src/remote-shims/`:
  - `walletStore.ts` — MetaMask-backed replacement for the wallet Vuex `store`
    (reproduces the exact consumed surface: `state.isAuth`, `state.activeWallet.*`,
    `getters['Network/*']`, `getters['staticAddresses']`, no-op `dispatch`), plus
    `BASE_SEPOLIA` descriptor, `getReadProvider()`, `getSigner()`, `setConnected()`.
  - `AvaNetwork.ts`, `caminoClient.ts` (P/X-chain neutralised), `explorerStore.tsx`.
- `webpack.common.js`: `resolve.alias` maps `wallet/store$`, `wallet/AvaNetwork$`,
  `wallet/caminoClient$`, `Explorer/useStore$` → the shims. **No import rewrites needed**
  in the ~21 consuming files.

## A2 — MetaMask connect (replaces login)
- `src/hooks/useMetaMask.ts` — connect (`eth_requestAccounts` + switch/add Base Sepolia),
  disconnect, account/chain listeners; sets `updateAuthStatus` + `updateAccount` + shim.
- `src/components/Navbar/ConnectWallet.tsx` — Connect Wallet / `0x…` + Disconnect button.
- Rewrote `src/components/Navbar/index.tsx` to use `ConnectWallet` (removed Account,
  LoggedInAccount, idle-logout-to-/login).

## A1/A4 — Strip dead sections
- Deleted views: `wallet`, `explorer`, `vote`, `login`, `create`, `access`, `settings`,
  `landing`; `partners/{Foundation,CreateOfferForm,CreatedOffers}.tsx`.
- Deleted layout `SettingsLayout.tsx`, `CreateDepositLayout.tsx`; Navbar `Account.tsx`,
  `LoggedInAccount.tsx`, `AliasPicker.tsx`, `LoadMyKeysComponent.tsx`,
  `LoadSaveKeysComponent.tsx`; `components/LoadAccountMenu.tsx`; `Footer/LoadWalletVersion.tsx`.
- Rewrote `src/layout/RoutesSuite.tsx` → Partners-only, `/` → `/partners`.
- Relocated the partner tab bar `settings/Links.tsx` → `views/partners/Links.tsx`;
  removed the columbus/camino network gate on "My Partner Profile" (self-service on Base).
- Simplified `Footer/Version.tsx` (Suite version only).
- **Webpack build green** (`webpack --config webpack.dev.js` → compiled successfully).

## A3 — Repoint on-chain to Base Sepolia (done)
- Swapped ABIs: `helpers/CMAccountManagerModule#CMAccount.json` (TTM CMAccount, bare array,
  71 fns) and `helpers/ManagerProxyModule#CMAccountManager.json` (TTM manager wrapped as
  `{abi:[...]}`, 37 fns). Both from `ttm/camino-messenger-contracts/abi/contracts/`.
- `helpers/useSmartContract.tsx`: RPC → `selectedNetwork.rpcUrl`; manager → `selectedNetwork.managerAddress`
  (Base Sepolia `0xEcf9b5ca…FacE9` via shim); dropped columbus/camino gate (`if (activeNetwork)`);
  **signer from MetaMask** (`getSigner()`) instead of `new ethers.Wallet(ethKey)`.
- Bot-role drift fixed: `CHEQUE_OPERATOR_ROLE` → `MESSENGER_BOT_ROLE` in `partners.ts` +
  `usePartnerConfig.tsx` (TTM CMAccount role name). `createCMAccount(admin,upgrader){value}`
  already matched TTM's payable signature.
- `redux/services/partners.ts`: showroom enumeration RPC/manager repointed; P-chain helpers
  left stubbed (caminoClient shim) → no validators on Base (correct).

## A5 — Strapi → dummy API (done)
- `partners.ts` BASE_URLS/BUSINESS_BASE_URLS + `constants/route-paths.ts` CAMINO_STRAPI now use
  `process.env.STRAPI_BASE_URL || http://localhost:1337`. Frontend consumes the same envelope.
- `constants/apps-consts.ts`: APPS_CONSTS reduced to Network + Partners.
- **Webpack build green** after repoint.

## TODO (next)
- Runtime verify in browser (showroom loads from dummy API; connect MetaMask; My Partner Profile).
- docker-compose (suite + api); deploy notes; remaining backdated commits.

## Companion repo
- `ttm/partner-showroom-api` — Express dummy Strapi (built by agent): 244 partners seeded
  from live `api.strapi.camino.network`, business-fields, CRUD + `/admin`, Docker. Port 1337.
