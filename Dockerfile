# Builds and serves torre-mvp. The app targets Cloudflare Workers, so the
# production build runs inside workerd via `vite preview` (Miniflare).
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY torre-mvp/package.json torre-mvp/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY torre-mvp/ ./
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npx vite preview --host 0.0.0.0 --port ${PORT} --strictPort"]
