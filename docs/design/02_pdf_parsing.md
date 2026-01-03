## 2. PDF解析アプローチ

**最終更新**: 2026-01-03（extracted_eventsの正規化とイベント管理のシンプル化）

本プロジェクトでは、PDFからのテキストおよび構造化データ抽出に **Google Cloud Document AI** を全面的に採用します。その理由は、高精度なOCR、特定のドキュメントタイプ（請求書、領収書など）に特化した専用プロセッサの存在、そしてサーバーレスアーキテクチャとの親和性の高さにあります。

### 主要な設計決定事項

1. **チャンク設計**: 1チャンク = 1レコード（BigQuery Vector Indexの制約）
2. **チャンク識別**: UUID v4による一意識別（アルゴリズム変更に堅牢）
3. **型安全性**: STRUCT型を採用（JSON型ではなく）
4. **RAG最適化**: 文書メタデータを`document_chunks`テーブルに冗長保存
5. **埋め込み生成**: `ML.GENERATE_EMBEDDING`を別ステップで実行（Document AIは埋め込みを生成しない）
6. **イベント管理**: 承認ワークフローを廃止し、フロントエンドでのワンタップ登録に統一
7. **イベント正規化**: `extracted_events`を独立したテーブルとして管理（複数文書種別からの参照を一元化）

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

#### BigQuery: `calendar_sync_history` テーブル

フロントエンドからカレンダー登録された履歴を記録するテーブルです。
承認ワークフローは廃止し、ユーザーがUIでワンタップ登録した時点で記録されます。

**設計思想**:
- 状態管理を排除（登録 = 記録）
- 重複登録防止機能を内蔵（家族共有前提）
- 誰か1人が登録すれば全員から「登録済み」として認識される
- `event_hash` のみで一意性を保証（ユーザーごとの重複管理は行わない）
- `synced_by` は履歴記録用（誰が登録したかのトレーサビリティ）

```sql
CREATE TABLE calendar_sync_history (
  -- 主キー
  sync_id STRING NOT NULL,              -- UUID v4

  -- イベント情報
  document_id STRING NOT NULL,          -- 元文書への参照
  event_type STRING NOT NULL,           -- deadline, schedule, submission, other
  event_date DATE NOT NULL,             -- イベント日付
  event_title STRING NOT NULL,          -- イベントタイトル
  event_description STRING,             -- 詳細説明

  -- ソース情報
  source_table STRING NOT NULL,         -- journal, monthly_announcement, etc.
  source_section_title STRING,          -- 元のセクションタイトル

  -- カレンダー情報
  calendar_event_id STRING NOT NULL,    -- Googleカレンダーイベントへの参照
  calendar_link STRING,                 -- カレンダーイベントへの直リンク

  -- ユーザー情報（誰が登録したかの記録用、一意性制約には使わない）
  synced_by STRING NOT NULL,            -- ユーザーID（Auth.jsのsession.user.id）
  synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),

  -- 重複防止
  event_hash STRING NOT NULL,           -- MD5(event_type + event_date + event_title)

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(event_date)
CLUSTER BY synced_by, event_type
OPTIONS(
  description='カレンダー登録履歴'
);

-- 重複防止用のユニーク制約（同じイベントは家族全体で1回のみ登録可能）
CREATE UNIQUE INDEX idx_unique_event
ON calendar_sync_history(event_hash);
```

**使用例: 未登録イベントの取得**
```sql
-- 家族全体で未登録のイベントを取得（正規化版、documentsとJOIN）
WITH synced_hashes AS (
  SELECT event_hash
  FROM calendar_sync_history
)
SELECT
  e.event_id,
  e.document_id,
  e.event_type,
  e.event_date,
  e.event_title,
  e.event_description,
  e.source_table,
  e.source_section_title,
  d.title AS document_title,              -- documentsテーブルからJOINで取得
  d.document_type,                        -- 必要に応じて文書種別も取得可能
  d.publish_date,                         -- 必要に応じて発行日も取得可能
  MD5(CONCAT(e.event_type, CAST(e.event_date AS STRING), e.event_title)) AS event_hash
FROM extracted_events e
LEFT JOIN documents d ON e.document_id = d.document_id
WHERE
  e.event_date >= CURRENT_DATE()
  AND MD5(CONCAT(e.event_type, CAST(e.event_date AS STRING), e.event_title))
      NOT IN (SELECT event_hash FROM synced_hashes)
ORDER BY e.event_date ASC
LIMIT 50;
```

**journalなどの各テーブルにイベントリストを埋め込む設計との比較**:
- UNION ALLによる複数テーブルの結合が不要
- クエリが大幅に簡潔になり、可読性が向上
- 新しい文書種別を追加してもクエリの変更が不要
- パーティション pruning（`event_date`）により、効率的なスキャンが可能

#### BigQuery: `extracted_events` テーブル

**設計思想**:
- イベント情報を独立したテーブルとして管理し、複数の文書種別テーブルからの参照を一元化
- `upcoming_events`ビューの基盤となり、UNION ALLによる複雑なクエリを不要にする
- 将来的な文書種別の追加（例: 年次イベント、週間予定など）に対して拡張性が高い
- イベント単位での検索・集計・分析が容易になる

```sql
CREATE TABLE extracted_events (
  -- 主キー
  event_id STRING NOT NULL,              -- イベントの一意ID（UUID v4推奨）

  -- イベント情報
  event_type STRING NOT NULL,            -- deadline, schedule, submission, other
  event_date DATE NOT NULL,              -- イベント日付
  event_title STRING NOT NULL,           -- イベントタイトル
  event_description STRING,              -- 詳細説明（オプショナル）

  -- ソース情報（トレーサビリティ）
  document_id STRING NOT NULL,           -- documentsテーブルへの参照（JOINで文書情報を取得）
  source_table STRING NOT NULL,          -- journal, monthly_announcement, etc.
  source_section_id STRING,              -- 元のセクション識別子（journalの場合）
  source_section_title STRING,           -- 元のセクションタイトル

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY event_date
CLUSTER BY event_type, source_table
OPTIONS(
  description='文書から抽出されたイベント（正規化テーブル、documentsとJOINして使用）',
  require_partition_filter=true
);

-- インデックス: 重複防止用
CREATE UNIQUE INDEX idx_unique_extracted_event
ON extracted_events(event_type, event_date, event_title, document_id);
```

**正規化のメリット**:
1. **クエリの簡素化**: UNION ALLが不要になり、単一テーブルクエリで全イベントを取得可能
2. **拡張性**: 新しい文書種別を追加してもクエリを変更する必要がない
3. **パフォーマンス**: イベント日付でのパーティショニングにより、未来の予定のみを効率的にスキャン可能
4. **一貫性**: イベント構造が文書種別ごとに微妙に異なる問題を解消
5. **分析の容易さ**: イベント単位での統計・傾向分析が簡単に
6. **データ正規化**: 文書メタデータを冗長保存せず、`documents`テーブルとJOINして取得（データ一貫性の向上）

**正規化前との比較**:

| 項目 | 正規化前 | 正規化後 |
|------|---------|---------|
| イベント格納 | 各文書テーブルに`extracted_events`カラム | 独立した`extracted_events`テーブル |
| クエリ複雑度 | UNION ALL + UNNEST必要 | 単一テーブルクエリ（必要に応じてdocumentsとJOIN） |
| 文書種別追加時 | クエリの変更が必要 | 変更不要（拡張性高） |
| イベント検索 | 複数テーブルのスキャン | 単一テーブルのスキャン |
| パーティショニング | 各文書テーブルの`publish_date` | イベント日付（`event_date`）で直接パーティション可能 |
| 重複防止 | ハッシュベースのチェックのみ | UNIQUE INDEX + ハッシュの二重防御 |
| データ一貫性 | 各テーブルで重複管理が必要 | `documents`とJOINで最新情報を取得、冗長性なし |

**移行戦略**:
1. 既存の`journal`と`monthly_announcement`テーブルに`extracted_events`カラムがある場合:
   - `extracted_events`テーブルを新規作成
   - dbtで既存カラムから`extracted_events`テーブルへデータ移行
   - 既存カラムは削除せず、コメントで「非推奨」とマーク（後方互換性維持）
2. 新規実装の場合:
   - 最初から`extracted_events`テーブルのみ使用
   - 各文書テーブルには`extracted_events`カラムを作成しない

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

  -- イベント情報は extracted_events テーブルに正規化
  -- （後方互換性のため、ビューで extracted_events を結合して提供可能）

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

  -- 記事セクション（journalと同様の構造）
  sections ARRAY<STRUCT<
    section_id STRING,                   -- セクション識別子（例: "sec_001"）
    title STRING,                        -- セクションタイトル（例: "あつ～い日の過ごし方"）
    chunk_ids ARRAY<STRING>,             -- チャンクへの参照（UUID配列）
    order INT64                          -- セクション順序
  >>,

  -- 日程表（保育内容）
  schedule ARRAY<STRUCT<
    date DATE,                           -- 日付
    weekday STRING,                      -- 曜日
    activities ARRAY<STRING>,            -- 活動内容の配列（例: ["活動", "戸外遊び"]）
    notes STRING                         -- 備考（例: "※半日保育"）
  >>,

  -- お知らせ（箇条書き通知）
  announcements ARRAY<STRUCT<
    title STRING,                        -- お知らせタイトル（例: "22日(月)について"）
    content STRING,                      -- お知らせ内容
    date DATE,                           -- 該当日（あれば）
    time TIME                            -- 該当時刻（あれば）
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

  content_sections ARRAY<STRUCT<
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

  -- イベント情報は extracted_events テーブルに正規化
  -- （後方互換性のため、ビューで extracted_events を結合して提供可能）

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

  -- 日別メニュー（構造化データ）
  daily_menus ARRAY<STRUCT<
    date DATE,                           -- 献立日付
    weekday STRING,                      -- 曜日（例: "月"）

    -- 昼食（複数料理対応）
    lunch_items ARRAY<STRING>,           -- 昼食メニュー（例: ["焼きそば", "ちくわの磯辺揚げ", "フルーツゼリー"]）

    -- おやつ（別項目）
    snack_items ARRAY<STRING>,           -- おやつメニュー（例: ["鮭おにぎり", "牛乳"]）

    -- 食材分類（3色）
    ingredients_red ARRAY<STRING>,       -- 赤：血や肉になる（例: ["ウインナーソーセージ", "焼き竹輪", "ぎんざけ", "普通牛乳"]）
    ingredients_yellow ARRAY<STRING>,    -- 黄：熱や力となる（例: ["中華めん", "調合油", "天ぷら用バッター", "大豆油", "精白米", "いりごま"]）
    ingredients_green ARRAY<STRING>,     -- 緑：調子をととのえる（例: ["たまねぎ", "焼きのり", "はくさい", "にんじん", "みかん", "塩昆布"]）

    -- 日別栄養成分（おやつあり/なしの両方）
    nutrition_with_snack STRUCT<
      energy_kcal FLOAT64,               -- エネルギー（kcal）
      protein_g FLOAT64,                 -- たんぱく質（g）
      fat_g FLOAT64,                     -- 脂質（g）
      salt_g FLOAT64                     -- 塩分（g）
    >,
    nutrition_without_snack STRUCT<
      energy_kcal FLOAT64,               -- エネルギー（kcal）
      protein_g FLOAT64,                 -- たんぱく質（g）
      fat_g FLOAT64,                     -- 脂質（g）
      salt_g FLOAT64                     -- 塩分（g）
    >
  >> NOT NULL,

  -- 月平均栄養情報（おやつあり - 拡張版11項目）
  monthly_avg_with_snack STRUCT<
    energy_kcal FLOAT64,                 -- エネルギー（kcal）
    protein_g FLOAT64,                   -- たんぱく質（g）
    fat_g FLOAT64,                       -- 脂質（g）
    calcium_mg FLOAT64,                  -- カルシウム（mg）
    iron_mg FLOAT64,                     -- 鉄（mg）
    vitamin_a_ug FLOAT64,                -- ビタミンA（レチノール当量RE）（μg）
    vitamin_b1_mg FLOAT64,               -- ビタミンB1（mg）
    vitamin_b2_mg FLOAT64,               -- ビタミンB2（mg）
    vitamin_c_mg FLOAT64,                -- ビタミンC（mg）
    dietary_fiber_g FLOAT64,             -- 食物繊維（g）
    salt_g FLOAT64                       -- 食塩相当量（g）
  >,

  -- 月平均栄養情報（おやつなし - 拡張版11項目）
  monthly_avg_without_snack STRUCT<
    energy_kcal FLOAT64,                 -- エネルギー（kcal）
    protein_g FLOAT64,                   -- たんぱく質（g）
    fat_g FLOAT64,                       -- 脂質（g）
    calcium_mg FLOAT64,                  -- カルシウム（mg）
    iron_mg FLOAT64,                     -- 鉄（mg）
    vitamin_a_ug FLOAT64,                -- ビタミンA（レチノール当量RE）（μg）
    vitamin_b1_mg FLOAT64,               -- ビタミンB1（mg）
    vitamin_b2_mg FLOAT64,               -- ビタミンB2（mg）
    vitamin_c_mg FLOAT64,                -- ビタミンC（mg）
    dietary_fiber_g FLOAT64,             -- 食物繊維（g）
    salt_g FLOAT64                       -- 食塩相当量（g）
  >,

  -- AI生成サマリ
  summary STRING,                        -- LLMで生成した要約

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY year_month
OPTIONS(
  description='月次給食献立の構造化メタデータ（拡張版、3色食材分類・11項目栄養情報対応）',
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
│   │   └── int_extracted_photos.sql  # 写真抽出
│   ├── marts/                        # Layer 3: 最終テーブル
│   │   ├── core/
│   │   │   ├── _core.yml
│   │   │   ├── document_chunks.sql   # テキスト + 埋め込み + 冗長メタデータ
│   │   │   ├── documents.sql         # 文書単位のメタデータ（正規化）
│   │   │   ├── extracted_events.sql  # イベント正規化テーブル（全文書種別から抽出）
│   │   │   └── photos.sql
│   │   └── document_types/
│   │       ├── _document_types.yml
│   │       ├── journal.sql           # UUID参照、イベント情報なし
│   │       ├── photo_album.sql       # UUID参照
│   │       ├── monthly_announcement.sql  # イベント情報なし
│   │       ├── monthly_lunch_schedule.sql
│   │       ├── monthly_lunch_info.sql
│   │       └── uncategorized.sql
│   └── analytics/                    # Layer 4: AI/分析用ビュー
│       ├── _analytics.yml
│       ├── vector_search_ready.sql   # RAG用の最適化ビュー
│       └── upcoming_events.sql       # extracted_eventsから未登録イベントを取得
├── macros/
│   ├── generate_uuid.sql             # UUID v4生成
│   ├── chunk_text.sql                # チャンク化UDF
│   └── extract_document_metadata.sql # メタデータ抽出
├── tests/
│   ├── assert_no_duplicate_chunk_ids.sql
│   ├── assert_no_duplicate_event_ids.sql  # イベント重複チェック
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
journal, photo_album, monthly_announcement, etc. (UUID参照、イベント情報なし)
  ↓
extracted_events (正規化: 全文書種別のイベントを一元管理)
  ↓
upcoming_events (ビュー: extracted_eventsから未登録イベントを取得)
  ↓
[フロントエンド] ユーザーがカレンダー登録
  ↓
calendar_sync_history (登録履歴)
```

**主要モデルの説明**:
1. `stg_documents_text.sql`: ML.PROCESS_DOCUMENTでテキスト抽出（増分処理用に保存）
2. `int_document_chunks.sql`: チャンク化ロジック、UUID v4生成、section_id/section_title抽出
3. `int_document_embeddings.sql`: ML.GENERATE_EMBEDDINGで埋め込み生成
4. `document_chunks.sql`: 最終テーブル（RAG検索用、冗長メタデータあり）
5. `documents.sql`: 文書単位のメタデータ（正規化）
6. `journal.sql`, `monthly_announcement.sql`: 文書種別ごとのメタデータ（イベント情報は含まない）
7. `extracted_events.sql`: 全文書種別から抽出されたイベントを一元管理（正規化）
8. `upcoming_events.sql`: `extracted_events`から未登録イベントを取得するビュー

**イベント管理のフロー（正規化版）**:
- バックエンド（dbt）: 各文書種別からイベントを抽出し、`extracted_events`テーブルに集約
- フロントエンド: `upcoming_events`ビューから未登録イベントを取得して表示
- ユーザー操作: UIで登録 → Googleカレンダー + `calendar_sync_history`に記録

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

#### dbt + BigQuery側（バッチ処理）

-   **処理方式**: dbtによる一括バッチ処理（トランザクション単位で成功/失敗）
-   **冪等性**: `incremental_strategy='merge'` でUPSERT動作、同じファイルの再処理でも重複を防止
-   **失敗時の運用**: Cloud Workflowを再実行し、dbtモデルを再実行
-   **エラー追跡**:
  - BigQueryのジョブ履歴で実行ログを確認
  - Cloud Loggingでdbt実行ログとエラー詳細を確認
  - テーブルに存在するレコード = 処理完了とみなす（状態管理カラム不要）

#### Google Apps Script側（PDF転送）

-   **エラーハンドリング設計**: 未完了
-   **想定されるエラー**:
  - Google Drive APIのレート制限
  - GCS転送時のネットワークエラー
  - 権限エラー（Service Accountの権限不足）
-   **今後の設計課題**:
  - エラー通知方法（メール、Slack等）
  - リトライロジック
  - 失敗したファイルの追跡方法

### 2.8. フロントエンド実装（イベント管理）

#### 操作契機とUX

**主要契機: 予定一覧画面でのワンタップ登録**

ユーザーはモバイルファースト設計のUIで直近の予定を確認し、ワンタップでGoogleカレンダーに登録できます。

**UI設計のポイント**:
- 📅 カードベースのレイアウト（モバイル最適化）
- ✓ 登録済みバッジで視覚的なフィードバック
- 🔄 楽観的UI更新（即座にUIを更新し、バックグラウンドで同期）
- 🔗 カレンダーイベントへの直リンク

**実装例（Next.js + React）**:
```tsx
// app/events/page.tsx
import { UpcomingEvents } from '@/components/UpcomingEvents';

export default function EventsPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">直近の予定</h1>
      <UpcomingEvents />
    </div>
  );
}

// components/UpcomingEvents.tsx
'use client';

import { useUpcomingEvents, useCalendarSync } from '@/hooks/events';

export function UpcomingEvents() {
  const { events, isLoading } = useUpcomingEvents();
  const { addToCalendar, syncedHashes } = useCalendarSync();

  if (isLoading) return <div>読み込み中...</div>;

  return (
    <div className="space-y-4">
      {events.map(event => {
        const isSynced = syncedHashes.has(event.hash);

        return (
          <div key={event.hash} className="border rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-gray-500">
                  {new Date(event.date).toLocaleDateString('ja-JP')} • {event.type}
                </div>
                <div className="font-medium">{event.title}</div>
                <div className="text-xs text-gray-400 mt-1">
                  出典: {event.document_title}
                </div>
              </div>

              {isSynced ? (
                <span className="text-green-600 text-sm">✓ 登録済み</span>
              ) : (
                <button
                  onClick={() => addToCalendar(event)}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  📅 追加
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**APIエンドポイント（Next.js App Router）**:
```typescript
// app/api/calendar/sync/route.ts
import { auth } from '@/auth';
import { calendar_v3, google } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = await req.json();
  const calendar = google.calendar('v3');
  const bigquery = new BigQuery();

  try {
    // 1. Googleカレンダーにイベント作成
    const calendarEvent = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.title,
        description: event.description,
        start: { date: event.date },
        end: { date: event.date },
      },
    });

    // 2. BigQueryに履歴を記録
    await bigquery
      .dataset('school_agent')
      .table('calendar_sync_history')
      .insert([{
        sync_id: crypto.randomUUID(),
        document_id: event.document_id,
        event_type: event.type,
        event_date: event.date,
        event_title: event.title,
        event_description: event.description,
        source_table: event.source_table,
        source_section_title: event.source_section_title,
        calendar_event_id: calendarEvent.data.id!,
        calendar_link: calendarEvent.data.htmlLink!,
        synced_by: session.user.id,
        synced_at: new Date().toISOString(),
        event_hash: event.hash,
      }]);

    return Response.json({
      success: true,
      calendarEventId: calendarEvent.data.id,
      calendarLink: calendarEvent.data.htmlLink
    });
  } catch (error) {
    // ユニーク制約違反（他の家族が既に登録済み）の場合は成功扱い
    if (error.code === 'ALREADY_EXISTS' || error.message?.includes('Duplicate')) {
      return Response.json({
        success: true,
        alreadyRegistered: true,
        message: '他の家族が既に登録済みです'
      });
    }

    console.error('Calendar sync failed:', error);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}
```

#### AIエージェント統合（Mastra）

AIエージェントは`upcoming_events`ビューを検索し、ユーザーに予定を提案できます。

**エージェントアクション例（正規化版）**:
```typescript
// mastra/tools/calendar.ts
import { createTool } from '@mastra/core';

export const listUpcomingEvents = createTool({
  id: 'list-upcoming-events',
  description: '直近の予定を取得する（家族共有、正規化版）',
  execute: async () => {
    // 正規化されたextracted_eventsテーブルから直接取得
    // UNION ALLやUNNESTが不要でシンプル
    const events = await bigquery.query(`
      SELECT * FROM \`project.dataset.upcoming_events\`
      ORDER BY event_date ASC
      LIMIT 10
    `);

    return events;
  }
});

export const syncEventToCalendar = createTool({
  id: 'sync-event-to-calendar',
  description: 'イベントをGoogleカレンダーに登録する',
  execute: async ({ event, userId }) => {
    const response = await fetch('/api/calendar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...event, userId })
    });

    return response.json();
  }
});
```

**使用例**:
```
ユーザー: 「今週の予定は？」

AIエージェント:
「今週の予定は3件あります：

1. 10/15(火) 遠足 - 弁当持参
2. 10/17(木) 健康診断
3. 10/18(金) 写真撮影

これらはまだカレンダーに未登録です。登録しますか？」

ユーザー: 「全部登録して」

AIエージェント: （syncEventToCalendarを3回実行）
「3件すべてをカレンダーに登録しました！」
```
