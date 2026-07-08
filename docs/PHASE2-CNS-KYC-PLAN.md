# Plan — CNS + KYC/KYB prototypes on Base (Phase 2)

> Companion to `PHASE1-PLAN.md` (Partner Showroom + CMAccount manager on Base Sepolia).
> Phase 2 brings two more Camino features to Base: **CNS** first, then **KYC/KYB**.
> Status: **Workstream 1 (CNS) in progress** — see `PHASE2-WORKLOG.md` for the running log.
> Decisions below are confirmed with the operator.

## Context

Phase 1 butchered `camino-suite` into a Partner Showroom + Messenger (CMAccount) manager
repointed to **Base Sepolia (84532)** with MetaMask login. We now want two more Camino features
working on Base, same spirit ("works in the browser, looks like the original, least new code"):

1. **CNS** — Camino Name Service (ENS-style domain registration/resolution).
2. **KYC/KYB** — Sumsub identity verification exposed as an on-chain "is this address verified?"
   check + a flow to start verification.

**Sequence: CNS first, then KYC/KYB.** Both need a Base contract deployment (not done yet) and a
MetaMask-based frontend. The three dapps (Showroom+CMA, CNS, KYC) will **eventually converge in a
full rewrite** — kept in mind but out of scope now (see "Convergence" note).

All contract work targets **Base Sepolia** now (Base mainnet later), matching Phase 1.

---

## Recon findings (done)

**CNS.** Frontend `c4t/camino-name-service-frontend` and contracts `c4t/camino-name-service` both
have complete code on branch **`origin/ms2`** (working trees are checked out on empty `c4t`
branches — README only). Frontend: standalone **CRA — React 18, MUI v5, ethers v6, zustand,
react-router v6**; ENS-shaped Registry/Registrar/Resolver + payment **ERC20**. Contracts (hardhat):
`core/CNSRegistry.sol`, `core/CAMRegistrar.sol`, `core/CNSResolver.sol`, `base/*`, `interfaces/*`,
`tokens/ERC20.sol` — only ever deployed to **columbus (501)**. Login is **raw `ethers.Wallet`
(private key)**, not MetaMask (`src/store/cns.ts`, `src/utils/wallet.ts`); addresses read as
`XxxDeployment.columbus.address` across ~10 files.

**KYC/KYB.** On Camino, "verified" lived in the **native admin precompile `0x01..0a`** as per-variant
bit flags on C/P-chain — **Base has none**. Current TTM Base `CMAccountManager` has the KYC gate
**removed** (stale comment only) → **nothing verification-related exists on Base**. Templates:
`c4t/kyc-poc` (`Kyc.sol` = `address→bool` + restricted setter; `Kyc.tsx` = enter address → Sumsub
WebSDK → query verified) and `c4t/sumsub_gateway` (Go, feature-rich — see parity spec below).

**Convergence base.** `c4t/camino-suite-2.0` is a real but **aborted** modernization (Next.js + Nx
monorepo + Tailwind + Storybook + Module Federation, latest `dev` Dec 2025) — still Camino-coupled
(caminojs, Ledger-Avalanche) and incomplete. Verdict below.

---

## Workstream 1 — CNS on Base (do first)

**1a. Fork to TTM + check out the real code.** Fork both CNS repos into the
`TravelTokenMarketplace` org (all branches) and clone them to `ttm/camino-name-service` and
`ttm/camino-name-service-frontend`; work on `ms2` there (set it as the fork default branch —
it's the only real code). **Never commit in the `c4t/*` mirrors** (repo convention).

**1b. Deploy contracts to Base Sepolia.** In `ttm/camino-name-service` (ms2): add a `baseSepolia`
hardhat network (RPC `https://sepolia.base.org`, chainId 84532; deployer key via `.env` =
the **Transio deployer** `0xa087617a156B1BA6217D2f3C4da5d04D573A90F1`, key never committed) and
run the existing hardhat-deploy scripts: Registry → Registrar (`cam` TLD) → Resolver → the three
demo ERC20s; wire references via `scripts/setup.ts`. Record addresses (hardhat-deploy writes
`deployments/baseSepolia/`).

Recon findings that simplify this (verified Jul 2026):
- **Native-coin payment already works on ms2 tip** — `CAMRegistrar` treats token `0x000…0` as
  native with a base price set in the constructor, and the frontend handles the zero-address
  path. On Base that's plain ETH registration, so **no ERC20 faucet is required**; the demo
  ERC20s (+ `mock-tokens` mint page) stay as the optional token path.
- **Bug:** `deploy/registrar.ts` passes 2 constructor args but the ms2-tip constructor is
  `(CNS cns, string tld, uint256 camBasePrice)` — add the missing base price (deploy fails
  otherwise; the script predates the native-payment commit).

**1c. Repoint the frontend (mirror the Phase-1 MetaMask move).** In
`ttm/camino-name-service-frontend` (ms2):
- `src/contracts/deployments/{Registry,Registrar,Resolver}.json`: add a `baseSepolia` entry with the
  deployed addresses + a `Token.json` deployment for the ERC20; replace the ~10 `.columbus.address`
  reads with the base key (a single `NETWORK`/`ACTIVE_DEPLOYMENT` constant in
  `src/utils/contracts/common.ts` to avoid scattering).
- `src/utils/wallet.ts`: `getProvider()` → Base Sepolia `JsonRpcProvider` (84532, `{batchMaxCount:1}`
  per Phase-1 RPC-batching gotcha); **swap the raw `ethers.Wallet` login for a MetaMask
  `BrowserProvider` signer** (`eth_requestAccounts` + `wallet_switchEthereumChain`/`addEthereumChain`
  to Base Sepolia), updating `src/store/cns.ts` `login/wallet` typing and the wallet login page
  (`src/pages/wallet/index.tsx`).
- Strip Camino P/X-chain bech32 address display in `src/utils/common.ts` (and any `columbus` UI
  labels in `TLNavbar.tsx`).

**1d. Verify:** `npm start`, connect MetaMask on Base Sepolia, search a name, approve ERC20, register
a domain, set resolver/address, confirm on `base-sepolia.blockscout.com`.

---

## Workstream 2 — KYC/KYB on Base (after CNS)

Three pieces: a Base **KYCRegistry** contract, a **minimal MetaMask frontend**, and a **tiny Node
gateway** with functional parity to `sumsub_gateway` (real Sumsub) **plus a mock toggle**.

**2a. `KYCRegistry` contract (Base Sepolia) — UUPS-upgradeable.** Adapt `kyc-poc/Kyc.sol` (already
`Initializable` + `AccessControlUpgradeable`, so upgradeability is nearly free): add
`UUPSUpgradeable` + `_authorizeUpgrade` guarded by `DEFAULT_ADMIN_ROLE`, deploy behind an ERC1967
proxy (same pattern as the TTM CMAccount). Store per-address verified state per **variant**
(`KYC_BASIC`, `KYB_BASIC`) — a small struct/enum mapping instead of the precompile's packed bit
offsets. Public reads: `isVerified(address)`, `isKYB(address)`, `getState(address)`. Restricted
writer: `setVerified(address, variant, bool)` guarded by `ORACLE_ROLE` (gateway oracle key; admin
panel in mock mode). **Make it ERC-2771-aware** (`_msgSender()` via a trusted forwarder) so
meta-tx / gas-sponsoring can be added later without a contract change (see Gas sponsoring below).

**2b. Minimal frontend (new small CRA, MetaMask).** Modeled on `kyc-poc/src/Kyc.tsx` but MetaMask-based:
Connect Wallet → **Start verification** (KYC or KYB): request nonce → `personal_sign` it → POST for
a Sumsub access token → render `@sumsub/websdk-react`. **Check status**: read `isVerified` from the
Base contract directly via ethers (no backend needed for reads). Plus a **demo admin panel** with a
**real ⇄ mock toggle** (2d) and, in mock mode, an "approve address" button.

**2c. Tiny Node/Express gateway — functional parity with `sumsub_gateway`.** ~1 small service (like
Phase-1 `partner-showroom-api`), **keeping**:
- **`GET /nonce`** — server-signed, timestamp+entropy nonce (freshness/replay protection).
- **`POST /accessToken`** — verify `{nonce, signature, publickey}` (ownership proof: recovered signer
  == pubkey), then Sumsub `GenerateAccessToken(externalID = wallet address, variant)`. Enforce
  allowed variants (KYC_BASIC/KYB_BASIC).
- **`POST /webhook/applicant_reviewed`** — verify Sumsub webhook HMAC signature; map review answer +
  Sumsub level → variant/verified; **write `setVerified` on the Base KYCRegistry** (replaces the
  precompile writer); persist state to a JSON/SQLite store (replaces Firestore).
- **`GET /verified/{network}/{address}`** — parity read endpoint (also served directly on-chain by the
  frontend).
- **`GET /sync`** (admin) — reconcile store → re-publish `setVerified` on Base for any missed webhooks.
- **Sumsub REST request signing** (HMAC + timestamp), `IsVerified` review logic, level→variant map,
  and admin helpers **`UpdateExternalID` / `GetApplicantIDByExternalID`**.

**Deliberately dropped/simplified for Base (flagging for operator OK — not functionality loss in the
Base context):**
- **P_CHAIN + per-chain bit-flag offsets** → Base is one EVM chain; a variant enum on one contract
  replaces packed precompile flags.
- **Firestore** → lightweight JSON/SQLite store (on-chain state is the source of truth for reads).
- **Multi-network fan-out** → keep the `{network}` shape but only Base configured.

**2d. Real ⇄ mock toggle (demo admin panel).** A gateway env/flag (surfaced in the admin panel):
- **Real mode:** full Sumsub flow above (requires a Sumsub **API token, webhook secret, and a
  level→variant config**).
- **Mock mode:** `/accessToken` returns a stub / the WebSDK step is skipped; the admin "approve"
  button calls `setVerified` directly via the oracle key. No Sumsub account needed. Same
  `KYCRegistry` either way, so the on-chain read path is identical.

**2e. Verify:** mock mode end-to-end (connect → admin-approve → status flips to verified on-chain);
then, once creds are provided, real mode (nonce→sign→token→WebSDK sandbox→webhook→on-chain verified).

---

## Upgradeability & gas sponsoring (decisions)
- **Upgradeability — now for the new contract, deferred for CNS.** `KYCRegistry` ships UUPS-upgradeable
  from day one (template is already upgrade-ready; see 2a). The **CNS ms2 contracts are plain
  immutable** (constructors, non-upgradeable OZ AccessControl/ERC721) — converting all 6 to
  Initializable/UUPS + proxies is disproportionate surgery for a prototype and risks breaking working
  code, so **leave CNS non-upgradeable now** and revisit at the rewrite. (Flag: revisit if CNS
  upgradeability is wanted now — it's a real sub-task, not a tweak.)
- **Gas sponsoring — second pass, platform-wide; architected-for now.** Note that KYC's `setVerified`
  writes are **already operator-paid** (gateway oracle key submits), so a user never spends ETH to get
  verified — the KYC flow is effectively sponsored already. The broader goal ("operator holds
  **Monerium EURe**, not ETH" — **currency confirmed by operator, Jul 2026: Monerium EURe**)
  spans CNS registration, CMAccount ops, and camino-suite, so it's best
  solved **once** rather
  than bespoke per dapp: either an **ERC-4337 ERC-20 paymaster** (Base has Coinbase/Pimlico/Biconomy
  paymasters that let users pay gas in an ERC-20) or an **ERC-2771 relayer that accepts EURe**. We bake
  ERC-2771 `_msgSender()` into `KYCRegistry` now (non-breaking), and take gas sponsoring as a dedicated
  cross-cutting pass covering all three dapps + the suite.

## Convergence stack (later, not now) — recommendation
For the eventual 3-dapp merge + rewrite: **do not build on `camino-suite-2.0`** — it's aborted, Nx/
Module-Federation-heavy, and still Camino-L1-coupled. Take its good instincts (Next.js + Tailwind +
Storybook) but start fresh on a current (Jul 2026) stack: **Next.js (App Router) or Vite + React 19,
wagmi + viem + a connect-kit (RainbowKit/ConnectKit) replacing bespoke MetaMask code, Tailwind +
shadcn/ui, TanStack Query.** Decide at rewrite time; the three prototypes stay standalone until then.

## Notes / risks
- ~~CNS payment ERC20 must be mintable/faucet-able so demo wallets can register~~ — superseded:
  ms2-tip native-coin payment means demo wallets register with plain Base Sepolia ETH (see 1b);
  the demo ERC20s remain as the optional token path.
- Keep the Phase-1 RPC gotcha: all `JsonRpcProvider`s on `sepolia.base.org` use `{batchMaxCount:1}`.
- Backdate/commit style per repo convention (no AI co-author trailers on the TTM/public repos).
- Reuse the Phase-1 MetaMask connect pattern from `ttm/camino-suite/src/hooks/useMetaMask.ts` as the
  reference implementation for both frontends.
