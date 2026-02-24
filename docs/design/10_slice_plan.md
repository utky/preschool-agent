# E2E機能段階追加スライス計画（プランC改）

## 概要

現在Next.js 15ベースで実装されているプロジェクトを、設計書準拠のVite + React + Hono + Mastra構成に移行し、E2E構成を維持しながら段階的に機能を追加する。

**アーキテクチャ移行を最初に完了させ、その後Google Drive連携を実装することで、以降のスライスでは完全に自動化されたPDF取り込みフローの上で開発を進められる。**

## 選択した戦略: プランC改（Vite+Hono移行 + Google Drive優先）

### スライス順序
0. アーキテクチャ移行（Next.js → Vite + React + Hono + Mastra）（3-4週間）
7. Google Drive → GCS自動連携（2週間）
1. Document AI + BigQuery基盤（2週間）
2. dbtパイプライン（2週間）
3. キーワード検索チャット（2週間）
4. ベクトル検索 + Mastra統合（3週間）
5. イベント抽出 + カレンダー登録（2週間）
6. 文書種別構造化（2週間）

### この戦略のメリット
- アーキテクチャが設計書に完全準拠
- 早期にGoogle Drive連携を実装することで、以降の開発でサンプルPDFが自動的に取り込まれる
- スライス1以降は自動化されたフローの上で開発可能
- Next.jsの中途半端な状態を残さない
- **低コストインフラ**: Cloud Load Balancer不使用、静的ファイルはCloud Storage (public)で配信
- **APIレスポンス最適化**: dbtがJSONを出力、バックエンドはそれを返すだけ（BigQuery/Cloud SQL不要）

### リスクと対策
- **リスク**: 最初の3-4週間はユーザー価値がない
  - **対策**: スライス0で認証まで完全実装し、動作確認を徹底
- **リスク**: 認証の再実装・テストに時間がかかる
  - **対策**: 既存のNextAuth設定を参考に、Honoの`@hono/oauth-providers`で同等実装

---

## スライス0: アーキテクチャ移行（3-4週間）

### 目標
Next.js 15を廃止し、Vite + React（フロントエンド）+ Hono + Mastra（バックエンド）構成に移行する。認証機能まで含めて完全に動作することを確認。

### 実装内容

#### フロントエンド（Vite + React）
**新規作成するディレクトリ**: `frontend/`

**ファイル構成**:
```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx    # 既存navbar.tsxを移植
│   │   │   └── Layout.tsx
│   │   └── auth/
│   │       ├── LoginButton.tsx
│   │       └── UserProfile.tsx
│   ├── pages/
│   │   ├── Home.tsx           # 既存page.tsxを移植
│   │   └── Login.tsx
│   ├── hooks/
│   │   └── useAuth.ts         # 認証状態管理
│   ├── lib/
│   │   └── api.ts             # APIクライアント（fetch wrapper）
│   ├── App.tsx                # React Router設定
│   └── main.tsx
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

**主要な実装**:
1. **React Router導入**: `/`, `/login`, `/documents`等のルーティング
2. **APIクライアント**: `credentials: 'include'`でCookie送信、認証エラー時のリダイレクト
3. **認証フック**: `useAuth()`でログイン状態を管理
4. **既存コンポーネント移植**: `navbar.tsx`, `user.tsx`, `login.tsx`をReactコンポーネントとして移植
5. **Vite設定**: ビルド時に`base`を環境変数で切り替え
   - 本番: `base: 'https://storage.googleapis.com/school-agent-prod-frontend/'`
   - 開発: `base: '/'`

**依存関係**:
- `vite`
- `react`, `react-dom`
- `react-router-dom`
- `tailwindcss`

#### バックエンド（Hono + Mastra）
**新規作成するディレクトリ**: `backend/`

**ファイル構成**:
```
backend/
├── src/
│   ├── routes/
│   │   ├── auth.ts            # Google OAuth + JWT
│   │   └── health.ts          # /api/health
│   ├── middleware/
│   │   ├── auth.ts            # JWT検証ミドルウェア
│   │   └── cors.ts            # CORS設定
│   ├── lib/
│   │   └── jwt.ts             # JWT生成・検証ユーティリティ
│   ├── types/
│   │   └── auth.ts            # User型等
│   └── index.ts               # Honoアプリエントリーポイント
├── Dockerfile
├── tsconfig.json
└── package.json
```

**主要な実装**:
1. **Google OAuth**: `@hono/oauth-providers`でGoogle認証
   - `/api/auth/signin/google` - OAuth開始
   - `/api/auth/callback/google` - OAuthコールバック、JWT発行
   - `/api/auth/signout` - ログアウト
2. **JWT認証**: `hono/jwt`で署名・検証
   - httpOnlyなCookieとしてJWTを保存（セキュリティ）
   - 有効期限: 90日（既存NextAuth設定と同等）
3. **メールホワイトリスト**: 環境変数`ALLOWED_USER_EMAILS`で制限
4. **認証ミドルウェア**: `/api/*`エンドポイントでJWT検証
5. **Health Check**: `GET /api/health` → `{ status: "ok" }`
6. **フロントエンド配信**: `GET /` → `index.html`を返却
   - `index.html`内のJS/CSSはCloud StorageのURL（例: `https://storage.googleapis.com/school-agent-prod-frontend/assets/index-*.js`）を参照
   - 本番: Cloud Storageから`index.html`をダウンロードして配信
   - 開発: ローカルの`frontend/dist/index.html`を配信

**依存関係**:
- `hono`
- `@hono/oauth-providers`
- `hono/jwt`
- `@google-cloud/storage`（index.html取得用）
- `@mastra/core`（この段階ではセットアップのみ）

#### インフラ（IaC）
**変更するファイル**:
- `tf/modules/app/main.tf` - 既存のCloud Run設定を更新
- `tf/modules/gcs/main.tf` - フロントエンド用のCloud Storageバケットを追加

**主要な変更**:
1. **バックエンド用Cloud Run**: 既存の`school-agent`サービスをHono用に更新
   - ポート: 3000
   - 環境変数: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_USER_EMAILS`, `FRONTEND_BUCKET_NAME`
   - IAM権限: `roles/storage.objectViewer`（フロントエンドバケットから`index.html`を読み取り）
2. **フロントエンド用Cloud Storage**: 静的ファイル配信（公開バケット）
   - バケット名: `school-agent-prod-frontend`
   - 公開アクセス: `allUsers` に `roles/storage.objectViewer` を付与
   - CORS設定: `*` を許可（JS/CSSの読み込み用）
   - **Cloud Load Balancer不使用**（コスト削減）
   - 静的ファイル（JS/CSS/画像等）は`https://storage.googleapis.com/school-agent-prod-frontend/`から直接配信
3. **Secret Manager**: 既存のシークレット流用（変更不要）

**アーキテクチャ図**:
```
ユーザー
  ↓
  ├─ https://cloud-run-url/ → バックエンド（Hono）→ index.html 配信
  └─ https://storage.googleapis.com/school-agent-prod-frontend/assets/*.js → Cloud Storage（公開）
```

**コスト削減のポイント**:
- Cloud Load Balancer不使用（月額$18〜削減）
- Cloud Storageの直接配信（Class A: $0.05/10k requests、Egress: $0.12/GB）
- バックエンドは必要最小限のリクエストのみ処理（`/`とAPI）

#### CI/CD
**変更するファイル**:
- `.github/workflows/cd.yml`

**主要な変更**:
1. **バックエンドビルド**: `backend/Dockerfile`でビルド、Artifact Registryにプッシュ
2. **フロントエンドビルド**: `cd frontend && npm run build`、Cloud Storageにデプロイ
3. **Tofu apply**: 既存の手順を維持

#### 既存コードの扱い
**削除対象**:
- `src/` ディレクトリ全体（Next.jsコード）
- `next.config.ts`
- `package.json`のNext.js依存関係

**保持対象**:
- `docs/`, `tf/`, `.github/` - そのまま維持
- `TODO.md` - このスライス計画で更新

### E2E体験
- ユーザーがフロントエンド（Cloud Storage）にアクセス
- Googleアカウントでログイン（OAuth）
- JWT Cookieが保存される
- `/api/health`を呼び出し、`{ status: "ok" }`が返ることを確認
- ログアウト可能

### 検証方法
1. ローカル開発環境で動作確認
   - `cd backend && npm run dev` - Hono起動（ポート3000）
   - `cd frontend && npm run dev` - Vite起動（ポート5173）
   - ブラウザで`http://localhost:5173`にアクセス
2. OAuth認証フロー確認
   - ログインボタンクリック→Google OAuth画面→コールバック→JWT Cookie設定→ホーム画面
3. Cloud Runデプロイ後の動作確認
   - 本番URLにアクセス、同様の認証フロー確認

### 重要ファイル
- `frontend/src/App.tsx` - ルーティング設定
- `frontend/src/hooks/useAuth.ts` - 認証状態管理
- `backend/src/routes/auth.ts` - OAuth + JWT実装
- `backend/src/middleware/auth.ts` - JWT検証ミドルウェア
- `tf/modules/app/main.tf` - Cloud Run設定
- `.github/workflows/cd.yml` - CI/CD設定

---

## スライス7: Google Drive → GCS自動連携（2週間）

### 目標
Google Driveの指定フォルダを監視し、新規PDFを自動的にGCSにコピーする仕組みを構築。以降のスライスでは自動取り込まれたPDFを使って開発可能にする。

### 実装内容

#### Google Apps Script（GAS）
**新規作成するディレクトリ**: `gas/`

**ファイル構成**:
```
gas/
├── src/
│   ├── main.ts                # メインエントリーポイント
│   ├── drive.ts               # Google Drive API操作
│   ├── gcs.ts                 # GCS転送ロジック
│   └── config.ts              # 設定管理
├── appsscript.json            # GASプロジェクト設定
├── package.json
└── README.md
```

**主要な実装**:
1. **トリガー設定**: 1時間ごとに実行
2. **Google Drive監視**: 指定フォルダ内のPDFファイルを取得
3. **GCS転送**:
   - パス: `gs://school-agent-prod-pdf-uploads/{%Y-%m-%d}/{%H}/{file_id}.pdf`
   - タイムスタンプ: `file.getLastUpdated()`
4. **重複防止**: すでにGCSに存在するファイルはスキップ
5. **エラーハンドリング**:
   - レート制限対応（指数バックオフ）
   - 失敗時のログ記録（Cloud Loggingに送信）

**依存関係**:
- Google Apps Scriptランタイム
- `@google-cloud/storage`（GAS用ライブラリ）

#### インフラ（IaC）
**新規作成するファイル**:
- `tf/modules/gcs/main.tf` - PDF uploads用バケット

**主要な実装**:
1. **GCSバケット**: `school-agent-prod-pdf-uploads`
   - パスフォーマット: `{%Y-%m-%d}/{%H}/*.pdf`（時間別パーティション）
   - ライフサイクル: 90日後にColdlineに移行、365日後に削除
2. **IAMサービスアカウント**: `school-agent-gas-sa`
   - 権限: `roles/storage.objectCreator`（GCSへの書き込み）
   - キー: GASで使用するための認証情報をSecret Managerに保存

#### CI/CD
**新規作成するファイル**:
- `.github/workflows/deploy-gas.yml` - GASデプロイワークフロー

**主要な実装**:
1. **clasp**を使ってGASプロジェクトをデプロイ
2. トリガー: `gas/`ディレクトリの変更をpush時

### E2E体験
- 開発者がGoogle Driveの指定フォルダにサンプルPDFをアップロード
- 1時間以内にGASが自動実行
- GCSバケットに`2026-01-30/15/{file_id}.pdf`形式でファイルがコピーされる
- Cloud Loggingで転送ログを確認

### 検証方法
1. ローカル開発環境でGASをテスト
   - `cd gas && npm run test`
   - モック環境でDrive API呼び出しをテスト
2. GASプロジェクトをデプロイ
   - `clasp push`
   - トリガー設定を手動で確認
3. サンプルPDFをGoogle Driveにアップロード
   - GCSバケットにファイルが転送されることを確認
   - Cloud Loggingでログを確認

### 重要ファイル
- `gas/src/main.ts` - GASメインロジック
- `gas/src/gcs.ts` - GCS転送実装
- `tf/modules/gcs/main.tf` - GCSバケット定義
- `.github/workflows/deploy-gas.yml` - GASデプロイワークフロー

---

## スライス1: Document AI + BigQuery基盤（2週間）

### 目標
GCS内のPDFをDocument AIで解析し、BigQueryに格納する基盤を構築。解析結果を確認できるAPIとUIを実装。

### 実装内容

#### インフラ（IaC）
**新規作成するファイル**:
- `tf/modules/document_ai/main.tf` - Document AIプロセッサー
- `tf/modules/bigquery/main.tf` - BigQueryデータセット

**主要な実装**:
1. **Document AIプロセッサー**: Document OCR
   - プロセッサーID: `projects/{project}/locations/us/processors/{processor-id}`（※ OCR は asia-northeast1 未対応）
2. **BigQueryデータセット**: `school_agent`
   - ロケーション: `asia-northeast1`
3. **Vertex AI接続**: BigQueryからVertex AIを呼び出すための接続
4. **BigQuery Object Table**: `raw_documents`
   ```sql
   CREATE EXTERNAL TABLE raw_documents
   WITH CONNECTION `project.asia-northeast1.vertex_connection`
   OPTIONS (
     object_metadata = 'SIMPLE',
     uris = ['gs://school-agent-prod-pdf-uploads/*/*/*.pdf'],
     max_staleness = 0
   );
   ```

#### バックエンド（Hono）
**新規作成するファイル**:
- `backend/src/routes/documents.ts`
- `backend/src/lib/storage.ts`

**主要な実装**:
1. **GET /api/documents**: ドキュメント一覧を返す
   - この段階ではBigQueryを直接クエリ（後でCloud Storage化）
   - 返却フォーマット: `{ uri, size, updated, content_type }`
2. **POST /api/documents/process**: Document AI解析をトリガー
   - BigQueryで`ML.PROCESS_DOCUMENT`を実行
   - 結果を`documents_text`テーブル（一時）に保存
3. **GET /api/documents/{uri}/text**: 解析済みテキストを取得

**注**: この段階ではまだBigQueryを直接使用。スライス2でCloud Storage経由のAPIレスポンス最適化を実装。

#### フロントエンド（React）
**新規作成するファイル**:
- `frontend/src/pages/Documents.tsx`
- `frontend/src/components/documents/DocumentList.tsx`

**主要な実装**:
1. **ドキュメント一覧ページ**: PDFファイルのリスト表示
   - ファイル名、サイズ、更新日時
   - 「解析」ボタン（`POST /api/documents/process`を呼び出し）
2. **解析結果表示**: テキスト抽出結果をモーダルで表示

### E2E体験
- ユーザーが`/documents`ページにアクセス
- Google Driveから自動取り込まれたPDFのリストが表示される
- 「解析」ボタンをクリック
- Document AIがPDFを解析（数秒）
- 抽出されたテキストが表示される

### 検証方法
1. サンプルPDFがGCSに存在することを確認
2. BigQuery Consoleで`SELECT * FROM raw_documents`を実行
3. フロントエンドで一覧表示されることを確認
4. 「解析」ボタンをクリックし、テキストが抽出されることを確認

### 重要ファイル
- `tf/modules/document_ai/main.tf` - Document AI設定
- `tf/modules/bigquery/main.tf` - BigQuery設定
- `backend/src/routes/documents.ts` - ドキュメントAPI
- `frontend/src/pages/Documents.tsx` - ドキュメント一覧ページ

---

## スライス2: dbtパイプライン（2週間）

### 目標
Document AIで抽出したテキストをチャンク化し、文書メタデータとともにBigQueryテーブルに格納する。

### 実装内容

#### dbt
**新規作成するディレクトリ**: `dbt/`

**ファイル構成**（dbtベストプラクティスに準拠）:
```
dbt/
├── models/
│   ├── staging/
│   │   ├── _sources.yml              # raw_documents定義
│   │   ├── raw_documents.sql         # Object Tableラッパー
│   │   └── documents_text.sql        # ML.PROCESS_DOCUMENT
│   ├── intermediate/
│   │   └── document_chunks.sql       # チャンク化 + UUID生成（中間処理）
│   ├── marts/
│   │   └── core/
│   │       ├── documents.sql         # 文書メタデータ（正規化）
│   │       └── chunks.sql            # チャンク + 冗長メタデータ（最終テーブル）
│   └── exports/
│       └── api_documents.sql         # API用JSON出力（後述）
├── macros/
│   ├── generate_uuid.sql             # UUID v4生成マクロ
│   ├── chunk_text.sql                # チャンク化UDF
│   └── export_to_gcs.sql             # Cloud Storageへのエクスポートマクロ
├── tests/
│   └── assert_no_duplicate_chunk_ids.sql
├── dbt_project.yml
└── profiles.yml
```

**命名規則の変更理由**（dbtベストプラクティス準拠）:
- `stg_`, `int_`などのプレフィックスは**不使用**
- ディレクトリ構造（`staging/`, `intermediate/`, `marts/`）で階層を表現
- モデル名は利害関係者にわかりやすい名前（`documents`, `chunks`）
- 参考: [dbt Style Guide](https://docs.getdbt.com/best-practices/how-we-style/1-how-we-style-our-dbt-models)

**主要なモデル**:
1. **staging/documents_text.sql**:
   - `ML.PROCESS_DOCUMENT`でDocument AIを呼び出し
   - テキスト抽出結果を保存（再実行回避のため）
2. **intermediate/document_chunks.sql**:
   - テキストをチャンク化（2000文字ごと）
   - UUID v4を生成（`chunk_id`）
   - セクション情報を抽出（`section_id`, `section_title`）
3. **marts/core/documents.sql**:
   - 文書単位のメタデータ（`document_id`, `title`, `publish_date`, `document_type`）
   - パーティション: `publish_date`
   - クラスタ: `document_type`
4. **marts/core/chunks.sql**:
   - チャンクテーブル（`chunk_id`, `chunk_text`, `document_id`）
   - RAG検索用の冗長メタデータ（`document_type`, `title`, `publish_date`）
   - パーティション: `publish_date`
   - クラスタ: `document_type`, `document_id`, `chunk_id`
5. **exports/api_documents.sql**:
   - API用のJSON出力（後述の「APIレスポンス最適化」参照）

#### インフラ（IaC）
**新規作成するファイル**:
- `tf/modules/cloud_run_job/main.tf` - dbt実行環境
- `dbt/Dockerfile` - dbt用Dockerイメージ

**主要な実装**:
1. **Cloud Run Job**: `school-agent-dbt`
   - イメージ: Artifact Registryに保存
   - 環境変数: BigQuery接続情報
   - メモリ: 2Gi、CPU: 2
2. **Artifact Registry**: dbt用リポジトリ

#### dbt JSON出力（APIレスポンス最適化）

**目的**: BigQueryへの直接クエリを削減し、低レイテンシ・低コストなAPIを実現する。

**実装方法**:
1. **dbtモデル: exports/api_documents.sql**
   ```sql
   -- API用のドキュメント一覧をJSON形式でCloud Storageに出力
   {{ config(
       materialized='table',
       post_hook=[
           "EXPORT DATA OPTIONS(
               uri='gs://school-agent-prod-api-data/documents.json',
               format='JSON',
               overwrite=true
           ) AS SELECT * FROM {{ this }}"
       ]
   ) }}

   SELECT
       document_id,
       title,
       document_type,
       publish_date,
       total_chunks,
       total_pages
   FROM {{ ref('documents') }}
   ORDER BY publish_date DESC;
   ```

2. **Cloud Storage: API用データバケット**
   - バケット名: `school-agent-prod-api-data`
   - パス: `documents.json`, `chunks/{document_id}.json`, `events.json`
   - IAM: バックエンドのサービスアカウントに`roles/storage.objectViewer`を付与

3. **dbtジョブ完了時の処理**:
   - `dbt run`完了後、自動的にCloud StorageにJSONが出力される
   - バックエンドAPIは常に最新のJSONを返却

#### バックエンド（Hono）
**変更するファイル**:
- `backend/src/routes/documents.ts`
- `backend/src/lib/storage.ts`

**主要な変更**:
1. **POST /api/documents/process**: dbt実行をトリガー
   - Cloud Run Job APIを呼び出し
   - ジョブ実行IDを返却
2. **GET /api/documents**: ドキュメント一覧を取得（最適化）
   - **Cloud Storageから`documents.json`を読み込んで返却**
   - ローカル開発時: `data/documents.json`から読み込み
   ```typescript
   // backend/src/lib/storage.ts
   export async function getApiData(filename: string) {
     if (process.env.NODE_ENV === 'development') {
       return fs.readFileSync(`data/${filename}`, 'utf-8');
     }
     const bucket = storage.bucket('school-agent-prod-api-data');
     const file = bucket.file(filename);
     const [contents] = await file.download();
     return contents.toString();
   }
   ```
3. **GET /api/documents/{id}/chunks**: チャンク一覧を取得（最適化）
   - **Cloud Storageから`chunks/{document_id}.json`を読み込んで返却**

**メリット**:
- BigQueryクエリコスト削減（$5/TB → $0）
- レスポンス時間短縮（~500ms → ~50ms）
- Cloud SQLなどの低レイテンシストレージ不要
- スケーラビリティ向上（Cloud Storageは無制限スケール）

**ローカル開発時の対応**:
- `backend/data/`ディレクトリにサンプルJSONを配置
- 環境変数`NODE_ENV=development`で切り替え

#### フロントエンド（React）
**変更するファイル**:
- `frontend/src/pages/Documents.tsx`
- `frontend/src/components/documents/DocumentDetail.tsx`

**主要な変更**:
1. **ドキュメント詳細ページ**: チャンク一覧を表示
   - チャンクテキスト、セクションタイトル、順序
2. **処理ステータス表示**: dbt実行中はローディング表示

### E2E体験
- ユーザーがドキュメント一覧で「処理」ボタンをクリック
- dbtがCloud Run Jobで実行される（30秒〜数分）
- 処理完了後、ドキュメント詳細ページでチャンク一覧が表示される

### 検証方法
1. BigQuery Consoleで`SELECT * FROM documents`を実行
2. `SELECT * FROM chunks LIMIT 10`でチャンクを確認
3. フロントエンドでドキュメント詳細ページにアクセス
4. チャンクが正しく表示されることを確認

### 重要ファイル
- `dbt/models/staging/documents_text.sql` - Document AI呼び出し
- `dbt/models/intermediate/document_chunks.sql` - チャンク化
- `dbt/models/marts/core/chunks.sql` - 最終テーブル
- `backend/src/routes/documents.ts` - dbtトリガーAPI
- `tf/modules/cloud_run_job/main.tf` - dbt実行環境

---

## スライス3: キーワード検索チャット（2週間）

### 目標
シンプルなチャットUIを実装し、キーワード検索（BigQuery `LIKE`検索）で関連テキストを返す。

### 実装内容

#### バックエンド（Hono）
**新規作成するファイル**:
- `backend/src/routes/chat.ts`

**主要な実装**:
1. **POST /api/chat**: チャットメッセージを受け取り、応答を返す
   - 入力: `{ message: string }`
   - BigQueryで`chunks`を`LIKE`検索
   ```sql
   SELECT chunk_text, title, section_title, document_id
   FROM chunks
   WHERE chunk_text LIKE '%{keyword}%'
     AND publish_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
   ORDER BY publish_date DESC
   LIMIT 10;
   ```
   - 出力: `{ response: string, sources: [...] }`
2. **セッション管理**: インメモリ（この段階では永続化不要）

#### フロントエンド（React）
**新規作成するファイル**:
- `frontend/src/pages/Chat.tsx`
- `frontend/src/components/chat/ChatWindow.tsx`
- `frontend/src/components/chat/MessageBubble.tsx`

**主要な実装**:
1. **チャットUI**:
   - メッセージ入力欄
   - メッセージ履歴表示（ユーザー/AIのバブル）
   - ソース表示（元ドキュメントへのリンク）
2. **ストリーミング対応**: 将来的なLLM統合を見据えて設計

### E2E体験
- ユーザーが`/chat`ページにアクセス
- 「給食」と入力して送信
- 関連するチャンクが検索され、テキストが返される
- ソースとして元ドキュメントへのリンクが表示される

### 検証方法
1. チャットUIでキーワードを入力
2. 検索結果が表示されることを確認
3. ソースリンクをクリックし、ドキュメント詳細ページに遷移

### 重要ファイル
- `backend/src/routes/chat.ts` - チャットAPI
- `frontend/src/pages/Chat.tsx` - チャットページ
- `frontend/src/components/chat/ChatWindow.tsx` - チャットUI

---

## スライス4: ベクトル検索 + Mastra統合（3週間）

**ステータス**: DONE（実装完了）
**コミット**: `9a287b8` feat(slice4): ベクトル検索 + Mastraエージェント統合

> **設計書との差分（実際の実装）:**
> | 設計書の記述 | 実際の実装 |
> |---|---|
> | `intermediate/embeddings.sql` | `intermediate/int_document_chunks__embedded.sql` |
> | `marts/core/chunks.sql` | `fct_document_chunks.sql`（Vector Index は post_hook で実装） |
> | `agents/chat.ts` | `agents/chat-agent.ts` |
> | `agents/tools/vector-search.ts` | `agents/tools/vector-search-tool.ts` |
> | LLM: gpt-4o-mini / gemini-2.0-flash-001 | Vertex AI `gemini-2.5-flash` |

### 目標
自然言語でのセマンティック検索を可能にし、MastraでLLMエージェントを統合する。

### 実装内容

#### dbt
**変更するファイル**:
- `dbt/models/intermediate/embeddings.sql`
- `dbt/models/marts/core/chunks.sql` - 埋め込みカラム追加

**主要な実装**:
1. **埋め込みモデルの定義**:
   ```sql
   CREATE OR REPLACE MODEL text_embedding_005
   REMOTE WITH CONNECTION vertex_connection
   OPTIONS (endpoint = 'text-embedding-005');
   ```
2. **intermediate/embeddings.sql**:
   - `ML.GENERATE_EMBEDDING`でVertex AI Embeddingを生成
   - 768次元のベクトル（`ARRAY<FLOAT64>`）
3. **marts/core/chunks.sql** - 更新:
   - `chunk_embedding`カラムを追加（`embeddings`から取得）
4. **Vector Index**:
   ```sql
   CREATE VECTOR INDEX chunks_embedding_idx
   ON chunks(chunk_embedding)
   OPTIONS(
     distance_type = 'COSINE',
     index_type = 'IVF',
     ivf_options = '{"num_lists": 1000}'
   );
   ```

#### バックエンド（Hono + Mastra）
**新規作成するファイル**:
- `backend/src/agents/chat.ts` - Mastraチャットエージェント
- `backend/src/agents/tools/vector-search.ts` - BigQueryベクトル検索ツール

**主要な実装**:
1. **Mastraエージェント**:
   - LLM: `gpt-4o-mini`（OpenAI）または`gemini-2.0-flash-001`（Vertex AI）
   - ツール: `vectorSearch`
2. **vectorSearchツール**:
   ```typescript
   export const vectorSearch = createTool({
     id: 'vector-search',
     description: 'PDFドキュメントからセマンティック検索',
     execute: async ({ query, topK = 10 }) => {
       // BigQueryでVECTOR_SEARCHを実行
       const results = await bigquery.query(`
         WITH query_embedding AS (
           SELECT embedding
           FROM ML.GENERATE_TEXT_EMBEDDING(
             MODEL text_embedding_005,
             (SELECT '${query}' AS content),
             STRUCT('RETRIEVAL_QUERY' AS task_type)
           )
         )
         SELECT dc.chunk_text, dc.title, dc.section_title, vs.distance
         FROM VECTOR_SEARCH(
           TABLE chunks,
           'chunk_embedding',
           (SELECT embedding FROM query_embedding),
           top_k => ${topK},
           distance_type => 'COSINE'
         ) AS vs
         JOIN chunks AS dc ON vs.chunk_id = dc.chunk_id
         ORDER BY vs.distance ASC;
       `);
       return results;
     }
   });
   ```
3. **POST /api/chat**: Mastraエージェントを呼び出し

#### フロントエンド（React）
**変更するファイル**:
- `frontend/src/pages/Chat.tsx` - UI変更なし（バックエンドの改善のみ）

### E2E体験
- ユーザーが「今週の給食メニューは？」と入力
- Mastraエージェントが`vectorSearch`ツールを使用
- BigQueryがセマンティック検索を実行
- LLMが自然な日本語で応答を生成
- 「今週の給食メニューは以下の通りです：...」と表示

### 検証方法
1. BigQuery Consoleで`VECTOR_SEARCH`をテスト実行
2. チャットUIで「給食の献立」と入力
3. 関連するチャンクが正しく検索されることを確認
4. LLMの応答が自然な日本語であることを確認

### 重要ファイル
- `dbt/models/intermediate/embeddings.sql` - 埋め込み生成
- `backend/src/agents/tools/vector-search.ts` - ベクトル検索ツール
- `backend/src/agents/chat.ts` - Mastraエージェント
- `backend/src/routes/chat.ts` - Mastra統合

---

## スライス5: イベント抽出 + カレンダー登録（2週間）

**ステータス**: DONE（実装完了）
**コミット**: `afb0e3e` feat(slice5): イベント自動抽出 + カレンダー自動登録

> **設計書との差分（実際の実装）:**
> | 設計書の記述 | 実際の実装 |
> |---|---|
> | `exports/api_events.sql` | `exports/exp_api__events.sql` |

### 目標
PDFから予定を抽出し、ワンタップでGoogleカレンダーに登録できる機能を実装。

### 実装内容

#### dbt
**新規作成するファイル**:
- `dbt/models/marts/core/events.sql`
- `dbt/models/marts/core/calendar_sync_history.sql` - カレンダー登録履歴
- `dbt/models/exports/api_events.sql`

**主要な実装**:
1. **events.sql**:
   - LLMで文書種別ごとにイベントを抽出
   - `event_type`, `event_date`, `event_title`, `event_description`
   - パーティション: `event_date`
   - クラスタ: `event_type`, `source_table`
2. **calendar_sync_history.sql**: カレンダー登録履歴
   - `event_hash`で重複防止（家族全体で1回のみ登録可能）
3. **exports/api_events.sql**:
   ```sql
   {{ config(
       materialized='table',
       post_hook=[
           "EXPORT DATA OPTIONS(
               uri='gs://school-agent-prod-api-data/events.json',
               format='JSON',
               overwrite=true
           ) AS SELECT * FROM {{ this }}"
       ]
   ) }}

   SELECT e.*, d.title AS document_title
   FROM {{ ref('events') }} e
   LEFT JOIN {{ ref('documents') }} d ON e.document_id = d.document_id
   WHERE e.event_date >= CURRENT_DATE()
     AND MD5(CONCAT(e.event_type, CAST(e.event_date AS STRING), e.event_title))
         NOT IN (SELECT event_hash FROM {{ ref('calendar_sync_history') }})
   ORDER BY e.event_date ASC;
   ```

#### バックエンド（Hono）
**新規作成するファイル**:
- `backend/src/routes/calendar.ts`
- `backend/src/lib/calendar.ts` - Google Calendar API連携

**主要な実装**:
1. **GET /api/calendar/events**: 未登録イベント一覧を取得（最適化）
   - **Cloud Storageから`events.json`を読み込んで返却**
   - ローカル開発時: `data/events.json`から読み込み
2. **POST /api/calendar/sync**: イベントをGoogleカレンダーに登録
   - Google Calendar APIで`events.insert`
   - BigQueryに`calendar_sync_history`を記録
   - 重複防止（`event_hash`のユニーク制約）
   - **登録後、dbtジョブをトリガーして`events.json`を更新**（オプション）

#### フロントエンド（React）
**新規作成するファイル**:
- `frontend/src/pages/Events.tsx`
- `frontend/src/components/events/EventCard.tsx`

**主要な実装**:
1. **イベント一覧ページ**: カードベースのレイアウト
   - イベント日付、タイトル、詳細
   - 「カレンダーに追加」ボタン
   - 登録済みバッジ（✓）
2. **楽観的UI更新**: ボタンクリック→即座にUIを更新→バックグラウンドで同期

### E2E体験
- ユーザーが`/events`ページにアクセス
- 直近の予定がカードで表示される
- 「カレンダーに追加」ボタンをクリック
- Googleカレンダーにイベントが登録される
- UIが即座に「登録済み」に更新

### 検証方法
1. BigQuery Consoleで`SELECT * FROM events`を実行
2. フロントエンドでイベント一覧が表示されることを確認
3. 「カレンダーに追加」ボタンをクリック
4. Googleカレンダーでイベントが登録されていることを確認
5. 同じイベントを再度登録しようとした場合、「登録済み」と表示されることを確認

### 重要ファイル
- `dbt/models/marts/core/events.sql` - イベント抽出
- `dbt/models/exports/api_events.sql` - API用JSON出力
- `backend/src/routes/calendar.ts` - カレンダーAPI
- `backend/src/lib/storage.ts` - Cloud Storage読み込み
- `frontend/src/pages/Events.tsx` - イベント一覧ページ

---

## スライス6: 文書種別構造化（2週間）

### 目標
各文書種別（journal, photo_album, monthly_lunch_schedule等）に特化したテーブルとビューを実装。

### 実装内容

#### dbt
**新規作成するファイル**:
- `dbt/models/marts/document_types/journal.sql`
- `dbt/models/marts/document_types/photo_album.sql`
- `dbt/models/marts/document_types/monthly_announcement.sql`
- `dbt/models/marts/document_types/monthly_lunch_schedule.sql`
- `dbt/models/marts/document_types/monthly_lunch_info.sql`
- `dbt/models/marts/document_types/uncategorized.sql`

**主要な実装**:
1. **文書種別分類**: LLMでタイトルから種別を判定
2. **journal.sql**:
   - `sections` (ARRAY<STRUCT<...>>)
   - `article_number`, `japanese_era`, `weekday`
3. **photo_album.sql**:
   - `photo_ids` (ARRAY<STRING>)
   - `sections`, `schedule`, `announcements`
4. **monthly_lunch_schedule.sql**:
   - `daily_menus` (ARRAY<STRUCT<...>>)
   - 栄養情報（11項目）
5. その他の文書種別テーブル

#### dbt JSON出力（APIレスポンス最適化）
**新規作成するファイル**:
- `dbt/models/exports/api_journal.sql`
- `dbt/models/exports/api_lunch_schedule.sql`
- その他の文書種別用エクスポートモデル

**主要な実装**:
```sql
-- exports/api_journal.sql
{{ config(
    materialized='table',
    post_hook=[
        "EXPORT DATA OPTIONS(
            uri='gs://school-agent-prod-api-data/journal.json',
            format='JSON',
            overwrite=true
        ) AS SELECT * FROM {{ this }}"
    ]
) }}

SELECT * FROM {{ ref('journal') }}
ORDER BY publish_date DESC;
```

#### バックエンド（Hono）
**新規作成するファイル**:
- `backend/src/routes/document-types.ts`

**主要な実装**（最適化）:
1. **GET /api/documents/{type}**: 文書種別ごとのエンドポイント
   - `/api/documents/journal` - Cloud Storageから`journal.json`を読み込み
   - `/api/documents/photo-album` - Cloud Storageから`photo_album.json`を読み込み
   - `/api/documents/lunch-schedule` - Cloud Storageから`lunch_schedule.json`を読み込み
   - BigQueryクエリ不要（全てCloud Storage経由）

#### フロントエンド（React）
**新規作成するファイル**:
- `frontend/src/pages/Journal.tsx`
- `frontend/src/pages/LunchSchedule.tsx`

**主要な実装**:
1. **文書種別ごとの詳細ページ**: 最適化されたレイアウト
   - journal: セクション別表示
   - lunch_schedule: カレンダー形式の献立表示

### E2E体験
- ユーザーが`/journal`ページにアクセス
- 日誌一覧が表示される
- 日誌詳細でセクション別に内容が表示される

### 検証方法
1. BigQuery Consoleで各文書種別テーブルをクエリ
2. フロントエンドで文書種別ごとのページにアクセス
3. 正しくフォーマットされた内容が表示されることを確認

### 重要ファイル
- `dbt/models/marts/document_types/*.sql` - 文書種別テーブル
- `backend/src/routes/document-types.ts` - 文書種別API
- `frontend/src/pages/Journal.tsx` - 日誌ページ

---

## 全体の検証方法

### エンドツーエンドテスト（各スライス後）

1. **ローカル環境で動作確認**:
   ```bash
   # バックエンド
   cd backend && npm run dev

   # フロントエンド
   cd frontend && npm run dev

   # dbt
   cd dbt && dbt run
   ```

2. **統合テスト**:
   - Google Drive → GCS転送
   - Document AI解析
   - dbtパイプライン実行
   - チャット検索
   - カレンダー登録

3. **本番環境デプロイ後の確認**:
   - Cloud Runサービスが正常に起動
   - フロントエンドが配信される
   - 認証フローが動作
   - APIが応答

### パフォーマンステスト

- BigQueryのスキャン量を確認（パーティション pruningが効いているか）
- Vector Searchの応答時間（< 2秒）
- Cloud Runのコールドスタート時間

### セキュリティチェック

- JWT CookieがhttpOnly、Secure設定
- CORS設定が正しい
- IAM権限が最小権限

---

## リスクと対策

### リスク1: アーキテクチャ移行の遅延
**対策**: スライス0で認証まで完全実装し、以降のスライスの基盤を確実にする

### リスク2: Document AIの精度
**対策**: サンプルPDFで事前検証、必要に応じてプロンプト調整

### リスク3: Vector Searchの応答時間
**対策**: BigQueryのクラスタリング、パーティショニングを最適化

### リスク4: Google Calendar APIのレート制限
**対策**: 指数バックオフ、リトライロジック実装

---

## 主要な設計決定事項

### 1. 低コストインフラ構成
**決定**: Cloud Load Balancerを使用せず、バックエンド（Hono）から`index.html`を配信し、静的ファイル（JS/CSS）はCloud Storage (public)から直接配信する。

**メリット**:
- Cloud Load Balancer月額コスト削減（$18〜）
- シンプルなアーキテクチャ
- Cloud Storageの直接配信は非常に安価（$0.05/10k requests）

**実装**:
- フロントエンドビルド時、Viteの`base`設定でCloud Storage URLを指定
- バックエンドは`GET /`で`index.html`を返却（Cloud Storageから取得）
- `index.html`内のJS/CSSは`https://storage.googleapis.com/school-agent-prod-frontend/assets/*.js`を参照

### 2. APIレスポンス最適化（dbt → Cloud Storage → API）
**決定**: BigQueryへの直接クエリを削減し、dbtジョブ完了時にAPIレスポンス用JSONをCloud Storageに出力する。

**メリット**:
- BigQueryクエリコスト削減（$5/TB → $0）
- レスポンス時間短縮（~500ms → ~50ms）
- Cloud SQLなどの低レイテンシストレージ不要
- スケーラビリティ向上

**実装**:
```
dbt run → BigQueryテーブル生成 → EXPORT DATA → Cloud Storage (JSON)
                                        ↓
                                バックエンドAPIがJSONを読み込んで返却
```

**対象API**:
- `GET /api/documents` → `documents.json`
- `GET /api/documents/{id}/chunks` → `chunks/{document_id}.json`
- `GET /api/calendar/events` → `events.json`
- `GET /api/documents/{type}` → `{type}.json`

**ローカル開発時**:
- `backend/data/`ディレクトリにサンプルJSONを配置
- 環境変数`NODE_ENV=development`で切り替え

### 3. dbt命名規則（ベストプラクティス準拠）
**決定**: `stg_`, `int_`などのプレフィックスを廃止し、ディレクトリ構造で階層を表現する。

**変更前**:
```
models/
  staging/stg_documents_text.sql
  intermediate/int_document_chunks.sql
  marts/core/document_chunks.sql
```

**変更後**:
```
models/
  staging/documents_text.sql
  intermediate/document_chunks.sql (中間処理)
  marts/core/chunks.sql (最終テーブル)
  exports/api_documents.sql (Cloud Storage出力用)
```

**参考**: [dbt Style Guide](https://docs.getdbt.com/best-practices/how-we-style/1-how-we-style-our-dbt-models)

---

## 次のステップ

1. **スライス0の開始**: フロントエンド・バックエンドディレクトリを作成し、認証実装から開始
2. **TODO.md更新**: この計画をTODO.mdに反映
3. **設計書更新**: `docs/design/01_architecture.md`を更新（低コストインフラ、APIレスポンス最適化を反映）
