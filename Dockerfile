# ---------------------------------------------------------------------------
# Camino Suite (slimmed standalone SPA) — multi-stage image.
#
#   stage 1  build the static webpack bundle
#   stage 2  serve it with nginx (SPA fallback)
# ---------------------------------------------------------------------------

# --- build stage -----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# STRAPI_BASE_URL is inlined into the JS bundle at BUILD time (webpack Dotenv
# `systemvars: true`). It must be reachable from the user's BROWSER, not from
# inside the container — see docker-compose.yml / docs/DEPLOY.md. Falls back to
# the same default the app uses in code.
ARG STRAPI_BASE_URL=http://localhost:1337
ENV STRAPI_BASE_URL=$STRAPI_BASE_URL

# Install deps first for better layer caching. devDependencies are required
# (webpack lives there), so do NOT omit them.
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Build. `build:docker` sets PUBLIC_PATH=/ so assets resolve from the nginx root.
COPY . .
RUN npm run build:docker

# --- serve stage -----------------------------------------------------------
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
