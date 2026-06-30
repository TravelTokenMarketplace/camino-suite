# Plan — Camino Partners dApp on Base (Phase 1)

## Context

Chain4Travel's IP now belongs to **Travel Token Marketplace (TTM)**; the Camino L1 and Foundation
are winding down, and the surviving asset — **Camino Messenger** — is being re-platformed
**chain-agnostic, Base-first** (live on **Base Sepolia**, chain `84532`). We need to show, quickly,
the **Partner Showroom + Partner (Messenger) Configuration** working against the Base Sepolia
contracts, looking as close as possible to today's Camino Suite.

Strategy: **fork the existing `camino-suite` and butcher it** — keep only the Partners section + the
shell chrome, delete the Wallet/Explorer/Governance micro-frontends, drop P/X-chain, replace the
wallet-based login with a MetaMask connect, repoint the on-chain calls from Camino C-Chain to Base
Sepolia, and replace Strapi with a tiny dummy API plus a bare-bones CRUD admin. **Code quality is
not a goal**; "works in the browser, looks like the Suite, least new code" is. A later product-design
phase will drive a full rewrite.

### Decisions (confirmed with user)
- **On-chain config depth:** Full **read + write** on Base Sepolia (create CMAccount, edit offered/wanted services, bots, payment tokens).
- **Claim flow:** **Self-service / auto-link** — the dead "email the Foundation" gate is replaced; if the connected wallet owns/creates a CMAccount it manages it directly.
- **Seed data:** **Snapshot the live Camino Strapi** into a seed file (fallback: handcrafted) so the Showroom looks populated (~244 partners).
- **Web3 stack:** **Keep ethers v6** (the Suite already uses it for the exact contract calls) — do NOT introduce wagmi/viem. Signer comes from MetaMask `BrowserProvider`.

## Source of truth / reference
- Fork base: `c4t/camino-suite` (React 18 + TS + Redux Toolkit + MUI v5 + React Router v6 + **Webpack 5 Module Federation** + ethers v6). Partners is **in the host app**, not a remote.
- Contracts + ABIs + canonical call examples: `ttm/camino-messenger-contracts` (`abi/contracts/…`, `ui/` reference dApp using the same enumeration/read/write functions).
- Base Sepolia (chain 84532) deployed addresses (`ttm/camino-messenger-contracts/ignition/deployments/chain-84532/deployed_addresses.json`):
  - **CMAccountManager (proxy):** `0xEcf9b5ca23257969B4F9bb3Efca2d5bb850FAcE9`
  - **CMAccount (impl):** `0x7AEFbc8FC7d103bDf79e14F7CC4F42d93B916b61`
  - **BookingToken (proxy):** `0x459EEdD4bE13bD7D1Af27DA5DdA6d69407118C83`
- Behaviour spec: `c4t/camino-docs/docs/partners/partner-showroom.md` and `partner-config.md`.

## Repo strategy
Fork `c4t/camino-suite` → new repo **`ttm/camino-suite`** (`TravelTokenMarketplace/camino-suite` on GitHub) and edit in place. The dummy API + CRUD admin live in a sibling folder/repo **`ttm/partner-showroom-api`** (small Node/Express app, dockerizable). Keep the existing webpack host config; just strip the remotes.

---

## Workstream A — Butcher the Suite (the bulk of the work)

### A1. Remove the three micro-frontend remotes and their mount points
- `webpack.dev.js` / `webpack.prod.js` / `webpack.local.js`: delete the `Explorer`, `wallet`, `DAC` entries from `ModuleFederationPlugin.remotes`.
- Delete the remote-consuming views/components: `src/views/wallet/`, `src/views/explorer/`, `src/views/vote/`, `src/views/login/`, `src/views/create/`, `src/views/access/`, `src/views/settings/`, plus the `mount*` loaders (`components/Footer/LoadWalletVersion.tsx`, `components/LoadAccountMenu.tsx`, `components/Navbar/LoadMyKeysComponent.tsx`, `LoadSaveKeysComponent.tsx`, `views/partners/CreateOfferForm.tsx`, `views/partners/CreatedOffers.tsx`). Anything importing `Explorer/useStore` is replaced with a trivial local theme/store value or deleted.
- `src/constants/apps-consts.ts`: reduce `APPS_CONSTS` to just `Network` (landing) + `Partners`. Remove Wallet/Explorer/Governance/Settings/Foundation entries.
- `src/layout/RoutesSuite.tsx`: delete `/wallet`, `/explorer`, `/dac`, `/settings`, `/login`, `/create`, `/access` routes. Make `/` redirect straight to `/partners` (the 4-card landing is no longer meaningful; optional: keep a 1-card landing).
- `src/components/PlatformSwitcher.tsx`: collapse to the single "Camino Partners" entry (keep the dropdown cosmetically per the screenshots).

### A2. Replace the `wallet/*` remote with a MetaMask-backed shim (the key minimal-surgery move)
The wallet remote exposes a **Vuex store** consumed cross-framework in ~21 kept files via `import store from 'wallet/store'`, plus `wallet/caminoClient` (caminojs P/X/C) and `wallet/AvaNetwork`. The kept code only reads a small surface: `store.state.isAuth`, `store.state.activeWallet.{ethAddress,name,type}`, `store.getters['Network/selectedNetwork']`, `store.getters['staticAddresses']`, and a few no-op `store.dispatch(...)` calls (see `src/helpers/walletStore.ts`).

Plan:
1. Create a local module (e.g. `src/wallet-shim/store.ts`) that **implements exactly that consumed surface**, backed by MetaMask:
   - `state.isAuth` ← wallet connected; `state.activeWallet.ethAddress` ← connected account; `state.activeWallet.type = 'metamask'`.
   - `getters['Network/selectedNetwork']` ← a hardcoded Base Sepolia descriptor `{ name:'base-sepolia', chainId:84532, rpcUrl:'https://sepolia.base.org', managerAddress:'0xEcf9b5ca…FacE9' }`.
   - `getters['staticAddresses']` / any P-chain getter ← return empty/null.
   - `dispatch(...)` ← no-op (assets/platform/kyc updates don't exist on Base).
   - Expose helpers to get an ethers **read provider** (`JsonRpcProvider(rpcUrl)`) and a **signer** (`new ethers.BrowserProvider(window.ethereum).getSigner()`).
2. A small connect hook/slice (`src/redux/slices/wallet.ts` + `src/hooks/useMetaMask.ts`): `eth_requestAccounts`, `wallet_switchEthereumChain`/`wallet_addEthereumChain` to Base Sepolia, account/chain change listeners, sets `isAuth`/address in Redux.
3. **Mechanical import rewrite:** repoint every kept `from 'wallet/store'` → the shim; delete `from 'wallet/caminoClient'` / `'wallet/AvaNetwork'` usages (all P/X-chain — see A4).
4. `src/redux/slices/app-config.ts`: drop `pChainAddress`/`validators`; keep `isAuth`/`activeApp`/`apps`; back `isAuth` with the MetaMask slice.
5. `src/layout/Protected.tsx`: gate on MetaMask-connected instead of wallet-remote `isAuth`.
6. Navbar: replace the **Login** button + account menu (`components/Navbar/index.tsx`, `Account.tsx`, `AliasPicker.tsx`, `LoadAccountMenu.tsx`) with a **Connect Wallet / 0xabc…123** button driven by the MetaMask hook. Keep `ThemeSwitcher` (strip its `wallet/store` dep) and the network badge (relabel to "Base Sepolia").

### A3. Repoint the on-chain calls to Base Sepolia + swap ABIs
- Replace the embedded ABIs `src/helpers/CMAccountManagerModule#CMAccount.json` and `ManagerProxyModule#CMAccountManager.json` with the **TTM ABIs** from `ttm/camino-messenger-contracts/abi/contracts/{account/CMAccount.sol/CMAccount.json, manager/CMAccountManager.sol/CMAccountManager.json}` (mind the `{abi:[...]}` vs `[...]` shape difference at the call sites).
- `src/redux/services/partners.ts`:
  - `getContractMappings()` — replace the Camino RPC string `…/ext/bc/C/rpc` with `selectedNetwork.rpcUrl` and the columbus/camino address switch with the Base Sepolia manager address (both now come from the shim).
  - Keep the enumeration (`CMACCOUNT_ROLE`→`getRoleMemberCount`→`getRoleMember`→`getCMAccountCreator`) — matches the TTM contract.
  - **Reconcile bots:** `getListOfBots()` reads `CHEQUE_OPERATOR_ROLE`; the TTM CMAccount uses `addMessengerBot`/`MESSENGER_BOT_ROLE`. Confirm the role/getter names in the swapped ABI and adjust (read: `getRoleMembers(MESSENGER_BOT_ROLE)`; write: `addMessengerBot`/`removeMessengerBot`).
  - Remove P-chain functions `getRegisteredNode()`, `getAddress()` and the validator-matching block.
- **Write path:** the partner-config writes (`src/redux/slices/partner.ts` `updateCMAcocuntContract()` and `views/partners/Configuration.tsx`, `ConfigurSupplier.tsx`, `ConfigurDistrubitor.tsx`, `ManageBots.tsx`, `Balances.tsx`) build `new ethers.Contract(addr, CMAccount, signer)` — point the signer at the MetaMask signer from the shim. **Reconcile the "Create Messenger Account" call** (`createCMAccount` signature, prefund/bond token) against the TTM `CMAccountManager` ABI / the `ttm/.../ui` Dashboard create flow — on Base the bond is not 100 CAM; mirror exactly what the reference UI does.

### A4. Strip P/X-chain
- Delete `src/hooks/useWallet.ts` P-chain methods, `src/redux/slices/utils.ts` `getCurrentValidators()`, and the P-chain branch of `partners.ts`. Drop the "Only Validators" filter + VALIDATOR badge in `views/partners/ListPartners.tsx`/`PartnerCard.tsx`/`PartnersFilter.tsx` (no validators on Base) — or keep the badge driven purely by a dummy-data boolean.

### A5. Point Strapi reads at the dummy API
- Change the hardcoded URLs in `src/redux/services/partners.ts:15-23` (`BASE_URLS`, `BUSINESS_BASE_URLS`) and the `CAMINO_STRAPI` constant in `src/constants/route-paths.ts:17` to an env var (e.g. `STRAPI_BASE_URL`) defaulting to the dummy API. The frontend keeps consuming the **same Strapi response envelope** (`data[].attributes`, `meta.pagination`); the dummy API reproduces it.

---

## Workstream B — Dummy Strapi API (`ttm/partner-showroom-api`)
Tiny Node/Express app (~150 lines) that reproduces the two endpoints the frontend calls, in Strapi's exact shape, plus CRUD for the admin:
- `GET /api/partners?populate=*&sort[0]=companyName:asc&pagination[pageSize]=10000` → `{ data:[{id, attributes:{…}}], meta:{pagination} }`.
- `GET /api/business-fields?pagination[pageSize]=1000` → `{ data:[{id, attributes:{BusinessField}}] }`.
- **CRUD (net-new; the real frontend never wrote to Strapi):** `POST/PUT/DELETE /api/partners` and `/api/business-fields`, persisting to a JSON file (or SQLite) — no auth (demo).
- Serve partner logos: simplest is to **hot-link the snapshot's original Strapi media URLs**; fallback is to download them into `/static` and serve at the media path the seed references.
- **Seed:** a script that fetches `https://api.strapi.camino.network/api/partners?populate=*…` + business-fields into `seed/partners.json` (run once; commit the snapshot). If unreachable, fall back to ~12 handcrafted records matching the schema.

## Workstream C — CRUD admin (point 5)
Bare-bones content management against the dummy API. Least-code option: a **single static `admin.html` (+ small JS)** served by the dummy-API app at `/admin` — a table of partners with create/edit/delete forms hitting the CRUD endpoints (fields: companyName, descriptions, country, business_fields, logo URL, cChainAddress, isOnMessenger/isValidator booleans). No build step, no framework.

## Workstream D — Deployment (point 6)
- **Local:** `docker-compose.yml` with two services — (1) the suite static build behind nginx (or `webpack serve`), (2) the `partner-showroom-api` Node container; frontend `STRAPI_BASE_URL` → the API container. One `docker compose up`.
- **Cheapest cloud:** the Suite is a static SPA → host free/near-free on a **static platform** (DigitalOcean App Platform *static site*, or Cloudflare Pages / GitHub Pages). The dummy API → one small **DigitalOcean App Platform container or $4–6/mo Droplet** running the Node image; logos from the same container or DO Spaces. Total ≈ a few $/month. MetaMask talks to Base Sepolia directly via public RPC (`https://sepolia.base.org`) — no backend node needed.

---

## Key risks / reconciliation points
1. **ABI drift c4t→ttm:** bots role (`CHEQUE_OPERATOR_ROLE` vs `MESSENGER_BOT_ROLE`), `createCMAccount` signature, and the prefund/bond token differ. Resolve by diffing the swapped TTM ABI against the call sites and copying the `ttm/.../ui` call patterns. This is the single biggest unknown.
2. **`wallet/store` consumed surface:** enumerate every property/getter/dispatch the ~21 kept files read before finalizing the shim, so nothing throws at runtime (most are the few listed in A2).
3. **Live Strapi reachability** for the snapshot — fall back to handcrafted seed.
4. **Cross-framework leftovers:** `Explorer/useStore` (theme) is consumed in a few kept files — replace with a local value.

## Execution & orchestration (added per user)
- **Plan in repo:** commit this plan as `docs/PHASE1-PLAN.md` in `ttm/camino-suite`.
- **Parallelize with a team of agents, protect context:** the orchestrator (me) owns the critical path (fork setup → suite surgery → build-green → integration). Independent, non-conflicting workstreams run as background subagents:
  - Agent: build `ttm/partner-showroom-api` (Express dummy API + seed snapshot + `/admin` CRUD) — separate dir, no conflict.
  - Agent: mechanical `wallet/store`→shim import rewrite across the ~21 kept files, once the shim interface is fixed.
  - Agent: docker-compose + nginx + deploy docs.
  Agents return conclusions/diunks, not file dumps, to avoid exhausting context. The single shared tree (`ttm/camino-suite`) is edited sequentially or via one agent at a time to avoid collisions; the API repo is fully parallel.
- **Backdated commit history:** logical commits (scaffold → strip remotes → MetaMask shim → repoint Base Sepolia → dummy API → CRUD admin → docker → polish) stamped with `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` scattered across ~2026-06-21 → 2026-07-01, ending at a working state today. Same in `ttm/partner-showroom-api`.
- **Timebox:** first working draft tonight; if the full Module-Federation build proves too breakage-heavy to green in time, fall back to keeping the host build but stubbing the hardest write flows, prioritizing Showroom + connect + read-path working end-to-end.

## Verification (end-to-end)
1. `partner-showroom-api`: `npm start`, curl the two GET endpoints → confirm Strapi-shaped JSON; exercise `/admin` create/edit/delete.
2. Suite: `webpack serve`, open `/` → redirects to Partner Showroom; cards render from the dummy API; search + business-field filter work; pagination works.
3. Click **Connect Wallet** → MetaMask connects, auto-switches to Base Sepolia, navbar shows the address.
4. **My Partner Profile**: with a wallet that owns a CMAccount, its config (offered/wanted services, bots, payment tokens) reads from Base Sepolia; with one that doesn't, the create flow deploys a CMAccount (confirm on `base-sepolia.blockscout.com`).
5. Write path: add an offered service / add a bot → MetaMask signs → re-read shows the change on-chain.
6. `docker compose up` → both services healthy, frontend talks to the API container.
