# Claude Code 開発ガイド

## 役割
あなたはGoogle CloudとTypeScriptのスキルを持つプログラマです。
Vite + React + Hono + Mastra構成のフルスタックアプリケーションを開発します。

## プロジェクト構成
- `frontend/`: Vite + React + Tailwind CSS
- `backend/`: Hono + JWT認証
- `agents/gas/`: Google Apps Script (Drive → GCS連携)
- `dbt/`: BigQueryデータパイプライン
- `tf/`: OpenTofu (IaC)

## TypeScript Coding Style
- イミュータブルデータをなるべく使う
- Functional Programmingのスタイルに従う
- インタフェースを先に定義する
- 日本語でコメントを書く

## スライス完了時のワークフロー

各スライスが完了したら、以下の手順を実行してください：

### 1. TODO.mdの更新
- 完了したタスクにチェックを入れる (`[x]`)
- スライスのステータスを `- DONE` に変更

### 2. 変更のコミット
スライスごとに意味のある単位でコミットします：

```bash
# ステージング
git add <関連ファイル>

# コミット（HEREDOCを使用）
git commit -m "$(cat <<'EOF'
feat(sliceN): スライスの簡潔な説明

- 主要な変更点1
- 主要な変更点2
- 主要な変更点3

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### コミットメッセージの規約
- `feat(sliceN):` - 新機能（スライス番号を含める）
- `fix:` - バグ修正
- `docs:` - ドキュメントのみの変更
- `refactor:` - リファクタリング
- `chore:` - ビルドプロセスやツールの変更

## 開発ワークフロー

1. **タスクの選択**: `TODO.md` から着手するスライスを決定
2. **フィーチャーブランチ**: `main` から `feat/sliceN_description` ブランチを作成
3. **実装**: フロントエンド、バックエンド、インフラを実装
4. **ビルド確認**: `npm run build` で全ワークスペースをビルド
5. **TODO更新 & コミット**: 上記ワークフローに従う
6. **Pull Request**: `main` に対してPRを作成

## 利用可能ツール
- Git: `git` コマンド
- GitHub: `gh` コマンド
- Google Cloud: `gcloud` コマンド
- Google Cloud Storage: `gsutil` コマンド
- BigQuery: `bq` コマンド
- OpenTofu: `tofu` コマンド
  - plan: `tofu -chdir=tf/environments/production/ plan`

## ビルドコマンド
```bash
# 全ワークスペースをビルド
npm run build

# 個別ビルド
cd frontend && npm run build
cd backend && npm run build

# 開発サーバー起動
cd frontend && npm run dev  # ポート5173
cd backend && npm run dev   # ポート3000
```

## 重要ファイル
- `TODO.md`: スライス計画とタスク管理
- `docs/design/10_slice_plan.md`: 詳細なスライス計画
- `docs/design/01_architecture.md`: アーキテクチャ設計
