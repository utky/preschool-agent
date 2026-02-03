# ユニットテスト設計

## 概要

TDD（テスト駆動開発）ワークフローを確立し、Claude Codeのhookとサブエージェントを活用してテスト品質を担保する。

## テストフレームワーク

| コンポーネント | フレームワーク | 理由 |
|--------------|---------------|------|
| Frontend | Vitest + React Testing Library | Viteと同じ設定を共有、ESM対応が優秀 |
| Backend | Jest + ts-jest | 広く使われている、TypeScript対応 |
| GAS | Jest + ts-jest | 既存依存を活用 |
| IaC (tf/) | `tofu validate/plan` | テスト相当として扱う |

---

## Frontend (Vitest + React Testing Library)

### 依存パッケージ

```json
"devDependencies": {
  "vitest": "^4.0.0",
  "@testing-library/react": "^16.0.0",
  "@testing-library/jest-dom": "^6.0.0",
  "jsdom": "^26.0.0"
}
```

### スクリプト

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

### 設定ファイル (`frontend/vitest.config.ts`)

```typescript
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}']
  }
}))
```

---

## Backend (Jest + ts-jest)

### 依存パッケージ

```json
"devDependencies": {
  "jest": "^29.7.0",
  "@types/jest": "^29.5.0",
  "ts-jest": "^29.2.0"
}
```

### スクリプト

```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

### 設定ファイル (`backend/jest.config.js`)

```javascript
/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }]
  },
  extensionsToTreatAsEsm: ['.ts']
}
```

---

## GAS (Jest)

### 依存パッケージ

```json
"devDependencies": {
  "jest": "^29.7.0",
  "@types/jest": "^29.5.0",
  "ts-jest": "^29.2.0"
}
```

### 設定ファイル (`agents/gas/jest.config.js`)

```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts']
}
```

---

## IaC検証

OpenTofu (tf/) の変更時はユニットテストの代わりに以下を実行:

```bash
# 構文検証
tofu -chdir=tf/environments/production/ validate

# プラン確認
tofu -chdir=tf/environments/production/ plan
```

---

## TDD開発ワークフロー

### 基本原則

1. **テスタビリティ重視**: 純粋関数とインタフェース分離を優先
2. **テストファースト**: 実装前にテストを書く
3. **レビュー必須**: test-reviewerサブエージェントでレビュー
4. **全テスト通過**: テストがパスするまで実装を続ける

### TDD手順

1. インタフェース設計（型定義）
2. テスト作成（`*.test.ts`）
3. テストレビュー（test-reviewer承認まで改善）
4. 実装（テストがグリーンになるまで）

### テストコマンド

```bash
# Frontend
cd frontend && npm run test

# Backend
cd backend && npm run test

# GAS
cd agents/gas && npm run test

# IaC（テスト相当）
tofu -chdir=tf/environments/production/ validate
tofu -chdir=tf/environments/production/ plan
```

---

## テスト命名規則

- ファイル: `{対象}.test.ts(x)`
- スイート: `describe('{モジュール名}', ...)`
- ケース: `it('should {期待動作}', ...)`

---

## test-reviewer サブエージェント

`.claude/agents/test-reviewer.md` に定義されたテストレビュー専門エージェント。

### レビュー基準

1. **カバレッジ**: 正常系・異常系・境界値がカバーされているか
2. **品質**: AAAパターン、テストの独立性、適切なモック使用
3. **可読性**: テスト名が明確か、テストデータが分かりやすいか
4. **保守性**: 実装詳細に依存しすぎていないか

### 承認基準

- 主要な正常系がテスト済み
- 代表的な異常系がテスト済み
- テスト名が明確
- 重大な設計上の問題がない

---

## Stop Hook

Claude Code応答完了時に自動でテストを実行するhook。

### 設定ファイル

- `.claude/settings.json`: hook設定
- `.claude/hooks/run-tests.sh`: テスト実行スクリプト

### 動作

1. 変更されたファイルを検出（git diff）
2. frontend/backend/tf の変更に応じてテストを実行
3. テスト失敗時は `decision: block` を返し、修正を強制
