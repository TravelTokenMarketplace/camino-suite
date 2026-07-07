# CLAUDE.md — camino-suite (TTM Partners dApp)

Orientation for AI agents. This is a **Phase-1 fork of the Camino Suite**, butchered down
to the **Partners** section and repointed to **Camino Messenger on Base Sepolia**. Optimize
for "works in the browser, looks like the Suite, least new code" — not code quality. A full
rewrite comes later. See `docs/PHASE1-PLAN.md` and `docs/WORKLOG.md` for the full story.

## Run / verify
- Needs the dummy Strapi API running first: `cd ../partner-showroom-api && npm start` (:1337).
- Dev server: `npm start` (webpack-dev-server, :5001). Build check: `npx webpack --config webpack.dev.js`.
- babel-loader strips types, so **webpack only catches module-resolution/syntax errors** — a
  green build ≠ type-safe. There is no meaningful test suite.

## Architecture you must know
- **The former micro-frontend remotes are gone.** `wallet/*`, `Explorer/*`, `DAC/*` are not
  loaded. The few remote specifiers the kept code still imports are redirected to local shims
  via `resolve.alias` in `webpack.common.js`:
  - `wallet/store` → `src/remote-shims/walletStore.ts` — a MetaMask-backed stand-in for the
    old Vuex store. Exposes exactly the consumed surface: `state.isAuth`,
    `state.activeWallet.ethAddress`, `getters['Network/*']`, `getters['staticAddresses']`,
    no-op `dispatch`. Also exports `BASE_SEPOLIA`, `getReadProvider()`, `getSigner()`,
    `setConnected()`. **Editing the shim is usually how you satisfy new `store.*` reads.**
  - `wallet/AvaNetwork`, `wallet/caminoClient` (P/X-chain neutralised), `Explorer/useStore`.
- **Auth = MetaMask.** `src/hooks/useMetaMask.ts` + `src/components/Navbar/ConnectWallet.tsx`.
  It sets Redux `appConfig.isAuth`/`account` and the shim's `setConnected`.
- **On-chain lives in `src/helpers/useSmartContract.tsx`** (`SmartContractProvider`): builds
  ethers read provider + MetaMask signer, manager + CMAccount contracts. `usePartnerConfig.tsx`
  layers the create/config flows. Showroom enrichment is in `src/redux/services/partners.ts`.
- **Contracts:** manager `0xEcf9b5ca23257969B4F9bb3Efca2d5bb850FAcE9` on Base Sepolia (84532).
  ABIs in `src/helpers/{CMAccountManagerModule#CMAccount.json, ManagerProxyModule#CMAccountManager.json}`
  — these are the **TTM** ABIs (from `../camino-messenger-contracts/abi`). The reference
  dApp `../camino-messenger-contracts/ui` is the canonical example of every contract call.
- **Strapi → dummy API.** `partners.ts` + `constants/route-paths.ts` read
  `process.env.STRAPI_BASE_URL` (default `http://localhost:1337`), same Strapi v4 envelope.

## Gotchas that already bit us (don't regress)
- **Address has no `0x` in the shim.** The suite does `'0x' + activeWallet.ethAddress`
  everywhere, so `setConnected` stores **bare hex**. Storing the full `0x…` gives `0x0x…`.
- **ABI drift c4t→ttm.** Old methods like `getServiceFeeToken` / `getPrefundAmount` don't
  exist on the TTM manager; bots use `MESSENGER_BOT_ROLE` (not `CHEQUE_OPERATOR_ROLE`).
  `readFromContract`/`writeToContract` no-op on missing methods; don't reintroduce hard calls
  to removed methods.
- **Prefund is native ETH, optional, no minimum.** `createCMAccount(admin, upgrader)` is
  payable; the old "100 CAM" rule was removed. Keep amounts/labels in ETH.
- **Public RPC batching.** `sepolia.base.org` mishandles batched `eth_call`s → `CALL_EXCEPTION`
  on calls that work individually. All `JsonRpcProvider`s use `{ batchMaxCount: 1 }`. For heavy
  use, point `BASE_SEPOLIA.rpcUrl` at a dedicated key.
- **Enumerating CMAccounts** (getRoleMember/getCMAccountCreator) is sequential + per-item
  try/catch to survive flaky RPC. Don't switch back to `Promise.all` without guards.

## Git
Commit with the real current date and **no AI co-author trailers**. Public repo:
`TravelTokenMarketplace/camino-suite`. Companion (private): `partner-showroom-api`.
