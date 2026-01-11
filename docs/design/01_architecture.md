## 1. アーキテクチャ概要

本システムは、Google Cloud上に構築されたサーバーレスアーキテクチャを採用します。フロントエンドはVite + Reactで構築され、静的ファイルとしてCloud Storage（またはFirebase Hosting）でホスティングされます。バックエンドAPIはHono + Mastraで構築され、Cloud Run上で稼働します。認証はHonoのOAuthプロバイダーを利用したGoogle認証を採用します。データ処理は、Cloud Schedulerに定期実行されるCloud Workflowが担い、Document AIでの解析結果をBigQueryに蓄積します。

### 1.1. コンポーネント構成図

```mermaid
graph TD
    subgraph User
        U[ユーザーのブラウザ]
    end

    subgraph "Google Cloud"
        subgraph "Static Hosting"
            FE[Vite + React / Cloud Storage or Firebase Hosting]
        end
        subgraph "Cloud Run"
            BE[Hono + Mastra: バックエンドAPI]
        end
        subgraph "Data Processing"
            C[dbt処理 / Cloud Run Job]
            D[AI解析 / Document AI]
            W[オーケストレーション / Cloud Workflow]
        end
        subgraph "Data Storage"
            E[構造化データ / BigQuery]
            F[ファイルストレージ / Cloud Storage]
            G[入力元 / Google Drive]
        end
        subgraph "Scheduling"
            H[スケジューラ / Cloud Scheduler]
        end
        subgraph "Security"
            I[Secret Manager]
        end
    end

    U -- "静的ファイル配信" --> FE
    U -- "API HTTPSリクエスト" --> BE
    BE -- "認証" --> Google[Google OAuth]
    BE -- "シークレット取得" --> I
    BE -- "データ参照・更新" --> E
    H -- "HTTPトリガー" --> W
    W -- "1. dbt実行" --> C
    C -- "2. Document AI呼び出し" --> D
    D -- "3. PDF解析" --> F
    C -- "4. 解析結果を構造化" --> F
    C -- "5. 構造化データを保存" --> E
    W -- "6. Google Drive監視" --> G
```

### 1.2. 処理フロー
1.  **定期的実行**: Cloud Schedulerが設定されたスケジュールで、Cloud WorkflowをHTTPトリガーします。
2.  **新規ファイル検出**: Google Apps ScriptがGoogle Drive APIで指定フォルダ内のファイルリストを取得し、新規ファイルをCloud Storageにアップロードします。
3.  **解析・構造化**: Cloud Workflowがdbt（Cloud Run Job）を実行し、BigQuery上でDocument AIを呼び出してPDF解析を行い、結果をテーブルに格納します。
4.  **データ変換**: dbtモデルがテキスト抽出、チャンク化、埋め込み生成、文書種別の構造化を順次実行します。
