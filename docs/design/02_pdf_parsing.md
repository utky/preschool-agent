## 2. PDF解析パイプライン

### 設計決定サマリ

| 決定 | 内容 | ADR |
|---|---|---|
| PDF解析エンジン | BigQuery ML.GENERATE_TEXT（Gemini 2.5 Flash） | [ADR-002](../adr/ADR-002-pdf-parsing-bigquery-gemini.md) |
| チャンク識別 | UUID v4、1チャンク=1レコード | [ADR-003](../adr/ADR-003-chunk-uuid-design.md) |
| Thinking無効化 | thinkingBudget: 0（コスト最適化） | [ADR-004](../adr/ADR-004-thinking-budget-disabled.md) |
| PDF取得経路 | WordPress REST APIクローラー → GCS | [ADR-005](../adr/ADR-005-wordpress-crawler.md) |

### 2.1. 解析ワークフロー

```
WordPress REST API
  ↓ Cloud Run Job (crawler/)  [6時間ごと]
GCS: web/{YYYY}/{MM}/{media_id}_{title}.pdf
  ↓ BigQuery Object Table (raw_documents)
stg_pdf_uploads__extracted_texts  ← ML.GENERATE_TEXT (OCR + 構造化)
  ↓
int_document_chunks__chunked      ← チャンク化 + UUID v4生成
  ↓
int_document_chunks__embedded     ← ML.GENERATE_EMBEDDING (768次元)
  ↓
dim_documents                     ← 文書メタデータ（正規化）
fct_document_chunks               ← RAG検索テーブル（メタデータ冗長保存）
  ↓
journal / photo_album / monthly_* ← 文書種別別テーブル
  ↓
fct_events                        ← イベント正規化（全種別から集約）
  ↓
exp_api__documents / exp_api__events  ← Cloud Storage JSON出力 → API
```

### 2.2. データモデル

#### BigQuery: `raw_documents`（Object Table）

```sql
CREATE EXTERNAL TABLE raw_documents
WITH CONNECTION `project-id.region.connection-id`
OPTIONS (
  object_metadata = 'SIMPLE',
  uris = ['gs://school-agent-prod-pdf-uploads/*/*/*.pdf'],
  max_staleness = 0
);
-- 自動カラム: uri, generation, size, md5_hash, updated, content_type
```

#### BigQuery: `documents`

```sql
CREATE TABLE documents (
  document_id   STRING NOT NULL,  -- UUID v4
  source_id     STRING NOT NULL,  -- GCS URI
  file_name     STRING NOT NULL,
  file_size     INT64,
  md5_hash      STRING,
  document_type STRING NOT NULL,  -- journal|photo_album|monthly_announcement|monthly_lunch_schedule|monthly_lunch_info|uncategorized
  title         STRING,
  publish_date  DATE NOT NULL,
  total_chunks  INT64,
  total_pages   INT64,
  total_tokens  INT64,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  updated_at    TIMESTAMP NOT NULL
)
PARTITION BY publish_date
CLUSTER BY document_type
OPTIONS(require_partition_filter=true);
```

#### BigQuery: `document_chunks`

```sql
CREATE TABLE document_chunks (
  chunk_id        STRING NOT NULL,  -- UUID v4
  document_id     STRING NOT NULL,
  chunk_index     INT64 NOT NULL,
  chunk_text      STRING NOT NULL,
  chunk_token_count INT64,
  chunk_embedding ARRAY<FLOAT64>,   -- 768次元
  page_number     INT64,
  section_id      STRING,
  section_title   STRING,
  -- RAG用冗長メタデータ（JOIN不要なフィルタリングのため）
  source_id       STRING NOT NULL,
  file_name       STRING,
  document_type   STRING NOT NULL,
  title           STRING,
  publish_date    DATE NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY publish_date
CLUSTER BY document_type, document_id, chunk_id
OPTIONS(require_partition_filter=true);

CREATE VECTOR INDEX document_chunks_embedding_idx
ON document_chunks(chunk_embedding)
OPTIONS(distance_type='COSINE', index_type='IVF',
        ivf_options='{"num_lists": 1000, "num_probes": 50}');
```

#### BigQuery: `extracted_events`

```sql
CREATE TABLE extracted_events (
  event_id            STRING NOT NULL,  -- UUID v4
  event_type          STRING NOT NULL,  -- deadline|schedule|submission|other
  event_date          DATE NOT NULL,
  event_title         STRING NOT NULL,
  event_description   STRING,
  document_id         STRING NOT NULL,
  source_table        STRING NOT NULL,
  source_section_id   STRING,
  source_section_title STRING,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY event_date
CLUSTER BY event_type, source_table
OPTIONS(require_partition_filter=true);
```

#### BigQuery: `calendar_sync_history`

```sql
CREATE TABLE calendar_sync_history (
  sync_id             STRING NOT NULL,  -- UUID v4
  document_id         STRING NOT NULL,
  event_type          STRING NOT NULL,
  event_date          DATE NOT NULL,
  event_title         STRING NOT NULL,
  event_description   STRING,
  source_table        STRING NOT NULL,
  source_section_title STRING,
  calendar_event_id   STRING NOT NULL,
  calendar_link       STRING,
  synced_by           STRING NOT NULL,
  synced_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  event_hash          STRING NOT NULL   -- MD5(event_type + event_date + event_title)
)
PARTITION BY DATE(event_date)
CLUSTER BY synced_by, event_type;

CREATE UNIQUE INDEX idx_unique_event ON calendar_sync_history(event_hash);
```

#### 文書種別テーブル

| テーブル | 主なカラム |
|---|---|
| `journal` | article_number, japanese_era, weekday, sections(ARRAY\<STRUCT\>), summary, publish_date |
| `photo_album` | author, photo_ids, sections, schedule, announcements, summary, publish_date |
| `monthly_announcement` | year_month, schedule(ARRAY\<STRUCT\>), content_sections, care_goals, summary |
| `monthly_lunch_schedule` | year_month, daily_menus(ARRAY\<STRUCT\> with lunch/snack/nutrition), monthly_avg_with_snack/without_snack |
| `monthly_lunch_info` | year_month, author, content_sections, summary |
| `uncategorized` | classification_confidence, suggested_type, manual_review_notes |

### 2.3. dbtプロジェクト構造

```
dbt/models/
├── staging/
│   ├── _sources.yml
│   └── stg_pdf_uploads__extracted_texts.sql  # ML.GENERATE_TEXT（増分保存）
├── intermediate/
│   ├── int_document_chunks__chunked.sql       # チャンク化 + UUID生成
│   └── int_document_chunks__embedded.sql      # ML.GENERATE_EMBEDDING
├── marts/
│   ├── core/
│   │   ├── dim_documents.sql
│   │   ├── fct_document_chunks.sql
│   │   ├── fct_events.sql
│   │   └── dim_calendar_sync_history.sql
│   └── document_types/
│       ├── journal.sql
│       ├── photo_album.sql
│       ├── monthly_announcement.sql
│       ├── monthly_lunch_schedule.sql
│       ├── monthly_lunch_info.sql
│       └── uncategorized.sql
└── exports/
    ├── exp_api__documents.sql   # → Cloud Storage JSON
    └── exp_api__events.sql      # → Cloud Storage JSON
```

**dbt実行スケジュール**: Cloud Scheduler `0 0,6,12,18 * * *`（6時間間隔）
**増分処理**: `start_datetime`/`end_datetime` 変数でフィルタリング
