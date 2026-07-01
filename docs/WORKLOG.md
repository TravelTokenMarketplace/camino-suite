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

## Runtime verification + fixes (browser)
- Ran dummy API (:1337) + suite dev-server (:5001). Showroom renders **244 partners** from
  the dummy API — matches the original Suite (branding, cards, filters, "Register As Partner").
- Fixed runtime crashes from ABI drift:
  - `usePartnerConfig.getSftContract` read legacy `getPrefundAmount`/`getServiceFeeToken`
    (absent on TTM manager) → short-circuited to native-ETH defaults.
  - Hardened `useSmartContract.readFromContract/writeToContract` to no-op on missing methods.
  - Shim `Network/allNetworks` → single entry (killed duplicate-key warning in NetworkSwitcher).
- Fixed broken partner logos: `CAMINO_STRAPI` had a trailing slash → `//uploads` 404 on
  express.static; dropped the slash (urls already start with `/uploads/`).

## Live-chain validation
- Queried the Base Sepolia CMAccountManager (`0xEcf9b5ca…`) directly: chainId 84532,
  `CMACCOUNT_ROLE` resolves, **12 CMAccounts registered**; `getRoleMember`/`getCMAccountCreator`
  work. Confirms the on-chain read path works against the live contracts (not just compiles).

## Self-service "claim" (Foundation is gone)
- `PartnersLayout.tsx`: replaced the "Claim a profile → email the Foundation" gate. Any
  connected wallet now reaches the Messenger config `Outlet` + sub-tabs directly. Stale
  redirects to the deleted `/login` now go to `/partners`.
- `RoutesSuite.tsx`: messenger-configuration index → redirect to `mymessenger` (the
  Create/Manage Messenger Account screen). If the wallet created one of the on-chain
  CMAccounts, `useSmartContract` auto-loads it; otherwise it shows Create.

## Deployment (docker + notes)
- `Dockerfile` (multi-stage node build → nginx), `nginx.conf` (SPA fallback), `docker-compose.yml`
  (api :1337 + web :8080), `webpack.common.js` `Dotenv({systemvars:true})`, `package.json`
  `build:docker`, `docs/DEPLOY.md` (local + cheapest cloud: static SPA + one small API container,
  ~$4–6/mo; Base Sepolia public RPC = no node infra). `docker compose config` validates.
- `ttm/partner-showroom-api` has its own backdated git history (5 commits, 2026-06-24 → 06-30).

## Status: Phase 1 complete
Showroom (244 partners) + connect MetaMask + self-service Messenger config on Base Sepolia,
all in the browser. Remaining manual check: MetaMask *write* flows (create CMAccount / edit
services / bots) need a funded Base Sepolia wallet.

## Companion repo
- `ttm/partner-showroom-api` — Express dummy Strapi (built by agent): 244 partners seeded
  from live `api.strapi.camino.network`, business-fields, CRUD + `/admin`, Docker. Port 1337.
