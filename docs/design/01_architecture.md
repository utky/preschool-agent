## 1. アーキテクチャ概要

本システムは、Google Cloud上に構築されたサーバーレスアーキテクチャを採用します。Cloud Run上で稼働するNext.jsアプリケーションが、フロントエンドとバックエンドAPIの両方を提供します。認証にはAuth.jsを利用したGoogle認証を採用します。データ処理は、Cloud Schedulerに定期実行されるCloud Functionが担い、Document AIでの解析結果をBigQueryに蓄積します。

### 1.1. コンポーネント構成図

```mermaid
graph TD
    subgraph User
        U[ユーザーのブラウザ]
    end

    subgraph "Google Cloud"
        subgraph "Cloud Run"
            B[Next.jsサーバー: API + フロントエンド配信]
        end
        subgraph "Data Processing"
            C[ポーリング処理 / Cloud Function]
            D[AI解析 / Document AI]
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

    U -- "HTTPSリクエスト" --> B
    B -- "認証" --> Google[Google OAuth]
    B -- "シークレット取得" --> I
    B -- "データ参照・更新" --> E
    H -- "HTTPトリガー" --> C
    C -- "1. ファイル一覧取得" --> G
    C -- "2. 処理済みか確認" --> E
    C -- "3. 未処理ファイルを連携" --> D
    D -- "4. PDF解析" --> F
    C -- "5. 解析結果を構造化" --> F
    C -- "6. 構造化データを保存" --> E
```

### 1.2. 処理フロー
1.  **定期的実行**: Cloud Schedulerが設定されたスケジュールで、ポーリング用のCloud FunctionをHTTPトリガーします。
2.  **新規ファイル検出**: Cloud Functionは、Google Drive APIで指定フォルダ内のファイルリストを取得し、BigQueryの処理済み記録と照合して未処理の新規ファイルを特定します。
3.  **解析依頼**: 特定したPDFをCloud Storageにアップロードし、Document AIのプロセッサを呼び出して非同期解析を依頼します。
4.  **データ格納**: 解析結果のJSONをCloud Storageから取得し、`core`モジュールのマッパーを通じてデータモデルに変換後、BigQueryの各テーブルに格納します。
