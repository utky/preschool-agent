## 3. プロジェクト構成

**アーキテクチャ**: 本プロジェクトはフロントエンドとバックエンドを分離した構成を採用します。フロントエンドはVite + Reactで構築され、Cloud Storage（公開バケット）で静的ホスティングされます。バックエンドはHono + MastraでAPIサーバーとして構築され、Cloud Run上で稼働します。

### 3.1. フロントエンド (Vite + React)

```
frontend/
├── src/
│   ├── components/       # Reactコンポーネント
│   │   ├── layout/       # レイアウトコンポーネント
│   │   ├── events/       # イベント関連コンポーネント
│   │   │   ├── EventCard.tsx
│   │   │   └── EventTable.tsx
│   │   ├── documents/    # 文書関連コンポーネント
│   │   │   ├── ChunkList.tsx
│   │   │   └── DocumentList.tsx
│   │   ├── chat/         # チャット関連コンポーネント
│   │   └── auth/         # 認証関連コンポーネント
│   ├── pages/            # ページコンポーネント
│   │   ├── Home.tsx          # ホーム
│   │   ├── Login.tsx         # ログイン
│   │   ├── Events.tsx        # 予定一覧
│   │   ├── Documents.tsx     # 文書一覧
│   │   ├── DocumentDetail.tsx # 文書詳細
│   │   └── Chat.tsx          # AIチャット
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
│   │   ├── calendar.ts   # カレンダー/イベントAPI
│   │   ├── chat.ts       # チャットAPI
│   │   ├── documents.ts  # 文書API
│   │   └── health.ts     # ヘルスチェック
│   ├── middleware/       # ミドルウェア
│   │   ├── auth.ts       # 認証ミドルウェア
│   │   └── cors.ts       # CORS設定
│   ├── agents/           # Mastraエージェント
│   │   ├── chat-agent.ts # チャットエージェント
│   │   └── tools/        # エージェントツール
│   │       └── vector-search-tool.ts
│   ├── lib/              # ユーティリティ
│   │   ├── bigquery.ts   # BigQueryクライアント
│   │   ├── calendar.ts   # Googleカレンダー連携
│   │   ├── jwt.ts        # JWT生成・検証
│   │   └── storage.ts    # Cloud Storage連携
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
│   │   ├── _staging.yml
│   │   └── stg_pdf_uploads__extracted_texts.sql  # Document AI テキスト抽出
│   ├── intermediate/     # Layer 2: ビジネスロジック
│   │   ├── int_document_chunks__chunked.sql      # チャンク化
│   │   └── int_document_chunks__embedded.sql     # 埋め込みベクトル生成
│   ├── marts/            # Layer 3: 最終テーブル
│   │   └── core/
│   │       ├── dim_documents.sql                 # 文書メタデータ（incremental）
│   │       ├── fct_document_chunks.sql           # チャンク + 埋め込み
│   │       ├── fct_events.sql                    # 抽出イベント
│   │       ├── fct_events_with_sync.sql          # イベント + 同期状態（exports向け）
│   │       └── fct_calendar_sync_history.sql     # カレンダー登録履歴
│   └── exports/          # Layer 4: API用JSON出力
│       ├── exp_api__documents.sql
│       ├── exp_api__events.sql
│       └── exp_api__chunks/                      # 文書別チャンク
├── macros/               # カスタムマクロ
├── tests/                # データテスト
├── dbt_project.yml       # dbtプロジェクト設定
└── profiles.yml          # BigQuery接続設定
```

### 3.4. インフラストラクチャ (OpenTofu/Terraform)

```
tf/
├── modules/
│   ├── app/              # メインアプリリソース（Cloud Run, GCS, BigQuery）
│   ├── cloud_run_job/    # dbt実行用Cloud Run Job
│   ├── document_ai/      # Document AIプロセッサー
│   └── workflow/         # Cloud Workflow
└── environments/
    └── production/       # 本番環境のみ
```

### 3.5. Google Apps Script (Drive → GCS連携)

```
gas/
├── src/
│   ├── main.ts           # メインエントリーポイント
│   ├── drive.ts          # Google Drive API操作
│   ├── gcs.ts            # GCS転送ロジック
│   └── config.ts         # 設定管理
├── appsscript.json       # GASプロジェクト設定
└── package.json          # 依存関係
```

### 3.6. プロジェクトルート

```
/ (project root)
├── frontend/             # Vite + React アプリケーション
├── backend/              # Hono + Mastra APIサーバー
├── dbt/                  # dbtプロジェクト
├── gas/                  # Google Apps Script
├── tf/                   # OpenTofu (IaC)
├── docs/                 # ドキュメント
│   └── design/           # 設計ドキュメント
├── .github/
│   └── workflows/        # GitHub Actions CI/CD
└── README.md
```
