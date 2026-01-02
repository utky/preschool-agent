## 2. PDF解析アプローチ

**最終更新**: 2026-01-01（設計レビュー反映）

本プロジェクトでは、PDFからのテキストおよび構造化データ抽出に **Google Cloud Document AI** を全面的に採用します。その理由は、高精度なOCR、特定のドキュメントタイプ（請求書、領収書など）に特化した専用プロセッサの存在、そしてサーバーレスアーキテクチャとの親和性の高さにあります。

### 主要な設計決定事項

1. **チャンク設計**: 1チャンク = 1レコード（BigQuery Vector Indexの制約）
2. **チャンク識別**: UUID v4による一意識別（アルゴリズム変更に堅牢）
3. **型安全性**: STRUCT型を採用（JSON型ではなく）
4. **RAG最適化**: 文書メタデータを`document_chunks`テーブルに冗長保存
5. **埋め込み生成**: `ML.GENERATE_EMBEDDING`を別ステップで実行（Document AIは埋め込みを生成しない）

### 参照実装
https://docs.cloud.google.com/bigquery/docs/rag-pipeline-pdf?hl=ja

### 2.1. 解析ワークフロー

PDFファイルのランディングゾーンはGoogle App ScriptによってGoogle Drive側からGoogle Cloud Storage Bucketへとファイルがコピーされます。
PDFファイルの解析からAIエージェント用データ作成まではBigQueryとdbtを使って構築します。

#### データの変換

1. **Google Drive → GCS**: GASがGoogle DriveのPDFをGCSへ転送
2. **GCS → テキスト抽出**: `ML.PROCESS_DOCUMENT`でDocument AIを使用してテキスト抽出
   - 出力: `document_id`, `chunk_index`, `chunk_text`
   - **重要**: Document AIは埋め込みを生成しない
3. **チャンク化**: 抽出されたテキストをチャンク化し、UUID v4を生成
   - 出力: `chunk_id` (UUID v4), `document_id`, `chunk_index`, `chunk_text`, `section_id`, `section_title`
4. **埋め込み生成**: `ML.GENERATE_EMBEDDING`でVertex AI Embeddingを使用
   - 入力: `chunk_text`
   - 出力: `chunk_embedding` (ARRAY<FLOAT64>, 768次元)
5. **文書種別分類**: タイトル部分から種別を判定
   - journal, photo_album, monthly_announcement, monthly_lunch_schedule, monthly_lunch_info, uncategorized
6. **Vector Index作成**: `document_chunks`テーブルの`chunk_embedding`カラムにベクトルインデックスを作成
   - [参考](https://docs.cloud.google.com/bigquery/docs/vector-index-text-search-tutorial?hl=ja)

**処理担当**:
- ステップ1: GAS
- ステップ2-6: dbt + BigQuery

**参考資料**:
- [ML.PROCESS_DOCUMENT](https://cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-process-document)
- [ML.GENERATE_EMBEDDING](https://cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-generate-embedding)
- [Build a RAG pipeline from PDFs](https://docs.cloud.google.com/bigquery/docs/rag-pipeline-pdf)

### 2.2. データモデル

#### 設計の基本方針

**1. チャンク設計: 1チャンク = 1レコード**
- BigQuery Vector Indexは `ARRAY<STRUCT>` 内のベクトルにインデックスを作成できないため、1チャンク = 1レコード構造を採用
- 参考: [BigQuery Vector Index](https://cloud.google.com/bigquery/docs/vector-index)

**2. UUID v4によるチャンク識別**
- `chunk_id`: UUID v4で一意性を保証
- チャンク分割アルゴリズム変更時の整合性を確保
- 再処理・バックフィル時のデータ整合性を保証

**3. RAG検索用の冗長メタデータ**
- `document_chunks`テーブルに`document_type`, `title`, `publish_date`を冗長に保存
- Vector Search時にJOINなしでフィルタリングし、パーティションpruningとクラスタリングの恩恵を最大化

**4. STRUCT型の採用**
- JSON型ではなくSTRUCT型を使用（型安全性、クエリ可読性、dbt管理の容易さ）
- 構造化データ（sections, menu_items, nutrition_infoなど）は `ARRAY<STRUCT>` または `STRUCT` で定義

**5. テキストデータの重複許容**
- 中間テーブル（`stg_documents_text`）と最終テーブル（`document_chunks`）でのテキスト重複は許容
- `ML.PROCESS_DOCUMENT`は重い処理なので、中間テーブルを保存することで再実行を回避
- ストレージコストは無視できる（年間1.2MB程度）

**6. 増分処理とトレーサビリティ**
- 入力PDFファイルは更新されないため、ランディングゾーンでは増分テーブル方式を採用
- 派生データは`source_id`で上流データを参照し、元のPDFまで追跡可能
- 文書種別ごとのテーブルはメタデータとサマリの最適な構造での保管に特化

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

```sql
CREATE EXTERNAL TABLE raw_documents
WITH CONNECTION `project-id.region.connection-id`
OPTIONS (
  object_metadata = 'SIMPLE',
  uris = ['gs://school-agent-prod-pdf-uploads/*/*/*.pdf'],
  max_staleness = 0
);

-- オブジェクトテーブルの自動生成カラム:
-- - uri: STRING (gs://... のフルパス)
-- - generation: INT64
-- - size: INT64 (バイト)
-- - md5_hash: STRING
-- - updated: TIMESTAMP
-- - content_type: STRING
```
#### BigQuery: `documents` テーブル

文書単位のメタデータを格納する正規化テーブルです（1 PDF = 1レコード）。
`document_chunks`テーブルには検索に必要な最小限のメタデータのみ保存し、詳細情報が必要な場合のみこのテーブルとJOINします。

```sql
CREATE TABLE documents (
  -- 主キー
  document_id STRING NOT NULL,           -- 文書の一意ID（UUID v4推奨）

  -- ソース情報
  source_id STRING NOT NULL,             -- raw_documentsへの参照（GCS URI）
  file_name STRING NOT NULL,             -- 元のファイル名
  file_size INT64,                       -- ファイルサイズ（バイト）
  md5_hash STRING,                       -- ファイルのMD5ハッシュ

  -- 文書情報
  document_type STRING NOT NULL,         -- journal, photo_album, monthly_announcement,
                                         -- monthly_lunch_schedule, monthly_lunch_info, uncategorized
  title STRING,                          -- 文書タイトル（Document AIから抽出）
  publish_date DATE NOT NULL,            -- 発行日

  -- 処理統計
  total_chunks INT64,                    -- チャンク総数
  total_pages INT64,                     -- ページ総数
  total_tokens INT64,                    -- トークン総数

  -- 処理状態
  processing_status STRING NOT NULL DEFAULT 'PENDING',  -- PENDING, COMPLETED, FAILED
  error_message STRING,                  -- エラー時の詳細
  processed_at TIMESTAMP,                -- 処理完了日時

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY publish_date
CLUSTER BY document_type
OPTIONS(
  description='文書単位のメタデータ（正規化テーブル）',
  require_partition_filter=true
);
```

#### BigQuery: `document_chunks` テーブル

RAG検索用のチャンクテーブルです（1チャンク = 1レコード）。
Vector Search時のパフォーマンスを最大化するため、文書メタデータを冗長に保存しています。

```sql
CREATE TABLE document_chunks (
  -- 主キー
  chunk_id STRING NOT NULL,              -- チャンクの一意ID（UUID v4推奨）
  document_id STRING NOT NULL,           -- 文書の一意ID（UUID v4推奨）
  chunk_index INT64 NOT NULL,            -- チャンク順序（0始まり、参考用）

  -- チャンクデータ
  chunk_text STRING NOT NULL,            -- チャンク化されたテキスト
  chunk_token_count INT64,               -- トークン数
  chunk_embedding ARRAY<FLOAT64>,        -- ベクトル埋め込み（768次元など）
  page_number INT64,                     -- 元PDFのページ番号

  -- セクション情報
  section_id STRING,                     -- セクション識別子（例: "sec_001"）
  section_title STRING,                  -- セクションタイトル（例: "今週のお知らせ"）

  -- RAG検索用メタデータ（冗長だが必要）
  -- 理由: Vector Search時にJOINなしでフィルタリングするため
  source_id STRING NOT NULL,             -- raw_documentsへの参照（GCS URI）
  file_name STRING,                      -- 元のファイル名
  document_type STRING NOT NULL,         -- journal, photo_album, monthly_announcement,
                                         -- monthly_lunch_schedule, monthly_lunch_info, uncategorized
  title STRING,                          -- 文書タイトル（Document AIから抽出）
  publish_date DATE NOT NULL,            -- 発行日（パーティションキー）

  -- 処理状態
  processing_status STRING NOT NULL DEFAULT 'PENDING',  -- PENDING, COMPLETED, FAILED
  error_message STRING,                  -- エラー時の詳細

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY publish_date
CLUSTER BY document_type, document_id, chunk_id
OPTIONS(
  description='RAG検索用のチャンクテーブル（メタデータ冗長保存）',
  require_partition_filter=true
);

-- Vector Index（ベクトル検索用）
CREATE VECTOR INDEX document_chunks_embedding_idx
ON document_chunks(chunk_embedding)
OPTIONS(
  distance_type = 'COSINE',
  index_type = 'IVF',
  ivf_options = '{"num_lists": 1000, "num_probes": 50}'
);
```

**設計のポイント**:
1. `chunk_id`: UUID v4で一意性を保証（チャンク分割アルゴリズム変更に堅牢）
2. `document_type`, `title`, `publish_date`: 冗長だがRAG検索のパフォーマンスに必須
3. `section_id`, `section_title`: チャンクがどのセクションに属するかを記録
4. クラスタリング順序: `document_type` (低カーディナリティ) → `document_id` → `chunk_id`

#### BigQuery: `pending_events` テーブル

承認待ちのイベント・予定・期限を管理するテーブルです。
解析結果として保存したデータに予定や期限に関するものがあれば、承認待ちリストに追加します。

```sql
CREATE TABLE pending_events (
  -- 主キー
  event_id STRING NOT NULL,              -- イベントの一意ID（UUID v4推奨）

  -- 参照
  document_id STRING NOT NULL,           -- 元文書への参照

  -- イベント情報
  event_type STRING NOT NULL,            -- deadline, schedule, submission, other
  event_date DATE,                       -- イベント日付
  event_time TIME,                       -- イベント時刻（あれば）
  event_title STRING NOT NULL,           -- イベントタイトル
  event_description STRING,              -- 詳細説明
  event_location STRING,                 -- 場所（あれば）

  -- 承認ワークフロー
  approval_status STRING NOT NULL DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
  approved_by STRING,                    -- 承認者のユーザーID
  approved_at TIMESTAMP,                 -- 承認日時
  rejection_reason STRING,               -- 却下理由

  -- カレンダー連携
  calendar_event_id STRING,              -- Googleカレンダーイベントへの参照
  calendar_synced_at TIMESTAMP,          -- カレンダー同期日時

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(event_date)
CLUSTER BY approval_status, event_type
OPTIONS(
  description='承認待ちのイベント・予定・期限',
  require_partition_filter=false  -- NULLのevent_dateもあり得るため
);
```

#### BigQuery: `journal` テーブル

日々の連絡事項などの日誌テーブルです。

```sql
CREATE TABLE journal (
  -- 主キー
  document_id STRING NOT NULL,           -- documentsへの参照（1:1）

  -- 日誌固有の情報
  article_number STRING,                 -- 記事番号（例: "No.123"）
  japanese_era STRING,                   -- 和暦（例: "令和7年"）
  weekday STRING,                        -- 曜日

  -- 構造化データ（STRUCT型）
  sections ARRAY<STRUCT<
    section_id STRING,                   -- セクション識別子（例: "sec_001"）
    title STRING,                        -- セクションタイトル（例: "お知らせ"）
    chunk_ids ARRAY<STRING>,             -- チャンクへの参照（UUID配列）
    order INT64,                         -- セクション順序
    deadline DATE                        -- 提出期限（オプショナル、NULLを許容）
  >>,

  extracted_events ARRAY<STRUCT<
    type STRING,                         -- deadline, schedule, submission, other
    date DATE,                           -- イベント日付
    title STRING,                        -- イベントタイトル
    source_section_id STRING,            -- 元のセクション識別子
    source_section_title STRING          -- 元のセクションタイトル
  >>,

  -- AI生成サマリ
  summary STRING,                        -- LLMで生成した要約
  keywords ARRAY<STRING>,                -- 抽出されたキーワード

  -- タイムスタンプ
  publish_date DATE NOT NULL,            -- 発行日
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY publish_date
CLUSTER BY article_number
OPTIONS(
  description='日誌（journal）の構造化メタデータ（STRUCT型）',
  require_partition_filter=true
);
```


#### BigQuery: `photo_album` テーブル

画像データを多く含むアルバムテーブルです。

```sql
CREATE TABLE photo_album (
  -- 主キー
  document_id STRING NOT NULL,           -- documentsへの参照（1:1）

  -- アルバム固有の情報
  author STRING,                         -- 執筆者
  japanese_era STRING,                   -- 和暦
  school_name STRING,                    -- 園名

  -- 構造化データ（STRUCT型）
  photo_ids ARRAY<STRING>,               -- photosテーブルへの参照配列
  photo_count INT64,                     -- 写真の数

  care_content_table ARRAY<STRUCT<
    activity STRING,                     -- 活動内容（例: "外遊び"）
    date DATE,                           -- 活動日
    description STRING                   -- 活動の詳細説明（オプショナル）
  >>,

  -- AI生成サマリ
  summary STRING,                        -- LLMで生成した要約

  -- タイムスタンプ
  publish_date DATE,                     -- 発行日
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_at)
OPTIONS(
  description='写真アルバムの構造化メタデータ（STRUCT型）'
);
```

#### `photos` テーブル（写真データ）

PDFに含まれる写真は個別にCloud Storageに非構造化データとして保存する

```sql
CREATE TABLE photos (
  -- 主キー
  photo_id STRING NOT NULL,              -- 写真の一意ID（UUID推奨）

  -- 参照
  document_id STRING NOT NULL,           -- 元文書への参照

  -- ストレージ情報
  gcs_uri STRING NOT NULL,               -- gs://bucket/path/to/photo.jpg

  -- メタデータ
  page_number INT64,                     -- 元PDFのページ番号
  position_index INT64,                  -- ページ内での出現順序
  width INT64,                           -- 画像幅（ピクセル）
  height INT64,                          -- 画像高さ（ピクセル）
  format STRING,                         -- jpg, png, etc.

  -- OCR結果
  caption STRING,                        -- Document AIで抽出されたキャプション
  detected_text STRING,                  -- 画像内のテキスト（あれば）

  -- タイムスタンプ
  extracted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(extracted_at)
CLUSTER BY document_id
OPTIONS(
  description='PDFから抽出された写真のメタデータ'
);
```

#### BigQuery: `monthly_announcement` テーブル

月次発行されるお知らせテーブルです。

```sql
CREATE TABLE monthly_announcement (
  -- 主キー
  document_id STRING NOT NULL,           -- documentsへの参照（1:1）

  -- 月次お知らせ固有の情報
  year_month DATE NOT NULL,              -- 対象月度（月初日で統一）

  -- 構造化データ（STRUCT型）
  introduction_text STRING,              -- 序文

  schedule ARRAY<STRUCT<
    date DATE,                           -- イベント日付
    event STRING,                        -- イベント名（例: "遠足"）
    description STRING                   -- イベントの詳細（オプショナル）
  >>,

  star_sections ARRAY<STRUCT<
    title STRING,                        -- セクションタイトル（例: "持ち物について"）
    chunk_ids ARRAY<STRING>,             -- チャンクへの参照（UUID配列）
    order INT64                          -- セクション順序
  >>,

  care_goals STRUCT<
    age_groups ARRAY<STRUCT<
      age STRING,                        -- 年齢グループ（例: "3歳児"）
      goal STRING                        -- 保育目標
    >>
  >,

  extracted_events ARRAY<STRUCT<
    type STRING,                         -- deadline, schedule, submission, other
    date DATE,                           -- イベント日付
    title STRING,                        -- イベントタイトル
    source_section_title STRING          -- 元のセクションタイトル
  >>,

  -- AI生成サマリ
  summary STRING,                        -- LLMで生成した要約

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY year_month
OPTIONS(
  description='月次お知らせの構造化メタデータ（STRUCT型）',
  require_partition_filter=true
);
```

#### BigQuery: `monthly_lunch_schedule` テーブル

月次発行される給食の献立テーブルです。

```sql
CREATE TABLE monthly_lunch_schedule (
  -- 主キー
  document_id STRING NOT NULL,           -- documentsへの参照（1:1）

  -- 給食献立固有の情報
  year_month DATE NOT NULL,              -- 対象月度（月初日で統一）
  school_name STRING,                    -- 園名

  -- 構造化データ（STRUCT型）
  menu_items ARRAY<STRUCT<
    date DATE,                           -- 献立日付
    main STRING,                         -- 主菜（例: "カレーライス"）
    side STRING,                         -- 副菜（例: "サラダ"）
    soup STRING,                         -- 汁物（例: "味噌汁"）
    dessert STRING                       -- デザート（例: "果物"）
  >> NOT NULL,

  nutrition_info STRUCT<
    calories FLOAT64,                    -- 平均カロリー（kcal）
    protein FLOAT64,                     -- 平均タンパク質（g）
    fat FLOAT64,                         -- 平均脂質（g）
    carbs FLOAT64,                       -- 平均炭水化物（g）
    salt FLOAT64                         -- 平均塩分（g）
  >,

  -- AI生成サマリ
  summary STRING,                        -- LLMで生成した要約

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY year_month
OPTIONS(
  description='月次給食献立の構造化メタデータ（STRUCT型）',
  require_partition_filter=true
);
```

#### BigQuery: `monthly_lunch_info` テーブル

月次発行される給食のテーマについてのテーブルです。

```sql
CREATE TABLE monthly_lunch_info (
  -- 主キー
  document_id STRING NOT NULL,           -- documentsへの参照（1:1）

  -- 給食お知らせ固有の情報
  year_month DATE NOT NULL,              -- 対象月度（月初日で統一）
  author STRING,                         -- 執筆者

  -- 構造化データ（STRUCT型）
  introduction_text STRING,              -- 序文

  content_sections ARRAY<STRUCT<
    title STRING,                        -- セクションタイトル（例: "今月のテーマ"）
    chunk_ids ARRAY<STRING>,             -- チャンクへの参照（UUID配列）
    order INT64                          -- セクション順序
  >>,

  -- AI生成サマリ
  summary STRING,                        -- LLMで生成した要約

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY year_month
OPTIONS(
  description='月次給食お知らせの構造化メタデータ（STRUCT型）',
  require_partition_filter=true
);
```

#### BigQuery: `uncategorized` テーブル
その他分類不能な文書のテーブルです。
分類器の想定外の文書なので何らかの新しい分類を作成する必要があることを示唆します。

```sql
CREATE TABLE uncategorized (
  -- 主キー
  document_id STRING NOT NULL,           -- documentsへの参照（1:1）

  -- 分類失敗の理由
  classification_confidence FLOAT64,     -- 分類器の信頼度（低い場合にここに入る）
  suggested_type STRING,                 -- 推測された文書種別（あれば）

  -- 人手による分類のためのヒント
  manual_review_notes STRING,            -- レビュー担当者のメモ
  manual_classification STRING,          -- 人手で付与した分類

  -- AI生成サマリ
  summary STRING,                        -- LLMで生成した要約

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_at)
OPTIONS(
  description='未分類文書（新しい文書種別の候補）'
);
```

### 2.3. BigQuery最適化とベクトル検索

#### パーティショニングとクラスタリングの戦略

すべてのテーブルで適切なパーティショニングとクラスタリングを設定し、スキャン量を最小化します。

**クラスタリングの原則**:
1. フィルタ頻度の高いカラムを優先
2. 低カーディナリティ → 高カーディナリティの順序
3. 最大4カラムまで

**クエリパターンの想定**:
- "直近1週間のお知らせは？" → `publish_date` 範囲検索
- "今月の給食献立は？" → `document_type` + `year_month` 範囲検索
- "提出期限が近いものは？" → `event_date` 範囲検索

#### ベクトル検索の詳細

```sql
-- 埋め込みモデルの定義
CREATE OR REPLACE MODEL `project.dataset.text_embedding_005`
REMOTE WITH CONNECTION `project.region.vertex_connection`
OPTIONS (
  endpoint = 'text-embedding-005'
);

-- ベクトル検索クエリの例
WITH query_embedding AS (
  SELECT embedding
  FROM ML.GENERATE_TEXT_EMBEDDING(
    MODEL `project.dataset.text_embedding_005`,
    (SELECT '今月の給食献立は？' AS content),
    STRUCT('RETRIEVAL_QUERY' AS task_type)
  )
)
SELECT
  dc.chunk_id,
  dc.document_id,
  dc.title,
  dc.section_title,
  dc.chunk_text,
  vs.distance
FROM VECTOR_SEARCH(
  TABLE document_chunks,
  'chunk_embedding',
  (SELECT embedding FROM query_embedding),
  top_k => 10,
  distance_type => 'COSINE'
) AS vs
JOIN document_chunks AS dc
  ON vs.chunk_id = dc.chunk_id
WHERE
  -- パーティション pruning（スキャン量削減）
  dc.publish_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  -- 文書種別フィルタ（クラスタリング効果）
  AND dc.document_type IN ('monthly_lunch_schedule', 'monthly_lunch_info')
  -- 処理済みのみ
  AND dc.processing_status = 'COMPLETED'
ORDER BY vs.distance ASC
LIMIT 10;
```

**参考資料**:
- [BigQuery Vector Search](https://cloud.google.com/bigquery/docs/vector-search)
- [Vector Index](https://cloud.google.com/bigquery/docs/vector-index)

### 2.4. dbtプロジェクト構造

```
dbt_project/
├── models/
│   ├── staging/                      # Layer 1: Raw → Staging
│   │   ├── _sources.yml              # raw_documents の定義
│   │   ├── _staging.yml              # スキーマ定義
│   │   ├── stg_raw_documents.sql     # Object Tableのラッパー
│   │   └── stg_documents_text.sql    # ML.PROCESS_DOCUMENT（テキストのみ、保存）
│   ├── intermediate/                 # Layer 2: ビジネスロジック
│   │   ├── _intermediate.yml
│   │   ├── int_document_chunks.sql   # チャンク化（UUID生成）
│   │   ├── int_document_embeddings.sql  # ML.GENERATE_EMBEDDING
│   │   ├── int_extracted_photos.sql  # 写真抽出
│   │   └── int_extracted_events.sql  # イベント抽出
│   ├── marts/                        # Layer 3: 最終テーブル
│   │   ├── core/
│   │   │   ├── _core.yml
│   │   │   ├── document_chunks.sql   # テキスト + 埋め込み + 冗長メタデータ
│   │   │   ├── documents.sql         # 文書単位のメタデータ（正規化）
│   │   │   ├── photos.sql
│   │   │   └── pending_events.sql
│   │   └── document_types/
│   │       ├── _document_types.yml
│   │       ├── journal.sql           # UUID参照
│   │       ├── photo_album.sql       # UUID参照
│   │       ├── monthly_announcement.sql
│   │       ├── monthly_lunch_schedule.sql
│   │       ├── monthly_lunch_info.sql
│   │       └── uncategorized.sql
│   └── analytics/                    # Layer 4: AI/分析用ビュー
│       ├── _analytics.yml
│       └── vector_search_ready.sql   # RAG用の最適化ビュー
├── macros/
│   ├── generate_uuid.sql             # UUID v4生成
│   ├── chunk_text.sql                # チャンク化UDF
│   └── extract_document_metadata.sql # メタデータ抽出
├── tests/
│   ├── assert_no_duplicate_chunk_ids.sql
│   └── assert_no_orphaned_photos.sql
└── seeds/
    └── document_type_mapping.csv     # 文書種別のマッピング
```

**データフロー**:
```
raw_documents (Object Table)
  ↓
stg_documents_text (ML.PROCESS_DOCUMENT: テキスト抽出、保存)
  ↓
int_document_chunks (チャンク化、UUID生成)
  ↓
int_document_embeddings (ML.GENERATE_EMBEDDING)
  ↓
document_chunks (テキスト + 埋め込み + 冗長メタデータ)
documents (文書単位のメタデータ、正規化)
  ↓
journal, photo_album, etc. (UUID参照)
```

**主要モデルの説明**:
1. `stg_documents_text.sql`: ML.PROCESS_DOCUMENTでテキスト抽出（増分処理用に保存）
2. `int_document_chunks.sql`: チャンク化ロジック、UUID v4生成、section_id/section_title抽出
3. `int_document_embeddings.sql`: ML.GENERATE_EMBEDDINGで埋め込み生成
4. `document_chunks.sql`: 最終テーブル（RAG検索用、冗長メタデータあり）
5. `documents.sql`: 文書単位のメタデータ（正規化）

### 2.5. インフラストラクチャ (IaC)

このワークフローを実現するため、OpenTofuを用いて以下のリソースを `tf/modules/` 以下に定義します。

### 2.6. リソース
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

### 2.7. エラーハンドリング

-   Document AIでの処理や関数内のロジックでエラーが発生した場合、関数は`processing_status`カラムを `FAILED` に更新し、エラー情報を`error_message`カラムとCloud Loggingに詳細に出力します。
-   関数の実行自体がタイムアウトなどで失敗した場合でも、冪等性が確保されているため、次回のスケジューラー実行時に未完了のタスクが再試行されます。
-   dbtの増分処理は`incremental_strategy='merge'`でUPSERTとして動作し、同じファイルが再処理されても重複を防ぎます。
