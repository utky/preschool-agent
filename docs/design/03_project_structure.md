## 3. プロジェクト構成

**アーキテクチャ**: 本プロジェクトはフロントエンドとバックエンドを分離した構成を採用します。フロントエンドはVite + Reactで構築され、Cloud Storage（またはFirebase Hosting）で静的ホスティングされます。バックエンドはHono + MastraでAPIサーバーとして構築され、Cloud Run上で稼働します。

### 3.1. フロントエンド (Vite + React)

```
frontend/
├── src/
│   ├── components/       # Reactコンポーネント
│   │   ├── layout/       # レイアウトコンポーネント
│   │   ├── events/       # イベント関連コンポーネント
│   │   ├── documents/    # 文書関連コンポーネント
│   │   └── chat/         # チャット関連コンポーネント
│   ├── pages/            # ページコンポーネント
│   │   ├── index.tsx     # ホーム
│   │   ├── events.tsx    # 予定一覧
│   │   ├── documents.tsx # 文書一覧
│   │   └── chat.tsx      # AIチャット
│   ├── hooks/            # カスタムReact Hooks
│   ├── lib/              # ユーティリティ関数
│   ├── types/            # TypeScript型定義
│   ├── App.tsx           # ルートコンポーネント
│   └── main.tsx          # エントリーポイント
├── public/               # 静的ファイル
├── index.html            # HTMLテンプレート
├── vite.config.ts        # Vite設定
├── tsconfig.json         # TypeScript設定
└── package.json          # 依存関係
```

### 3.2. バックエンド (Hono + Mastra)

```
backend/
├── src/
│   ├── routes/           # APIルート
│   │   ├── auth.ts       # 認証エンドポイント
│   │   ├── events.ts     # イベントAPI
│   │   ├── documents.ts  # 文書API
│   │   └── chat.ts       # チャットAPI
│   ├── middleware/       # ミドルウェア
│   │   ├── auth.ts       # 認証ミドルウェア
│   │   └── cors.ts       # CORS設定
│   ├── agents/           # Mastraエージェント
│   │   ├── chat.ts       # チャットエージェント
│   │   └── tools/        # エージェントツール
│   ├── lib/              # ユーティリティ
│   │   ├── bigquery.ts   # BigQueryクライアント
│   │   └── calendar.ts   # Googleカレンダー連携
│   ├── types/            # TypeScript型定義
│   └── index.ts          # エントリーポイント
├── Dockerfile            # Cloud Run用
├── tsconfig.json         # TypeScript設定
└── package.json          # 依存関係
```

### 3.3. データ処理 (dbt + BigQuery)

```
dbt/
├── models/
│   ├── staging/          # Layer 1: Raw → Staging
│   │   ├── _sources.yml
│   │   ├── stg_raw_documents.sql
│   │   └── stg_documents_text.sql
│   ├── intermediate/     # Layer 2: ビジネスロジック
│   │   ├── int_document_chunks.sql
│   │   ├── int_document_embeddings.sql
│   │   └── int_extracted_photos.sql
│   ├── marts/            # Layer 3: 最終テーブル
│   │   ├── core/
│   │   │   ├── document_chunks.sql
│   │   │   ├── documents.sql
│   │   │   └── extracted_events.sql
│   │   └── document_types/
│   │       ├── journal.sql
│   │       ├── photo_album.sql
│   │       └── monthly_*.sql
│   └── analytics/        # Layer 4: AI/分析用ビュー
│       └── upcoming_events.sql
├── macros/               # カスタムマクロ
├── tests/                # データテスト
├── dbt_project.yml       # dbtプロジェクト設定
└── profiles.yml          # BigQuery接続設定
```

### 3.4. インフラストラクチャ (OpenTofu/Terraform)

```
tf/
├── modules/
│   ├── bigquery/         # BigQueryデータセット・テーブル
│   ├── cloud-run/        # Cloud Runサービス
│   ├── storage/          # Cloud Storageバケット
│   ├── iam/              # IAMサービスアカウント
│   └── workflow/         # Cloud Workflow
├── environments/
│   ├── dev/              # 開発環境
│   ├── staging/          # ステージング環境
│   └── prod/             # 本番環境
└── main.tf               # メイン設定
```

### 3.5. プロジェクトルート

```
/ (project root)
├── frontend/             # Vite + React アプリケーション
├── backend/              # Hono + Mastra APIサーバー
├── dbt/                  # dbtプロジェクト
├── tf/                   # OpenTofu (IaC)
├── agents/               # Google Apps Script (PDF転送)
├── docs/                 # ドキュメント
│   ├── design/           # 設計ドキュメント
│   └── api/              # API仕様
├── .github/
│   └── workflows/        # GitHub Actions CI/CD
└── README.md
```

**注**: 現在の実装はNext.jsベースですが、上記の構成への移行を計画しています。移行完了までは、`src/app/`ディレクトリ内にNext.js App Routerベースのコードが存在します。
