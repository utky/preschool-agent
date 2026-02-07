FROM node:22-slim AS deps
WORKDIR /app

# ルートのworkspace設定・lockfile + 各workspaceのpackage.jsonをコピー
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci -w backend

FROM node:22-slim AS builder
WORKDIR /app/backend
COPY --from=deps /app/node_modules ../node_modules
COPY backend/ .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
