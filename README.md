# Camino Partners — TTM dApp (Base Sepolia)

A slimmed fork of the **Camino Suite** that keeps only the **Partners** experience —
the public **Partner Showroom** and the on-chain **Partner / Messenger Configuration** —
repointed from the Camino L1 to **Camino Messenger contracts on Base** (Base Sepolia
today, chain `84532`).

> **Phase 1 goal:** show the Suite's Partners section working on Base as quickly as
> possible by reusing the existing codebase (least new code). Code quality is not the
> aim; a proper product-design phase and rewrite will follow.

## What changed vs. the original Camino Suite
- **Partners only.** The Wallet, Explorer and Governance (DAC) micro-frontends and all
  three Module-Federation remotes were removed. `/` redirects to `/partners`.
- **Connect-wallet login.** The old mnemonic/keystore login (a Vue wallet remote) is
  replaced by a MetaMask connect. The former `wallet/*` and `Explorer/*` remotes are
  satisfied by local shims (`src/remote-shims/`) via webpack `resolve.alias`.
- **Base Sepolia.** On-chain reads/writes use the TTM CMAccount ABIs and the
  `CMAccountManager` at `0xEcf9b5ca23257969B4F9bb3Efca2d5bb850FAcE9`, signed by MetaMask.
  P/X-chain concepts are gone.
- **Dummy Strapi.** The Partner Showroom's CMS data comes from a small local API
  (`../partner-showroom-api`) that reproduces the Strapi v4 envelope, instead of the
  (dying) Camino Strapi.
- **Self-service.** No Foundation "claim" gate — any connected wallet manages/creates
  its own Messenger Account.

## Run it locally

Two processes. First the dummy Strapi API (see `../partner-showroom-api`):

```bash
cd ../partner-showroom-api && npm install && npm start   # http://localhost:1337
```

Then the suite:

```bash
npm install --legacy-peer-deps
npm start                # webpack-dev-server → http://localhost:5001
```

Open **http://localhost:5001**. It uses `STRAPI_BASE_URL` (default `http://localhost:1337`)
for both the Showroom data and partner logo media.

### One-command Docker
```bash
docker compose up --build   # web → :8080, api → :1337 (admin at /admin)
```
See **`docs/DEPLOY.md`** for the local stack and the cheapest cloud architecture
(static SPA + one small API container; MetaMask talks to public Base Sepolia RPC).

## Using it
- **Partner Showroom** — public, ~244 partners from the dummy API; search + business-field
  filter + pagination.
- **Connect Wallet** — MetaMask; auto-switches/adds Base Sepolia; navbar shows address + ETH.
- **My Partner Profile → My Messenger Account** — create a CMAccount (payable, native ETH
  prefund is *optional*), then configure Offered/Wanted services, Manage Bots, currencies.
  Needs a little Base Sepolia ETH for gas (faucets: Coinbase CDP, QuickNode, Superchain).

## Stack
React 18 · TypeScript · Redux Toolkit · MUI v5 · React Router v6 · Webpack 5 · **ethers v6**.

## Docs
- `docs/PHASE1-PLAN.md` — the implementation plan.
- `docs/WORKLOG.md` — chronological log of the port (for undo/redo).
- `docs/DEPLOY.md` — deployment.
- `CLAUDE.md` — orientation for AI agents working on this code.

## Known caveats (Phase 1)
- The public `sepolia.base.org` RPC is rate-limited/batch-averse; providers use
  `batchMaxCount: 1`. For heavy use, point `rpcUrl` at a dedicated key (Alchemy/QuickNode).
- Snapshot partners carry legacy Camino addresses, so "On Messenger" won't auto-light for
  them — set a partner's C-Chain address to a Base CMAccount creator (via the API `/admin`)
  to demo the link.
