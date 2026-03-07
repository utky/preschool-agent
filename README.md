# Preschool Agent

保育園向けの情報管理・AIチャットシステムです。Google Cloud 上に構築されたサーバーレスアーキテクチャで、PDF文書の解析・検索・AIチャット機能を提供します。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Vite + React + Tailwind CSS |
| バックエンド | Hono (Cloud Run) + Mastra (AI エージェント) |
| データパイプライン | dbt + BigQuery + Document AI |
| インフラ | OpenTofu (IaC) + Google Cloud |
| Drive 連携 | Google Apps Script |

## プロジェクト構成

```
.
├── frontend/       # Vite + React フロントエンド
├── backend/        # Hono API サーバー + Mastra エージェント
├── dbt/            # BigQuery データパイプライン
├── gas/            # Google Apps Script (Drive → GCS 連携)
└── tf/             # OpenTofu インフラ定義
```

## 開発環境のセットアップ

```bash
# 依存関係インストール
npm install

# 開発サーバー起動
cd frontend && npm run dev  # http://localhost:5173
cd backend && npm run dev   # http://localhost:3000
```

## テスト

```bash
npm run test                # 全ワークスペース
cd frontend && npm run test # Frontend (Vitest)
cd backend && npm run test  # Backend (Jest)
```

## ビルド

```bash
npm run build               # 全ワークスペース
```

## ドキュメント

- [アーキテクチャ設計](docs/design/01_architecture.md)
- [スライス計画](docs/design/10_slice_plan.md)
- [API設計](docs/design/06_api_design.md)
- [フロントエンド設計](docs/design/07_frontend_design.md)
