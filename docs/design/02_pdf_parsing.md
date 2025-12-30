## 2. PDF解析アプローチ

本プロジェクトでは、PDFからのテキストおよび構造化データ抽出に **Google Cloud Document AI** を全面的に採用します。その理由は、高精度なOCR、特定のドキュメントタイプ（請求書、領収書など）に特化した専用プロセッサの存在、そしてサーバーレスアーキテクチャとの親和性の高さにあります。

### 参照実装
https://docs.cloud.google.com/bigquery/docs/rag-pipeline-pdf?hl=ja

### 2.1. 解析ワークフロー

PDFファイルのランディングゾーンはGoogle App ScriptによってGoogle Drive側からGoogle Cloud Storage Bucketへとファイルがコピーされます。
PDFファイルの解析からAIエージェント用データ作成まではBigQueryとdbtを使って構築します。

#### データの変換

1. Google DriveのPDF -> GCS PDF : GASがGoogle DriveのPDFをGCSへの転送する
2. GCS PDFの `raw_documents` -> BigQuery `documents` : PDFをDocument AIにかけてテキストデータを抽出する ( `ML.PROCESS_DOCUMENT` 利用)
    - ここで chunking も実施する想定
3. BigQuery `documents` -> 各種別ごとの構造化されたBigQueryテーブル: `documents` のタイトル部分から種別を判定して分類
    - journal
    - photo album
    - monthly announcement
    - monthly lunch schedule
    - monthly lunch info
    - uncategorized
4. 各種文書テーブル -> 埋め込みベクトルと検索用ベクトルインデックス ( [参考](https://docs.cloud.google.com/bigquery/docs/vector-index-text-search-tutorial?hl=ja) )

1のみGASで処理し、それ以外はdbt + BigQueryを使って処理する。

### 2.2. データモデル
#### 設計ポリシー
- 入力となるPDFファイルは後から更新することは原則的にないためランディングゾーンでは増分テーブル方式を採用する。
- 派生するデータは上流データのIDを参照することで究極的な上流のファイルを一意に識別する。
    - 例: `source_id` は上流データのIDを参照するため派生データから生のPDFを取得可能。
- 解析済み文書データは単一のテーブルに保存し、それ以外のテーブルでは持たないようにすることでテキストデータの重複管理を回避する。文書種別ごとのテーブルはあくまでもメタデータとサマリを最適な構造で保管するために存在する。

#### Cloud Storage PDFデータ
Google App Scriptからアップロードされるファイル。

ファイルの変更タイムスタンプを用いたパーティショニングを行うことで、後段のパイプラインでは直前1時間の新着のみを取り出せるようにする。
```
gs://${bucket_name}/${%Y-%m-%d}/${%H}/${file_id}.pdf
```

タイムスタンプはGASの以下のフィールド値を用いる

https://developers.google.com/apps-script/reference/drive/file?hl=ja
`getLastUpdated()	Date	File が最後に更新された日付を取得します`

#### BigQuery: `raw_documents` テーブル
BigQuery オブジェクトテーブルによる非構造化データのストレージを表すテーブルです。

- メタデータのキャッシュ保存: 無効

https://docs.cloud.google.com/bigquery/docs/object-table-introduction?hl=ja

#### BigQuery: `documents` テーブル
抽出したPDFのメタデータとチャンク化したプレーンテキストを格納する主要なテーブルです。

#### BigQuery: `journal` テーブル
日々の連絡事項などの日誌テーブルです。

#### BigQuery: `photo_album` テーブル
画像データを多く含むアルバムテーブルです。

#### BigQuery: `monthly_announcement` テーブル
月次発行されるお知らせテーブルです。

#### BigQuery: `monthly_lunch_schedule` テーブル
月次発行される給食の献立テーブルです。

#### BigQuery: `monthly_lunch_info` テーブル
月次発行される給食のテーマについてのテーブルです。

#### BigQuery: `uncategorized` テーブル
その他分類不能な文書のテーブルです。
分類器の想定外の文書なので何らかの新しい分類を作成する必要があることを示唆します。

### 2.3. インフラストラクチャ (IaC)

このワークフローを実現するため、OpenTofuを用いて以下のリソースを `tf/modules/` 以下に定義します。

### 2.2. リソース
-   **GCS Buckets**:
    - `school-agent-prod-pdf-uploads`: PDFアップロード用バケット。
-   **Cloud Scheduler**:
    -   Cloud Functionを定期的にトリガーするジョブ。
-   **Cloud Workflow**:
    - `school-agent-process-documents`: 
-   **Artifact Registry**:
    - リポジトリ `utky-applications`: utkyの各種Dockerイメージをまとめて収容する。
-   **Cloud Run Job**:
    - `school-agent-dbt` 
-   **IAM (Service Account)**:
    - `school-agent-gas-sa`: Google App Script用
    - `school-agent-process-documents-sa`
    -   Cloud Functionのサービスアカウントに、GCS、BigQuery、Document AIへのアクセス権限を付与。
-   **Document AI**:
    -   `Document OCR` プロセッサーインスタンス。
-   **BigQuery**:
    -   `school_agent_documents` テーブルを含むデータセット。

### 2.4. エラーハンドリング

-   Document AIでの処理や関数内のロジックでエラーが発生した場合、関数は`status`カラムを `FAILED` に更新し、エラー情報をCloud Loggingに詳細に出力します。
-   関数の実行自体がタイムアウトなどで失敗した場合でも、冪等性が確保されているため、次回のスケジューラー実行時に未完了のタスクが再試行されます。
