# Deploying the TTM Partner Showroom

The demo is two pieces plus a public RPC — no databases, no blockchain node to run:

| Piece | What it is | How it's served |
| --- | --- | --- |
| **Camino Suite** | a static React SPA (this repo) built by webpack | any static host |
| **partner-showroom-api** | a tiny Express "dummy Strapi" (`../partner-showroom-api`) that bundles the 244-partner snapshot + mirrored logos | **pre-rendered to static files** (recommended, $0) **or** one small always-on container / droplet |
| **Base Sepolia** | the chain the dApp talks to | MetaMask hits the public RPC `https://sepolia.base.org` directly |

Because the SPA runs entirely in the visitor's browser, the only backend surface that
has to be reachable is the dummy API's two GET-all endpoints (partner data + business
fields) plus the `/uploads` logos — and MetaMask reaches Base Sepolia on its own. There
is no server-side rendering and no wallet/RPC infra to host.

The API's read surface is now **static-renderable**: the suite fetches both lists whole
once and does all sorting/filtering/lookup client-side, so those endpoints can be baked
into plain files ahead of time. That makes the **recommended** deployment free GitHub
Pages with no backend at all (below); the always-on container is kept as an alternative.

---

## `STRAPI_BASE_URL` is a BUILD-time value

The SPA reads the API base from `process.env.STRAPI_BASE_URL` (default
`http://localhost:1337`). webpack **inlines** this into the JS bundle at build time
(`dotenv-webpack` with `systemvars: true`). It is **not** read at runtime — you
cannot change it by setting an env var on the running container/host, so it must be
set **before/at build** (shell env, `docker build --build-arg`, or the static host's
build-environment settings), and you **rebuild** to point at a different API.

> **The recommended GitHub Pages path makes this mild.** It builds with
> `STRAPI_BASE_URL=/camino-suite` — a **relative, same-origin path**, not an absolute
> URL. Because the SPA, its data, and its logos are all served from the one Pages
> origin, there is nothing to make "reachable" and no protocol to match, which
> eliminates the mixed-content / CORS / build-time-URL gotchas below. Those only apply
> when you point the SPA at a **separate** always-on API host.

When `STRAPI_BASE_URL` **is** an absolute URL to a separate API host:

- It must be reachable **from the visitor's browser**, not from inside your network.
  For local compose that's the host-published port `http://localhost:1337` (see the
  comment in `docker-compose.yml`) — **not** the compose service name `http://api:1337`.
- It must match the SPA's scheme: browsers block mixed content, so an HTTPS SPA needs
  an HTTPS API.

---

## Local — one command

From this directory:

```bash
docker compose up --build
```

Then open:

- **Suite (SPA):** http://localhost:8080
- **Dummy Strapi admin:** http://localhost:1337/admin
- API root / health: http://localhost:1337

`docker compose` builds two images: `web` (this repo → webpack → nginx on `:8080`)
and `api` (`../partner-showroom-api` → Express on `:1337`, with the partner snapshot
and ~9 MB of mirrored logos baked in). `web` is built with
`STRAPI_BASE_URL=http://localhost:1337`, so the browser fetches partners and logos
from the published api port.

Tear down with `docker compose down`.

> Building just the SPA locally without Docker: `npm ci --legacy-peer-deps &&
> STRAPI_BASE_URL=http://localhost:1337 npm run build:docker` → static output in `dist/`.

---

## Recommended — Free: GitHub Pages ($0, no backend)

One origin, no server. The SPA, the partner data, and the logos are all served as
static files from a single GitHub Pages **project** site. Two npm scripts do it:

```bash
npm run build:pages    # build SPA + pre-render the static API into dist/
npm run deploy:pages   # push dist/ to the gh-pages branch
```

What each step does:

- **`build:pages`** builds the SPA for the `/camino-suite/` subpath, runs the static API
  generator into the same `dist/`, then wires up the SPA deep-link fallback:

  ```
  PUBLIC_PATH=/camino-suite/ STRAPI_BASE_URL=/camino-suite ROUTER_BASENAME=/camino-suite \
    webpack --config webpack.prod.js \
    && node ../partner-showroom-api/scripts/build-static.js --out dist \
    && cp dist/index.html dist/404.html \
    && touch dist/.nojekyll
  ```

- **`deploy:pages`** publishes `dist/` to the `gh-pages` branch with the `gh-pages`
  package (added as a devDependency): `gh-pages -d dist -b gh-pages --dotfiles …`.

**One-time setup:** in the repo, **Settings → Pages → serve from the `gh-pages` branch**.

**Result — one origin:** `https://traveltokenmarketplace.github.io/camino-suite/`

| What | Where |
| --- | --- |
| SPA | `/camino-suite/` (site root) |
| Partner + business-field data | `/camino-suite/api/{partners,business-fields}` |
| Logos / media | `/camino-suite/uploads/*` |

Because `STRAPI_BASE_URL=/camino-suite` is a **relative, same-origin path**, the browser
loads data and logos from the same host as the SPA — no CORS, no mixed content, and no
absolute API URL baked into the bundle.

**Subpath handling** (a GitHub project page lives under `/<repo>/`, not the domain root):

- `PUBLIC_PATH=/camino-suite/` — webpack emits asset URLs under the subpath.
- `ROUTER_BASENAME=/camino-suite` — sets the React Router `basename` (wired in
  `src/layout/index.tsx`) so client routes resolve under the subpath.
- `cp index.html → 404.html` — GitHub Pages serves `404.html` for unknown paths, so this
  is the SPA deep-link fallback (equivalent to the `try_files … /index.html` nginx rule).
- `.nojekyll` — disables Jekyll so the extension-less `api/*` files and `_`-prefixed
  assets are served verbatim.

**Editing content:** change the seed, then re-run `build:pages` + `deploy:pages`. The
ergonomic path is the `partner-cms` Claude skill (edit
`../partner-showroom-api/seed/partners.json` → regenerate → redeploy). By default the
static API is built from `seed/`; pass `--from-store` to `build-static.js` to publish
live `/admin` edits instead.

### Cost

| Item | Cost |
| --- | --- |
| Static SPA + data + media (GitHub Pages) | **$0** |
| Base Sepolia RPC (public `https://sepolia.base.org`) | **$0** |
| **Total** | **$0 / month** |

MetaMask reaches Base Sepolia directly — no node or RPC key to host.

---

## Alternative: always-on API (~$4–6/month)

If you'd rather run the live Express API (e.g. to edit content through `/admin` on a
hosted box instead of pre-rendering), split it the same way it runs locally — a
free/near-free static site plus one tiny always-on box for the API.

### 1. Suite → a static site (free–cheap)

The build output is just static files, so host it on any static platform:

- **DigitalOcean App Platform — Static Site** (free tier), or
- **Cloudflare Pages** / **GitHub Pages** / **Netlify** (all have free tiers).

Build settings:

- Build command: `npm ci --legacy-peer-deps && npm run build:docker`
- Output directory: `dist`
- Environment variable (**build-time**): `STRAPI_BASE_URL=https://<your-api-host>`
  — the public URL of the API you deploy in step 2.

Add an SPA rewrite so deep links work (App Platform: "Catchall document" =
`index.html`; Cloudflare Pages/Netlify: a `/* -> /index.html 200` rewrite). This
mirrors the `try_files … /index.html` rule in `nginx.conf`.

### 2. Dummy API → one small container or droplet ($4–6/mo)

The API image is self-contained (seed snapshot + mirrored `static/uploads/` media),
so it needs no volume or database:

- **DigitalOcean App Platform — Service** (smallest instance, ~$5/mo), building
  `../partner-showroom-api/Dockerfile`, HTTP port `1337`; **or**
- a **$4–6/mo droplet** (or any small VPS) running the image:

  ```bash
  docker build -t partner-showroom-api ../partner-showroom-api
  docker run -d --restart unless-stopped -p 80:1337 partner-showroom-api
  ```

Put it behind HTTPS (App Platform gives you TLS automatically; on a droplet use
Caddy/nginx or a Cloudflare proxy) and use that HTTPS URL as `STRAPI_BASE_URL` in
step 1 — browsers block mixed content, so an HTTPS SPA needs an HTTPS API.

CORS is already fully permissive (`*`) on the API, so cross-origin from the static
site just works.

### 3. Base Sepolia → nothing to host

MetaMask talks to the public Base Sepolia RPC `https://sepolia.base.org` directly
from the browser. No archive node, no Infura/Alchemy key required for the demo.

### Rough monthly cost

| Item | Cost |
| --- | --- |
| Static SPA (App Platform static / Cloudflare Pages / GH Pages) | **$0** |
| Dummy API (smallest App Platform service **or** $4–6 droplet) | **~$4–6** |
| Base Sepolia RPC (public) | **$0** |
| **Total** | **~$4–6 / month** |

The only thing to remember when wiring it up: `STRAPI_BASE_URL` is baked in **at
build time**, so set it before you build the static site and rebuild if the API URL
changes.
