## 8. インフラストラクチャ (IaC)

OpenTofuを用いてGoogle Cloudリソースをコードとして管理します。

### 8.1. Terraformの構成

Terraformのコードは、再利用性と保守性を高めるため、一般的なベストプラクティスである `environments` と `modules` を用いたディレクトリ構成を採用します。

- **`environments`**: `production` や `staging` といった環境ごとの構成を定義します。
- **`modules`**: Cloud Run、GCS、BigQueryといった、再利用可能なリソースのまとまりを機能単位で定義します。

### 8.2. 主要なリソース

- **コンピューティング/配信**: Cloud Run, Cloud Functions
- **スケジューリング**: Cloud Scheduler
- **AI / ML**: Document AI
- **ストレージ**: Google Drive, Cloud Storage, BigQuery
- **セキュリティ**: Secret Manager
- **認証**: Google OAuth Client ID

### 8.3. dbt SA 権限設計

Cloud Run Job で dbt を実行するサービスアカウント（`{app_name}-dbt-sa`）に付与する権限は以下の通り。

| 権限 | スコープ | 用途 |
|------|----------|------|
| `roles/bigquery.dataEditor` | プロジェクト | BigQuery テーブルの作成・更新 |
| `roles/bigquery.jobUser` | プロジェクト | BigQuery クエリジョブの実行 |
| `roles/bigquery.connectionUser` | プロジェクト | BigQuery 接続の利用 |
| `roles/bigquery.connectionAdmin` | seeds 接続リソース | `CREATE EXTERNAL TABLE ... WITH CONNECTION`（BigLake）に必要な `bigquery.connections.delegate` 権限 |
| `roles/bigquery.connectionAdmin` | vertex 接続リソース | `CREATE MODEL ... REMOTE WITH CONNECTION`（Vertex AI）に必要な `bigquery.connections.delegate` 権限 |
| `roles/storage.objectAdmin` | API Data バケット | dbt エクスポートの GCS 書き込み |
| `roles/storage.objectViewer` | PDF Uploads バケット | Object Table 経由で `ML.GENERATE_TEXT` が PDF 本体を読む際の `storage.objects.get`（後述） |

#### PDF Uploads バケットの objectViewer が必要な理由

Object Table（`raw_documents`）を `ML.GENERATE_TEXT` に渡すと、接続 SA（`bqcx-...`）の権限だけでなく**クエリ実行者自身**の `storage.objects.get` も検査される。
dbt SA にこの権限がないと各行が `FAILED_PRECONDITION: ... you don't have the 'storage.objects.get' permission` で失敗し、
`ml_generate_text_status = ''` フィルタで黙って除外される（2026-10-16 〜 2026-11-20 の PDF 取り込み停止の原因）。

#### connectionAdmin をリソースレベルで付与する理由

`CREATE EXTERNAL TABLE ... WITH CONNECTION` や `CREATE MODEL ... REMOTE WITH CONNECTION` 実行時、BigQuery はその接続を作成リソースへ「委任（delegate）」する。これには `bigquery.connections.delegate` が必要だが、プロジェクトレベルの `roles/bigquery.connectionUser` には含まれない。

`roles/bigquery.connectionAdmin` を**接続リソースレベル**で付与することで、`bigquery.connections.delegate` を最小権限で付与する。
