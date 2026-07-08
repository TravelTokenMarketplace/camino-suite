# Worklog — Phase 2: CNS + KYC/KYB on Base (Workstream 1: CNS)

Chronological log of the Phase-2 work, kept for undo/redo. Newest entries at the bottom.
See `docs/PHASE2-CNS-KYC-PLAN.md` for the plan; Phase-1 history is in `docs/WORKLOG.md`.

## Kickoff (2026-07-08)
- Operator confirmed the gas-sponsoring currency: **Monerium EURe** (was ambiguously "EURI");
  annotated in `PHASE2-CNS-KYC-PLAN.md`.
- Plan doc updated: Workstream 1a rewritten to the fork-to-TTM convention (fork both CNS repos
  into `TravelTokenMarketplace`, work in `ttm/` clones on `ms2`; `c4t/*` mirrors untouched).
- Recon folded into the plan doc:
  - `CAMRegistrar` on ms2 tip supports **native-coin payment** (zero-address token, base price
    from constructor `camBasePrice`; frontend `Register.tsx`/`Expiration.tsx`/
    `utils/contracts/registrar.ts` handle it) → demo registers with plain Base Sepolia ETH,
    ERC20 faucet optional.
  - `deploy/registrar.ts` passes 2 constructor args but ms2-tip constructor is
    `(CNS cns, string tld, uint256 camBasePrice)` → needs the third arg or deploy reverts.
  - Deploy identity: **Transio deployer** `0xa087617a156B1BA6217D2f3C4da5d04D573A90F1`
    (key via gitignored `.env`, never committed; personal wallet stays out per repo convention).
    Base Sepolia balance at kickoff: 0.0055 ETH.

## 1a — Fork to TTM (2026-07-08)
- GitHub forking is **disabled** on the c4t origins (both repos are **private** in
  `chain4travel`), so a real `gh repo fork` is impossible — same situation Phase 1 hit with
  the suite. Followed the Phase-1 pattern instead: fresh TTM repos with a squashed
  "Fork … as base" initial commit from the `origin/ms2` tree (`git archive origin/ms2`, c4t
  clones untouched).
- Created `TravelTokenMarketplace/camino-name-service` + `…-frontend` as **private** (the
  public-port convention — suite, messenger-contracts — applied to repos whose origins were
  public; these origins are private, so publishing is the operator's call — flip visibility
  when ready). Branch `main` (matches suite), initial commits `fb4b364` / `5e02e2d`, pushed.
- Local clones live at `ttm/camino-name-service` and `ttm/camino-name-service-frontend`;
  contracts repo `.gitignore` already covers `.env`.

## 1b — Contracts deployed to Base Sepolia (2026-07-08)
- `hardhat.config.ts`: added `baseSepolia` network (`BASE_SEPOLIA_URL` default
  `https://sepolia.base.org`, chainId 84532, same `PRIVATE_KEY` env as columbus).
- `deploy/registrar.ts`: added the missing 3rd constructor arg — **native base price
  0.0001 ETH/yr** (`parseEther("0.0001").toString()`); added
  `func.dependencies = ["CNSRegistry"]` (script sorts alphabetically *before* registry.ts but
  `deployments.get("CNSRegistry")`s — columbus must have been deployed tag-by-tag).
  Same dependency added to `deploy/resolver.ts`.
- `deploy/token.ts`: populated the empty `tokensToDeploy` with the columbus trio
  (Happy/HT, Joy/JT, Excite/ET — matches `scripts/setup.ts` lookups; `ERC20Token.mint` is
  unrestricted → self-serve faucet).
- Cosmetics: `"CAM"` balance labels → `"ETH"` across `deploy/*.ts` + `scripts/*.ts`.
- `npx hardhat deploy --network baseSepolia` (deployer = Transio `0xa087…90F1`, Node v26
  warning from hardhat 2.22.5 — harmless). **Deployed addresses** (in `deployments/baseSepolia/`):
  - CNSRegistry `0xaad1659A9DFF8b6eF0cE2315766ACfF6818ACA9a`
  - CAMRegistrar `0xd53b178C0C12C73529b7013cC3eD355617559191`
  - CNSResolver `0xd6411Ec30dC433Cd469Ec62c4ed743377aeafBe3`
  - Happy Token `0xd2C51b1b80327157a258Dc2515EBc532B165fe48`, Joy Token
    `0x76674DbFDdcF2061825fde06Ad058cb6cfc5E43a`, Excite Token
    `0x336E12B4Ef7a926e3c0fBd695033C94Aa8550cA9`
- `scripts/setup.ts` on baseSepolia: cam TLD → registrar, ERC20 prices approved (20 HT / 5 JT /
  100 ET per yr), resolver set. Verified via new `scripts/check-base.ts`: cam owner ==
  registrar, native price 0.0001 ETH/yr, cam resolver == CNSResolver. Whole deploy+setup cost
  ~0.00015 ETH (balance 0.0054 ETH after).

## 1c — Frontend repointed to Base Sepolia + MetaMask (2026-07-08)
- `src/contracts/deployments/{Registry,Registrar,Resolver}.json`: added `baseSepolia`
  entries (address + deploy block, from `deployments/baseSepolia/`); new
  `ACTIVE_DEPLOYMENT = 'baseSepolia'` constant exported from `src/utils/contracts/common.ts`;
  all ~22 `.columbus.address`/`.block` reads swapped to `[ACTIVE_DEPLOYMENT]` (contracts/common,
  contracts/{registry,token}, logs/{domain,token}, data/domains, components
  {Expiration,Allowance,Register,Resolver}).
- `src/utils/wallet.ts`: `getProvider()` → Base Sepolia `JsonRpcProvider` with
  `{batchMaxCount: 1}` (Phase-1 public-RPC batching gotcha); new `connectMetaMask()`
  (`eth_requestAccounts` + switch/add chain 0x14a34, `BrowserProvider.getSigner()`), mirroring
  `camino-suite/src/hooks/useMetaMask.ts`; `getSigner()` now returns the stored signer (the old
  `wallet.connect(provider)` would throw on a `JsonRpcSigner`). Kept the app's own
  SignTransaction approval modal on top of MetaMask's.
- `src/store/cns.ts`: `wallet` type `ethers.Wallet` → `ethers.JsonRpcSigner` (`.address` reads
  everywhere keep working); `src/pages/wallet/index.tsx` rewritten: private-key TextField →
  "Connect MetaMask" button.
- **Decimals bug fixed (would have zeroed native payment):** balances/prices were integer-
  truncated via `slice(0, -18)` — fine for 100-CAM prices, but 0.0001-ETH prices and sub-ETH
  balances rounded to 0 ("Not enough…", cost 0 → contract revert). Swapped to
  `ethers.formatEther` in `getTokenDetails` (utils/common.ts) + balance reads in
  `Register.tsx`/`Expiration.tsx`. Zero-address token now labeled Ether/ETH (was Camino/CAM).
- Camino-isms stripped: X-/P-Chain resolver record inputs (Resolver.tsx), P/X reads + derived
  bech32 address table (Information.tsx, Selected.tsx — resolver P/X fields left as `''` to
  keep the Domain type), bech32/elliptic pubkey-derivation helpers (utils/common.ts),
  `isValidAddress` P/X branches; "C-Chain Address" label → "Address"; navbar "Columbus" →
  "Base Sepolia"; SignTransaction "CAM" → "ETH"; "Search Your Camino Domain" → "…CNS Domain".
- `npm install --legacy-peer-deps` (same @cypress/react peer conflict as Phase 1).

## New RPC gotcha: eth_getLogs block-range caps (2026-07-08)
- The app builds its domain tree + token list from **event logs since the deployment block**
  (`queryLogs` in `src/utils/logs/common.ts`). `sepolia.base.org` caps `eth_getLogs` at
  **2,000 blocks** ("query exceeds max block range 2000") → login would have broken within
  ~1 hour of deployment (Base Sepolia mines every 2s).
- Fix: `BASE_SEPOLIA.rpcUrl` → **`https://base-sepolia.drpc.org`** (empirically allows
  <10k-block ranges; same default as `camino-messenger-contracts`' hardhat config), and
  `queryLogs` now **pages in 9,000-block chunks** from `fromBlock` to latest, so it survives
  any provider's cap. Chunk count grows ~5/day of chain history — fine for the demo horizon;
  for production use an indexer or a dedicated RPC key (noted in plan doc).

## 1d — Verify (2026-07-08)
- Contracts (script txs on Base Sepolia): `register-demo.ts` registered **transio.cam** for
  1 year paying **0.0001 native ETH** (tx `0xec5bf6df…`), set resolver (`0x527c0f20…`) and
  address record → deployer (`0xfd493717…`). Owner + addr reads confirm.
- Frontend (`npm start`, driven in Chrome): search "transio" → **Domain Taken → Open** →
  info page shows owner `0xa087…A90F1`, expiration 2027-07-08, Address record — all read
  live from Base Sepolia via the chunked log/contract calls; search "voyage2026" →
  available → register gated behind **Connect Wallet**; navbar shows **Base Sepolia**;
  no P/X-chain fields anywhere; no console errors. `tsc --noEmit` clean on `src/`
  (cypress/e2e has pre-existing type drift); `react-scripts build` green.
- **Not yet verified (needs a human): MetaMask popup approval** — connect + a UI-driven
  registration/renewal. The Connect MetaMask button fires `eth_requestAccounts`; the
  extension popup can't be driven by automation. Everything after the signer exists is the
  same code path exercised above.

## Header cleanup + GitHub Pages + repo docs (2026-07-08)
- Operator feedback: drop "Wallet" from the top-left app-switcher and fix the icon.
  Removed the one-item `Select` entirely (`TLNavbar.tsx`): static logo header
  (wordmark at natural aspect — the old `width:35%/height:50%` stretched it ~40%),
  PUBLIC_URL-safe asset path, click → `/cns`. Favicon checked: already the Camino
  pinwheel, not the CRA default.
- **GitHub Pages** (mirrors camino-suite): `homepage` in package.json, router
  `basename: process.env.PUBLIC_URL`, `%PUBLIC_URL%` refs in `public/index.html`,
  `deploy:pages` script (gh-pages pkg + `404.html` = index.html SPA fallback).
  `gh-pages` branch built + pushed. **Gotcha:** with `homepage` set, the CRA dev
  server also serves under `/camino-name-service-frontend/` — the bare `/cns` URL
  renders blank (basename mismatch).
- **Blocked on operator: repo visibility.** Pages on a private repo needs a paid org
  plan (`422 Your current plan does not support GitHub Pages`); flipping
  `camino-name-service-frontend` public requires explicit operator approval (permission
  gate). Once public: enable Pages from `gh-pages` branch → site at
  `https://traveltokenmarketplace.github.io/camino-name-service-frontend/`.
- Both repos got a TTM-oriented `README.md` (what changed vs. c4t, run/deploy
  instructions, deployed addresses) + `CLAUDE.md` (AI orientation with the session's
  gotchas), camino-suite style.

## Deploy target switched: GitHub Pages → Cloudflare Pages (2026-07-08)
- Operator decision: **Cloudflare Pages, Git-connected, no custom domain** — free tier
  deploys from a **private** GitHub repo (sidesteps the GitHub-Pages paywall; repo
  stays private).
- Frontend reverted to **root-path serving**: `homepage` field dropped (dev back at
  `localhost:3000/cns`), `gh-pages` pkg + `deploy:pages` scripts removed, no `404.html`
  (Cloudflare auto-serves `index.html` for SPA routes). Committed `.npmrc`
  (`legacy-peer-deps=true`) so Cloudflare's `npm install`/`npm ci` passes.
  Verified: dev renders at `/cns`, prod build emits root asset paths.
- Stale `gh-pages` branch left on the remote (branch deletion needs operator approval);
  harmless, not the deploy path.
- ~~Operator to do once: dashboard Git-connect~~ — superseded: operator asked for the
  API route. The machine's **wrangler OAuth token** (mikrub@gmail.com, account
  `851423c4…`) already has `pages (write)`, so the deploy went **direct-upload**:
  `wrangler pages project create camino-name-service` (first attempt hit a transient
  CF 500, retry succeeded) + `wrangler pages deploy build`. **Live:
  https://camino-name-service.pages.dev** (repo stays private + unconnected). Verified
  over HTTP: `/`, `/cns`, `/cns/my-domains` all 200 with SPA fallback, JS bundle 200.
  Push-to-deploy does NOT exist — redeploy = `npm run build && npx wrangler pages
  deploy build --project-name camino-name-service --branch main` (in README). Stale
  `gh-pages` branch deleted (operator-approved).
