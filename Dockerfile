# Admin panel: build with bun, serve with nginx (/api proxied to the Go API).
FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# Types and tests run in CI (bun run build / bun run test); the image only needs the bundle.
RUN bunx --bun vite build

FROM nginx:1-alpine

# Pick up fixed Alpine packages the base image has not rebuilt yet (Trivy gate: libxslt CVE-2026-9947 / CVE-2026-87636, fixed in 1.1.43-r4).
RUN apk upgrade --no-cache
ENV API_URL=http://api:8080
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
