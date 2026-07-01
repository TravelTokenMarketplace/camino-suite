# Deploying the TTM Partner Showroom

The demo is two pieces plus a public RPC — no databases, no blockchain node to run:

| Piece | What it is | How it's served |
| --- | --- | --- |
| **Camino Suite** | a static React SPA (this repo) built by webpack | any static host |
| **partner-showroom-api** | a tiny Express "dummy Strapi" (`../partner-showroom-api`) that bundles the 244-partner snapshot + mirrored logos | one small container / droplet |
| **Base Sepolia** | the chain the dApp talks to | MetaMask hits the public RPC `https://sepolia.base.org` directly |

Because the SPA runs entirely in the visitor's browser, the only backend that has
to be reachable is the dummy API (for partner data + logos) — and MetaMask reaches
Base Sepolia on its own. There is no server-side rendering and no wallet/RPC infra
to host.

---

## The one gotcha: `STRAPI_BASE_URL` is a BUILD-time value

The SPA reads the API base from `process.env.STRAPI_BASE_URL` (default
`http://localhost:1337`). webpack **inlines** this into the JS bundle at build time
(`dotenv-webpack` with `systemvars: true`). It is **not** read at runtime — you
cannot change it by setting an env var on the running container/host.

Consequences:

- It must be set **before/at build** (shell env, `docker build --build-arg`, or the
  static host's build-environment settings).
- It must be reachable **from the visitor's browser**, not from inside your network.
  For local compose that's the host-published port `http://localhost:1337` (see the
  comment in `docker-compose.yml`) — **not** the compose service name `http://api:1337`.
- To point at a different API, **rebuild** with the new value.

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

## Cheapest cloud architecture (~a few $/month)

Split it the same way it runs locally — a free/near-free static site plus one tiny
always-on box for the API.

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
