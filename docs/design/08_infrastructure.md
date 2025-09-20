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
