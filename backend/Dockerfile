FROM node:22-slim AS deps
WORKDIR /app

# ルートのworkspace設定・lockfile + 各workspaceのpackage.jsonをコピー
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
# npm は他workspaceとのバージョン衝突等により backend/node_modules にパッケージを
# ネスト配置することがあるため、存在しない場合でも COPY できるようディレクトリを作成しておく
RUN npm ci -w backend && mkdir -p backend/node_modules

FROM node:22-slim AS builder
WORKDIR /app/backend
COPY --from=deps /app/node_modules ../node_modules
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/ .
RUN npm run build

# ルートと backend の node_modules を開発時と同じ階層で配置し、
# Node.js のモジュール解決（backend/node_modules → ../node_modules）を再現する
FROM node:22-slim AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ../node_modules
COPY --from=deps /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
