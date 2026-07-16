# Phase 2 (CNS + KYC/KYB) — fanned out to the repos where the work lives

> **This plan has moved.** Phase 2 built two features that live in **other repos**, so the
> canonical, self-contained roadmap/architecture/status for each now lives **in that repo's
> `docs/ROADMAP.md`** — a developer who clones just that repo has everything they need.
> This file is a thin index. (The full original plan, with the detailed `1a–1d` / `2a–2e`
> implementation steps, is in this file's **git history**; what was actually built is in the
> running log **`PHASE2-WORKLOG.md`**, kept here as the cross-repo history.)

## Where it went

| Feature | Repo | Canonical doc |
|---|---|---|
| **KYC/KYB** — Sumsub verification, `KYCRegistry`, gateway, dApp | `camino-kyc` | [`docs/ROADMAP.md`](../../camino-kyc/docs/ROADMAP.md) |
| **CNS** — ENS-style name service, contracts | `camino-name-service` | [`docs/ROADMAP.md`](../../camino-name-service/docs/ROADMAP.md) |
| **CNS** — the dApp frontend | `camino-name-service-frontend` | [`docs/ROADMAP.md`](../../camino-name-service-frontend/docs/ROADMAP.md) |

## What stays here

- **`PHASE2-WORKLOG.md`** — the running, chronological Phase-2 history across both features
  (kept here rather than split by repo, since a timeline reads better whole).
- **Phase 1** (Partner Showroom + CMAccount manager on Base — *this* repo, plus
  `partner-showroom-api`): `PHASE1-PLAN.md` + `WORKLOG.md` — those genuinely belong to
  camino-suite and are unchanged.

## One-line context

Phase 2 brought two more Camino features to **Base Sepolia** (same spirit as Phase 1: "works
in the browser, looks like the original, least new code"). Both are **live**; KYC/KYB is
verified end-to-end against real Sumsub (sandbox). Cross-cutting decisions (convergence,
upgradeability, gas sponsoring) are recorded in the per-repo ROADMAPs.
