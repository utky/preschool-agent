# shared-types パッケージ設計

## 現状の重複分析

### 完全重複している型定義（3ドメイン）

| ドメイン | frontend | backend |
|--------|----------|---------|
| chat | `frontend/src/types/chat.ts` | `backend/src/types/chat.ts` |
| events | `frontend/src/types/events.ts` | `backend/src/types/events.ts` |
| documents | `frontend/src/types/documents.ts` | `backend/src/types/documents.ts` |

これらのファイルは内容が完全に一致しており、一方を変更した場合にもう一方を手動で同期する必要がある。

## 既存の設定

### npm workspaces（ルート `package.json`）

```json
{
  "workspaces": ["frontend", "backend", "gas"]
}
```

### TypeScript Project References（ルート `tsconfig.json`）

```json
{
  "references": [
    { "path": "./frontend" },
    { "path": "./backend" }
  ]
}
```

どちらも `packages/*` の追加のみで対応可能な状態。

## 解決策

### Option A: shared-types パッケージ（推奨）

`packages/shared-types/` として独立したワークスペースパッケージを作成し、型定義を一元管理する。

**メリット:**
- シンプルで理解しやすい
- ビルドツール非依存（型のみの pure TypeScript）
- frontend/backend の両方から `@preschool/shared-types` としてインポート可能

**デメリット:**
- パッケージ追加によるモノレポ複雑度の微増

**ディレクトリ構成:**

```
packages/
└── shared-types/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── chat.ts
        ├── events.ts
        └── documents.ts
```

**package.json:**

```json
{
  "name": "@preschool/shared-types",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit"
  }
}
```

**tsconfig.json:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src"]
}
```

**src/index.ts:**

```typescript
export * from './chat';
export * from './events';
export * from './documents';
```

### Option B: Hono RPC（将来拡張）

Hono の `hc` クライアントを使い、バックエンドの型定義をフロントエンドに自動的に伝播させる手法。

**メリット:**
- API スキーマと型が常に同期
- リクエスト/レスポンス型の自動導出

**デメリット:**
- Hono RPC への移行コストが高い
- 現状のアーキテクチャとの乖離

→ 将来的な改善候補として保留。

## 実装手順

1. `packages/shared-types/` ディレクトリ作成（`package.json`, `tsconfig.json`, `src/`）
2. ルート `package.json` の `workspaces` に `"packages/*"` を追加
3. ルート `tsconfig.json` の `references` に `packages/shared-types` を追加
4. 重複型定義（chat, events, documents）を `packages/shared-types/src/` に移動
5. `frontend/package.json`, `backend/package.json` に依存を追加
6. frontend/backend の import を `@preschool/shared-types` に変更
7. `npm run build` 全ワークスペース通過確認
