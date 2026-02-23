# Claude Code 開発ガイド

## 役割
あなたはGoogle CloudとTypeScriptのスキルを持つプログラマです。
Vite + React + Hono + Mastra構成のフルスタックアプリケーションを開発します。

## プロジェクト構成
- `frontend/`: Vite + React + Tailwind CSS
- `backend/`: Hono + JWT認証
- `gas/`: Google Apps Script (Drive → GCS連携)
- `dbt/`: BigQueryデータパイプライン
- `tf/`: OpenTofu (IaC)

## コーディング規約

### TypeScript
- イミュータブルデータをなるべく使う
- Functional Programmingのスタイルに従う
- インタフェースを先に定義する
- 日本語でコメントを書く
- テスタビリティの高い設計（純粋関数、依存性注入）を心がける

### テスト命名規則
- ファイル: `{対象}.test.ts(x)`
- スイート: `describe('{モジュール名}', ...)`
- ケース: `it('should {期待動作}', ...)`

### dbt モデル命名規則
- `staging/`: `stg_{source}__{entity}.sql`
- `intermediate/`: `int_{entity}__{transformation}.sql`
- `marts/core/`: エンティティ名そのまま（例: `events.sql`, `dim_documents.sql`）
- `exports/`: `exp_api__{entity}.sql`（APIエクスポート用はすべて `exp_api__` プレフィックス）

### コミットメッセージ規約
- `feat(sliceN):` - 新機能（スライス番号を含める）
- `fix:` - バグ修正
- `docs:` - ドキュメントのみの変更
- `refactor:` - リファクタリング
- `chore:` - ビルドプロセスやツールの変更

## 開発ワークフロー

### 全体の流れ
1. **タスクの選択**: `TODO.md` から着手するスライスを決定
2. **フィーチャーブランチ**: `main` から `feat/sliceN_description` ブランチを作成
3. **TDD実装**: 下記TDDワークフローに従う
4. **ビルド確認**: `npm run build` で全ワークスペースをビルド
5. **スライス完了**: 下記スライス完了ワークフローに従う
6. **Pull Request**: `main` に対してPRを作成

### TDDワークフロー

#### 基本原則
1. **テスタビリティ重視**: 純粋関数とインタフェース分離を優先
2. **テストファースト**: 実装前にテストを書く
3. **レビュー必須**: `/test-reviewer` スキルでレビュー
4. **全テスト通過**: テストがパスするまで実装を続ける

#### 手順
1. インタフェース設計（型定義）
2. テスト作成（`*.test.ts`）
3. テストレビュー（`/test-reviewer` で承認まで改善）
4. 実装（テストがグリーンになるまで）

#### Stop Hook
Claude Code応答完了時に自動でテストを実行する。テスト失敗時は修正を強制。
- 設定: `.claude/settings.json`
- スクリプト: `.claude/hooks/run-tests.sh`

### スライス完了ワークフロー

#### 1. TODO.mdの更新
- 完了したタスクにチェックを入れる (`[x]`)
- スライスのステータスを `- DONE` に変更

#### 2. 変更のコミット
スライスごとに意味のある単位でコミットする：

```bash
git add <関連ファイル>
git commit -m "$(cat <<'EOF'
feat(sliceN): スライスの簡潔な説明

- 主要な変更点1
- 主要な変更点2
- 主要な変更点3
EOF
)"
```

## コマンドリファレンス

### テスト
```bash
npm run test                # 全ワークスペース
cd frontend && npm run test # Frontend (Vitest)
cd backend && npm run test  # Backend (Jest)
cd gas && npm run test        # GAS (Jest)

# dbt
cd dbt && dbt parse

# IaC（テスト相当）
tofu -chdir=tf/environments/production/ validate
tofu -chdir=tf/environments/production/ plan
```

### ビルド
```bash
npm run build               # 全ワークスペース
cd frontend && npm run build
cd backend && npm run build

# dbt
cd dbt && dbt compile
```

### 開発サーバー
```bash
cd frontend && npm run dev  # ポート5173
cd backend && npm run dev   # ポート3000
```

### 利用可能ツール
- Git: `git` コマンド
- GitHub: `gh` コマンド
- Google Cloud: `gcloud` コマンド
- Google Cloud Storage: `gsutil` コマンド
- BigQuery: `bq` コマンド
- OpenTofu: `tofu` コマンド
- dbt : `dbt` コマンド

## 重要ファイル
- `TODO.md`: スライス計画とタスク管理
- `docs/design/10_slice_plan.md`: 詳細なスライス計画
- `docs/design/01_architecture.md`: アーキテクチャ設計
- `docs/design/12_unit_test.md`: ユニットテスト設計
