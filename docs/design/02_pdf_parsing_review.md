# PDF解析設計レビュー

**レビュー日**: 2025-12-29（2026-01-01更新）
**対象文書**: `docs/design/02_pdf_parsing.md`
**レビュー範囲**: データ論理モデル、BigQueryスキャン最適化
**更新履歴**:
- 2025-12-29: 初版作成
- 2026-01-01: チャンク設計、埋め込み生成タイミング、外部レビュー評価を追加

---

## エグゼクティブサマリー

現在の設計書は高レベルなアーキテクチャとデータフローを定義していますが、以下の点で重大な不足があります：

1. **データの論理モデル**: テーブルスキーマの具体的な定義が欠落
2. **BigQuery物理最適化**: パーティショニング/クラスタリング戦略が未定義
3. **チャンク管理**: 1チャンク=1レコード vs ARRAY<STRUCT>の設計判断が必要
4. **埋め込み生成**: Document AIは埋め込みを生成しない（別ステップが必要）
5. **RAG最適化**: ベクトル検索用メタデータの冗長保存が必要

これらを補完しない限り、実装フェーズに進むことは推奨されません。

---

## 0. 重要な設計決定事項

### 0.1 チャンク設計: 1チャンク = 1レコード（決定）

**結論**: **1チャンク = 1レコード** を採用

**検討したアプローチ**:
- ❌ アプローチA: 1 PDF = 1レコード + chunksカラム（ARRAY<STRUCT>）
- ✅ アプローチB: 1チャンク = 1レコード

**採用理由**:

1. **技術的制約（決定的）**:
   ```
   BigQuery Vector Indexは以下の型のみサポート:
   - ARRAY<FLOAT64>
   - STRUCT<result ARRAY<FLOAT64>, status STRING>

   ARRAY<STRUCT>内のベクトルに対してインデックスを作成できない
   → VECTOR_SEARCH関数が使用不可能
   ```

2. **Google公式ベストプラクティス**:
   [公式RAGチュートリアル](https://docs.cloud.google.com/bigquery/docs/rag-pipeline-pdf)でも1行1チャンク構造を採用

3. **パフォーマンス**:
   - Vector Indexによる高速ANN検索が可能
   - パーティションpruningとクラスタリングの恩恵

**参考資料**:
- [BigQuery Vector Index](https://docs.cloud.google.com/bigquery/docs/vector-index)
- [BigQuery Vector Search](https://docs.cloud.google.com/bigquery/docs/vector-search)

---

### 0.2 埋め込み生成のタイミング

**重要**: Document AIは埋め込み（embedding）を生成しない

**データ変換フロー**:
```
1. GAS: Google Drive → GCS
2. ML.PROCESS_DOCUMENT: テキスト抽出（埋め込みなし）
   → output: document_id, chunk_index, chunk_text
3. ML.GENERATE_EMBEDDING: 埋め込み生成（別ステップ）
   → output: document_id, chunk_index, chunk_text, chunk_embedding
4. 文書種別の分類
5. Vector Index作成
```

**使用するBigQuery関数**:
- `ML.PROCESS_DOCUMENT`: Document AIによるOCR・テキスト抽出
- `ML.GENERATE_EMBEDDING`: Vertex AI Embeddingによるベクトル生成

**埋め込みモデル**:
```sql
-- text-embedding-005モデルを参照
CREATE OR REPLACE MODEL `project.dataset.text_embedding_005`
REMOTE WITH CONNECTION `project.region.vertex_connection`
OPTIONS (
  endpoint = 'text-embedding-005'
);
```

**参考資料**:
- [ML.GENERATE_EMBEDDING](https://cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-generate-embedding)
- [Build a RAG pipeline from PDFs](https://docs.cloud.google.com/bigquery/docs/rag-pipeline-pdf)

---

### 0.3 テキストデータの重複許容

**決定**: 中間テーブルと最終テーブルでのテキスト重複は許容

**理由**:

1. **増分処理の必要性**:
   - `ML.PROCESS_DOCUMENT`は重い処理
   - 中間テーブル（stg_documents_text）を保存することで再実行を回避

2. **ストレージコストは無視できる**:
   ```
   前提: 年間600チャンク、1チャンク2KB
   重複データ: 600 × 2KB = 1.2MB/年
   10年運用: 12MB

   ストレージコスト:
   $0.02/GB/月 × 0.012GB = $0.00024/月 ≈ $0.003/年
   ```

3. **Google公式も同様のアプローチ**:
   公式チュートリアルでも`parsed_pdf`と`embeddings`の両テーブルを保持

**推奨テーブル構成**:
```
stg_documents_text: テキストのみ（増分処理用、保存）
documents: テキスト + 埋め込み（最終テーブル）
```

---

### 0.4 外部レビュー提案の評価

外部レビュアーから以下の提案を受けました：

#### ✅ 採用する提案

**1. documentsテーブルへの冗長メタデータ追加**

**提案**: RAG検索時のJOIN削減のため、`document_type`、`publish_date`、`title`などを各チャンクに冗長に保存

**評価**: **強く採用** ⭐⭐⭐

**理由**:
- RAG検索の典型パターン: 「今月の給食は？」「先週のお知らせは？」
- Vector Search時に`document_type`や`publish_date`でフィルタリングが頻繁
- JOINなしでパーティションpruningとクラスタリングの恩恵を最大化

**適用**:
```sql
CREATE TABLE documents (
  chunk_id STRING NOT NULL,
  document_id STRING NOT NULL,

  -- RAG検索用メタデータ（冗長だが必要）
  document_type STRING NOT NULL,
  title STRING,
  publish_date DATE NOT NULL,

  chunk_text STRING,
  chunk_embedding ARRAY<FLOAT64>,
  ...
)
PARTITION BY publish_date
CLUSTER BY document_type, document_id;
```

**2. チャンク参照のUUID化**

**提案**: `content_chunk_indices: [0, 1, 2]`ではなく、`chunk_ids: [UUID, UUID]`で参照

**評価**: **強く採用** ⭐⭐⭐

**理由**:
- チャンク分割アルゴリズム変更時の整合性リスク回避
- 再処理・バックフィル時のデータ整合性保証
- UUIDによる堅牢な参照

**適用**:
```sql
-- documentsテーブル
chunk_id STRING NOT NULL,  -- UUID（主キー）

-- journalテーブルのsectionsカラム
{
  "sections": [
    {
      "section_id": "sec_001",
      "title": "お知らせ",
      "chunk_ids": [
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440001"
      ]
    }
  ]
}
```

#### ❌ 採用しない提案

**1. 文書タイプ固有テーブルの統合（JSON化）**

**提案**: `journal`、`photo_album`などを廃止し、`documents.specific_metadata JSON`に統合

**評価**: **採用しない** ❌

**理由**:

1. **プロジェクト規模が小さい**:
   - 年間60ファイル、10年で600ファイル
   - このスケールではJOINコストは無視できる

2. **型安全性の喪失**:
   ```sql
   -- ❌ JSON（型チェックなし）
   JSON_EXTRACT_SCALAR(specific_metadata, '$.article_number')

   -- ✅ 専用テーブル（型安全）
   SELECT article_number FROM journal
   ```

3. **dbtでのスキーマ管理が困難**:
   - JSONの内部構造をどうテストするか
   - スキーマ変更の追跡が困難

4. **クエリの可読性低下**:
   ```sql
   -- ❌ JSON（複雑）
   SELECT JSON_EXTRACT(specific_metadata, '$.menu_items')

   -- ✅ 専用テーブル（シンプル）
   SELECT menu_items FROM monthly_lunch_schedule
   ```

5. **文書タイプごとに構造が大きく異なる**:
   - journal: セクション構造、記事番号
   - photo_album: 写真ID配列、保育内容表
   - monthly_lunch_schedule: 献立JSON、栄養価
   - これらを1つのJSONに押し込むのは設計として不適切

**レビュアーの提案が適用される状況**:
- 大規模システム（数百万〜数億レコード）
- 小規模プロジェクトでは型安全性・可読性・保守性を優先すべき

---

## 1. データの論理モデル

### 🔴 重大な問題

#### 1.1 スキーマ定義が欠落

**現状**: テーブル名のみ記載され、カラム定義がない
**影響**: 実装不可能、データ整合性の保証なし
**優先度**: 最高

**必要なアクション**:
全テーブルの完全なスキーマ定義が必要です。以下に推奨スキーマを示します。

##### `documents` テーブル（RAG検索用チャンクテーブル）

**設計方針**:
- 1チャンク = 1レコード
- RAG検索最適化のため、文書メタデータを冗長に保存
- UUIDによるチャンク識別

```sql
CREATE TABLE documents (
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
CREATE VECTOR INDEX documents_embedding_idx
ON documents(chunk_embedding)
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

##### `document_metadata` テーブル（文書単位のメタデータ）

**設計方針**:
- 1 PDF = 1レコード
- documentsテーブルのメタデータ重複を最小化するための正規化テーブル
- documentsテーブルには検索に必要な最小限のメタデータのみ保存

```sql
CREATE TABLE document_metadata (
  -- 主キー
  document_id STRING NOT NULL,           -- 文書の一意ID（documentsへの参照）

  -- ソース情報
  source_id STRING NOT NULL,             -- raw_documentsへの参照（GCS URI）
  file_name STRING NOT NULL,             -- 元のファイル名
  file_size INT64,                       -- ファイルサイズ（バイト）
  md5_hash STRING,                       -- ファイルのMD5ハッシュ

  -- 文書情報
  document_type STRING NOT NULL,         -- journal, photo_album, etc.
  title STRING,                          -- 文書タイトル
  publish_date DATE NOT NULL,            -- 発行日

  -- 処理統計
  total_chunks INT64,                    -- チャンク総数
  total_pages INT64,                     -- ページ総数
  total_tokens INT64,                    -- トークン総数

  -- 処理状態
  processing_status STRING NOT NULL DEFAULT 'PENDING',
  error_message STRING,
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

**documentsテーブルとの関係**:
- `documents`: チャンク単位、RAG検索用（冗長メタデータあり）
- `document_metadata`: 文書単位、マスターデータ（重複なし）
- アプリケーション層では主にdocumentsを使用し、詳細情報が必要な場合のみJOIN

---

##### `photos` テーブル（写真データ）

**現状**: 要件に記載されているが設計書に欠落
**要件文書**: "PDFに含まれる写真は個別にCloud Storageに非構造化データとして保存する"

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

##### `pending_events` テーブル（承認待ちイベント）

**現状**: 要件に記載されているが設計書に欠落
**要件文書**: "解析結果として保存したデータに予定や期限に関するものがあれば承認待ちリストにいれる"

```sql
CREATE TABLE pending_events (
  -- 主キー
  event_id STRING NOT NULL,              -- イベントの一意ID（UUID推奨）

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

##### `journal` テーブル（日誌）

**現状**: テーブル名のみ記載
**要件**: 記事番号、セクション構造を持つ
**更新**: チャンク参照をUUID化

```sql
CREATE TABLE journal (
  -- 主キー
  document_id STRING NOT NULL,           -- documentsへの参照（1:1）

  -- 日誌固有の情報
  article_number STRING,                 -- 記事番号（例: "No.123"）
  japanese_era STRING,                   -- 和暦（例: "令和7年"）
  weekday STRING,                        -- 曜日

  -- 構造化データ
  sections JSON,                         -- セクション情報（UUID参照）
                                         -- [{
                                         --   section_id: "sec_001",
                                         --   title: "お知らせ",
                                         --   chunk_ids: ["550e8400-...", "550e8400-..."]
                                         -- }, ...]
  extracted_events JSON,                 -- 抽出されたイベント情報
                                         -- [{type: "deadline", date: "2025-01-15", title: "..."}, ...]

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
  description='日誌（journal）の構造化メタデータ',
  require_partition_filter=true
);
```

##### `photo_album` テーブル（写真アルバム）

```sql
CREATE TABLE photo_album (
  -- 主キー
  document_id STRING NOT NULL,           -- documentsへの参照（1:1）

  -- アルバム固有の情報
  author STRING,                         -- 執筆者
  japanese_era STRING,                   -- 和暦
  school_name STRING,                    -- 園名

  -- 構造化データ
  photo_ids ARRAY<STRING>,               -- photosテーブルへの参照配列
  photo_count INT64,                     -- 写真の数
  care_content_table JSON,               -- 保育内容表
                                         -- {items: [{activity: "外遊び", date: "2025-01-10"}, ...]}

  -- AI生成サマリ
  summary STRING,                        -- LLMで生成した要約

  -- タイムスタンプ
  publish_date DATE,                     -- 発行日
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_at)
OPTIONS(
  description='写真アルバムの構造化メタデータ'
);
```

##### `monthly_announcement` テーブル（月次お知らせ）

```sql
CREATE TABLE monthly_announcement (
  -- 主キー
  document_id STRING NOT NULL,           -- documentsへの参照（1:1）

  -- 月次お知らせ固有の情報
  year_month DATE NOT NULL,              -- 対象月度（月初日で統一）

  -- 構造化データ
  introduction_text STRING,              -- 序文
  schedule JSON,                         -- スケジュール
                                         -- [{date: "2025-01-15", event: "遠足"}, ...]
  star_sections JSON,                    -- "★"で始まるセクション
                                         -- [{title: "持ち物について", content_chunks: [5,6]}, ...]
  care_goals JSON,                       -- 月度の保育目標
                                         -- {age_groups: [{age: "3歳児", goal: "..."}, ...]}

  extracted_events JSON,                 -- 抽出されたイベント情報

  -- AI生成サマリ
  summary STRING,                        -- LLMで生成した要約

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY year_month
OPTIONS(
  description='月次お知らせの構造化メタデータ',
  require_partition_filter=true
);
```

##### `monthly_lunch_schedule` テーブル（月次給食献立）

```sql
CREATE TABLE monthly_lunch_schedule (
  -- 主キー
  document_id STRING NOT NULL,           -- documentsへの参照（1:1）

  -- 給食献立固有の情報
  year_month DATE NOT NULL,              -- 対象月度（月初日で統一）
  school_name STRING,                    -- 園名

  -- 構造化データ
  menu_items JSON NOT NULL,              -- 日ごとの献立データ
                                         -- [{date: "2025-01-15", main: "カレーライス",
                                         --   side: "サラダ", soup: "味噌汁", dessert: "果物"}, ...]
  nutrition_info JSON,                   -- 平均栄養価
                                         -- {calories: 450, protein: 18.5, fat: 12.3,
                                         --  carbs: 65.2, salt: 1.8}

  -- AI生成サマリ
  summary STRING,                        -- LLMで生成した要約

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY year_month
OPTIONS(
  description='月次給食献立の構造化メタデータ',
  require_partition_filter=true
);
```

##### `monthly_lunch_info` テーブル（月次給食お知らせ）

```sql
CREATE TABLE monthly_lunch_info (
  -- 主キー
  document_id STRING NOT NULL,           -- documentsへの参照（1:1）

  -- 給食お知らせ固有の情報
  year_month DATE NOT NULL,              -- 対象月度（月初日で統一）
  author STRING,                         -- 執筆者

  -- 構造化データ
  introduction_text STRING,              -- 序文
  content_sections JSON,                 -- コンテンツ（複数セクション）
                                         -- [{title: "今月のテーマ", content_chunks: [0,1]}, ...]

  -- AI生成サマリ
  summary STRING,                        -- LLMで生成した要約

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY year_month
OPTIONS(
  description='月次給食お知らせの構造化メタデータ',
  require_partition_filter=true
);
```

##### `uncategorized` テーブル（未分類文書）

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

##### `raw_documents` テーブル（BigQuery Object Table）

**現状**: 名前のみ記載
**BigQuery Object Tableの仕様**: https://cloud.google.com/bigquery/docs/object-table-introduction

```sql
CREATE EXTERNAL TABLE raw_documents
WITH CONNECTION `project-id.region.connection-id`
OPTIONS (
  object_metadata = 'SIMPLE',
  uris = ['gs://school-agent-prod-pdf-uploads/*/*/*.pdf'],
  max_staleness = INTERVAL 1 HOUR,
  metadata_cache_mode = 'MANUAL'
);

-- オブジェクトテーブルの自動生成カラム:
-- - uri: STRING (gs://... のフルパス)
-- - generation: INT64
-- - size: INT64 (バイト)
-- - md5_hash: STRING
-- - updated: TIMESTAMP
-- - content_type: STRING
```

---

#### 1.2 チャンク管理の設計（決定済み）

**決定**: UUID v4による一意チャンク識別

**データ構造**:
```
- 1 PDF = 1 document_id (UUID v4)
- 1 PDF = N chunks (N >= 1)
- チャンクの識別: chunk_id (UUID v4)
- 順序の追跡: chunk_index (INT64)
```

**テーブル間のリレーション**:
```
documents (チャンク単位、RAG検索用)
  ├─ PRIMARY KEY: chunk_id (UUID v4)
  ├─ FOREIGN KEY: document_id -> document_metadata.document_id
  ├─ chunk_index: チャンク順序（参考用、0始まり）

document_metadata (文書単位のメタデータ)
  ├─ PRIMARY KEY: document_id (UUID v4)
  ├─ FOREIGN KEY: source_id -> raw_documents.uri

journal (文書種別固有のメタデータ)
  ├─ PRIMARY KEY: document_id
  ├─ sections.chunk_ids: ARRAY<STRING> (UUID参照)

photos (文書の関連データ)
  ├─ PRIMARY KEY: photo_id (UUID v4)
  ├─ FOREIGN KEY: document_id -> document_metadata.document_id
```

**UUID採用の理由**:
1. **チャンク分割アルゴリズム変更に堅牢**: chunk_indexは変わってもchunk_idは不変
2. **分散生成可能**: 並列処理やバッチ処理で衝突なし
3. **再処理時の整合性保証**: 同じPDFを再処理してもchunk_idで同一チャンクを識別
4. **外部レビュー提案の採用**: chunk_indices配列ではなくchunk_ids配列で参照

**チャンク戦略の推奨**:
```python
# Document AIの処理後のチャンク化ロジック（疑似コード）
import uuid

chunk_size = 512  # トークン数
chunk_overlap = 50  # オーバーラップトークン数

# 戦略1: ページ境界を尊重するチャンク（推奨）
for page in document.pages:
    if page.token_count <= chunk_size:
        chunk_id = str(uuid.uuid4())
        chunk_index = len(chunks)
        section_id = extract_section_id(page)
        chunks.append({
            'chunk_id': chunk_id,
            'chunk_index': chunk_index,
            'section_id': section_id,
            'text': page.text
        })
    else:
        # ページを複数チャンクに分割
        sub_chunks = split_with_overlap(page.text, chunk_size, chunk_overlap)
        for sub_chunk in sub_chunks:
            chunk_id = str(uuid.uuid4())
            chunk_index = len(chunks)
            section_id = extract_section_id(page)
            chunks.append({
                'chunk_id': chunk_id,
                'chunk_index': chunk_index,
                'section_id': section_id,
                'text': sub_chunk
            })

# 戦略2: 意味的なチャンク（セクション境界を尊重）
# - Document AIのレイアウト解析結果を利用
# - 見出し・段落単位でチャンク

# 戦略3: 固定サイズチャンク + オーバーラップ
# - LangChainのRecursiveCharacterTextSplitterを使用
```

**UUID生成のベストプラクティス**:
```python
import uuid

# ✅ UUID v4（ランダム）
chunk_id = str(uuid.uuid4())  # 例: "550e8400-e29b-41d4-a716-446655440000"

# ❌ UUID v5（名前ベース）は避ける
# 理由: チャンク分割アルゴリズム変更時に同じUUIDが生成される可能性
```

---

#### 1.3 要件で言及されているが設計に欠落しているもの

**a) 写真の管理**

- **要件箇所**: requirements.md:32 "PDFに含まれる写真は個別にCloud Storageに非構造化データとして保存する"
- **現状**: 設計書に記載なし
- **提案**: 上記 `photos` テーブルを追加

**b) 承認待ちリスト**

- **要件箇所**: requirements.md:33 "解析結果として保存したデータに予定や期限に関するものがあれば承認待ちリストにいれる"
- **現状**: 設計書に記載なし
- **提案**: 上記 `pending_events` テーブルを追加

**c) カレンダー連携の状態管理**

- **要件箇所**: requirements.md:34 "予定の承認が得られればGoogleカレンダーに登録する"
- **現状**: 設計書に記載なし
- **提案**: `pending_events.calendar_event_id`, `calendar_synced_at` カラムで管理

---

#### 1.4 文書種別テーブルの役割が不明確

**現状**: "メタデータとサマリを最適な構造で保管" とあるが具体例なし
**影響**: 実装時に各テーブルの責務が不明確
**優先度**: 中

**設計ポリシーの明確化**:

```
原則:
1. documents テーブル = テキストデータの唯一の保存場所
2. 文書種別テーブル = 構造化されたメタデータとサマリのみ
3. 文書種別テーブルは documents.document_id で参照（1:1リレーション）

役割分担:
- documents: 生のテキスト + ベクトル検索用
- journal: 記事番号、セクション構造、イベント抽出結果
- monthly_lunch_schedule: 献立の構造化JSON、栄養価データ
- photo_album: 写真IDの配列、保育内容表
```

**具体例（journal の場合）**:
```json
// journalテーブルの sections カラムの例（UUID参照に更新）
{
  "sections": [
    {
      "section_id": "sec_001",
      "title": "今週のお知らせ",
      "chunk_ids": [
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440001"
      ],
      "order": 1
    },
    {
      "section_id": "sec_002",
      "title": "提出物について",
      "chunk_ids": [
        "550e8400-e29b-41d4-a716-446655440002"
      ],
      "order": 2,
      "deadline": "2025-01-20"
    }
  ]
}

// journalテーブルの extracted_events カラムの例
{
  "events": [
    {
      "type": "deadline",
      "date": "2025-01-20",
      "title": "健康診断問診票の提出",
      "source_section_id": "sec_002",
      "source_section_title": "提出物について"
    },
    {
      "type": "schedule",
      "date": "2025-01-25",
      "title": "避難訓練",
      "source_section_id": "sec_001",
      "source_section_title": "今週のお知らせ"
    }
  ]
}
```

---

### 🟡 改善が望ましい点

#### 1.5 データ型の選択

**推奨事項**:
```sql
-- 日付型の使い分け
DATE        -- publish_date, event_date, year_month (月度は月初日で統一)
TIME        -- event_time (時刻のみ)
TIMESTAMP   -- created_at, updated_at, approved_at (タイムゾーン付き)

-- ID型の選択
STRING      -- UUID v4 推奨（例: "550e8400-e29b-41d4-a716-446655440000"）
            -- 理由: 分散生成可能、衝突リスク極小、可読性

-- JSON vs ARRAY vs STRING
JSON        -- 構造化データ（sections, menu_items, nutrition_info）
ARRAY       -- 単純なリスト（photo_ids, keywords）
STRING      -- 非構造化テキスト（summary, description）
```

#### 1.6 NULL制約とデフォルト値

**推奨事項**:
```sql
-- 必須フィールド
NOT NULL DEFAULT CURRENT_TIMESTAMP()  -- タイムスタンプ
NOT NULL DEFAULT 'PENDING'            -- ステータス

-- オプショナルフィールド（NULLを許容）
NULL  -- event_time, event_location, caption
      -- 理由: データソースによっては存在しない

-- 注意: require_partition_filter オプション
-- event_date が NULL の可能性がある場合は false に設定
```

---

## 2. BigQuery 物理最適化

### 🔴 重大な問題

#### 2.1 パーティショニング戦略が不明

**現状**: `raw_documents` のGCS側パーティショニングのみ言及
**影響**: スキャン量が最適化されず、コストと速度に直接影響
**優先度**: 最高

**問題点**:
- BigQueryテーブル自体のパーティショニングが未定義
- パーティションフィルタの必須化（`require_partition_filter`）が未検討

**クエリパターンから逆算した推奨設計**:

想定されるクエリパターン（requirements.mdから抽出）:
1. "直近1週間のお知らせは？" → publish_date 範囲検索
2. "今月の給食献立は？" → document_type + year_month 範囲検索
3. "提出期限が近いものは？" → event_date 範囲検索
4. "この写真はどの文書？" → document_id 完全一致検索

**推奨パーティショニング戦略**:

```sql
-- documents: publish_date でパーティション
PARTITION BY DATE(publish_date)
CLUSTER BY document_type, document_id
-- 理由:
--   - ユーザーは「最近の文書」を頻繁に検索
--   - publish_dateでフィルタすることでスキャン量を大幅削減
--   - 文書種別での絞り込みも頻繁（クラスタリングで対応）

-- pending_events: event_date でパーティション
PARTITION BY DATE(event_date)
CLUSTER BY approval_status, event_type
-- 理由:
--   - 「今後1ヶ月の予定」「今週の提出物」などの検索が主用途
--   - approval_status='PENDING' でのフィルタが最頻出

-- journal: publish_date でパーティション
PARTITION BY publish_date
CLUSTER BY article_number
-- 理由:
--   - 日誌は発行日での検索が主

-- monthly_*: year_month でパーティション
PARTITION BY year_month
-- 理由:
--   - 月次文書は月度での検索が主
--   - 「今月の献立」「先月のお知らせ」など

-- photos: extracted_at でパーティション
PARTITION BY DATE(extracted_at)
CLUSTER BY document_id
-- 理由:
--   - 新着写真の一覧表示
--   - 特定文書の写真検索（クラスタリングで対応）

-- uncategorized: created_at でパーティション
PARTITION BY DATE(created_at)
-- 理由:
--   - 最近の未分類文書を確認する用途
```

**パーティション数の見積もり**:
```
前提: 月4-5ファイル、年間60ファイル、10年運用

documents:
  - DAYパーティション × 10年 = 約3,650パーティション
  - 上限10,000パーティションに対して余裕あり

monthly_*:
  - MONTHパーティション × 10年 = 120パーティション
  - 問題なし
```

**require_partition_filter の設定**:
```sql
-- 有効化推奨（フィルタ忘れによる全スキャンを防止）
OPTIONS(
  require_partition_filter=true
)

-- 例外: event_date が NULL になりうる pending_events
OPTIONS(
  require_partition_filter=false
)
```

---

#### 2.2 増分処理の実装が不明確

**現状**: "直前1時間の新着のみを取り出せるようにする" と記載
**影響**: 増分処理の実装方法が不明、冪等性の保証が不明
**優先度**: 高

**問題点**:
- GCS側のタイムスタンプフォルダで実現できるが、BigQuery側の実装が不明
- dbtでのincremental materializationの戦略が未定義
- バックフィル（過去データの再処理）の方法が不明

**推奨実装（dbt）**:

```sql
-- models/staging/stg_documents.sql
{{ config(
    materialized='incremental',
    unique_key=['document_id', 'chunk_index'],
    partition_by={
      "field": "publish_date",
      "data_type": "date",
      "granularity": "day"
    },
    cluster_by=["document_type", "document_id"],
    incremental_strategy='merge'
) }}

WITH source_data AS (
  SELECT
    -- Document AI の ML.PROCESS_DOCUMENT 結果
    uri,
    ml_process_document.text AS extracted_text,
    ml_process_document.pages,
    -- メタデータ抽出
    REGEXP_EXTRACT(uri, r'/([^/]+)\.pdf$') AS file_name,
    PARSE_TIMESTAMP('%Y-%m-%d/%H', REGEXP_EXTRACT(uri, r'/(\d{4}-\d{2}-\d{2}/\d{2})/')) AS file_timestamp
  FROM {{ source('raw', 'raw_documents') }}
  CROSS JOIN UNNEST(ML.PROCESS_DOCUMENT(
    uri,
    'projects/PROJECT_ID/locations/LOCATION/processors/PROCESSOR_ID'
  )) AS ml_process_document
  {% if is_incremental() %}
    -- 増分: 前回実行以降の新着のみ
    WHERE file_timestamp > (SELECT MAX(created_at) FROM {{ this }})
  {% endif %}
),
chunked_data AS (
  -- チャンク化ロジック（ML.GENERATE_TEXT_EMBEDDING の前処理）
  SELECT
    GENERATE_UUID() AS document_id,
    chunk_index,
    chunk_text,
    -- その他のカラム
  FROM source_data
  -- チャンク化関数（カスタムUDFまたはJavaScript UDF）
)
SELECT * FROM chunked_data;
```

**冪等性の保証**:
```sql
-- 同じファイルが再処理されても重複しないように
unique_key=['document_id', 'chunk_index']
incremental_strategy='merge'  -- UPSERTとして動作

-- または source_id（GCS URI）をハッシュ化してdocument_idとする
CONCAT(
  'doc_',
  TO_HEX(MD5(uri))
) AS document_id
```

**バックフィルの方法**:
```bash
# 特定期間の再処理
dbt run --models stg_documents --vars '{"is_incremental": false, "start_date": "2025-01-01", "end_date": "2025-01-31"}'

# 全データの再処理
dbt run --models stg_documents --full-refresh
```

---

#### 2.3 ベクトル検索の最適化が不明確

**現状**: "埋め込みベクトルと検索用ベクトルインデックス" と記載
**影響**: ベクトル検索のパフォーマンスとコストが不明
**優先度**: 高

**問題点**:
- Vector Indexの種類（IVF, TREE-AH）が未選択
- 距離メトリクス（COSINE, EUCLIDEAN, DOT_PRODUCT）が未選択
- インデックスの更新戦略が不明

**BigQuery Vector Search の推奨設計**:

```sql
-- ステップ1: ベクトルインデックスの作成
CREATE VECTOR INDEX documents_embedding_idx
ON documents(chunk_embedding)
OPTIONS(
  distance_type = 'COSINE',           -- コサイン類似度（推奨）
  index_type = 'IVF',                 -- Inverted File Index（バランス型）
  ivf_options = '{
    "num_lists": 1000,                -- データ量に応じて調整
    "num_probes": 50                  -- 検索精度とスピードのトレードオフ
  }'
);

-- または高精度が必要な場合
CREATE VECTOR INDEX documents_embedding_idx_high_accuracy
ON documents(chunk_embedding)
OPTIONS(
  distance_type = 'COSINE',
  index_type = 'TREE-AH',             -- Tree-based ANN（高精度）
  tree_ah_options = '{
    "max_leaf_size": 1000
  }'
);
```

**検索クエリの最適化（UUID版）**:

```sql
-- ベクトル検索 + フィルタリング + パーティション pruning
WITH query_embedding AS (
  -- Vertex AI Embedding API を使用
  SELECT embedding
  FROM ML.GENERATE_TEXT_EMBEDDING(
    MODEL `project.dataset.text_embedding_005`,
    (SELECT '今月の給食献立は？' AS content),
    STRUCT('RETRIEVAL_QUERY' AS task_type)
  )
)
SELECT
  d.chunk_id,
  d.document_id,
  d.title,
  d.section_title,                       -- セクション情報も取得
  d.chunk_text,
  vs.distance
FROM VECTOR_SEARCH(
  TABLE documents,
  'chunk_embedding',
  (SELECT embedding FROM query_embedding),
  top_k => 10,
  distance_type => 'COSINE'
) AS vs
JOIN documents AS d
  ON vs.chunk_id = d.chunk_id              -- UUID参照
WHERE
  -- パーティション pruning（スキャン量削減）
  d.publish_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  -- 文書種別フィルタ（クラスタリング効果）
  AND d.document_type IN ('monthly_lunch_schedule', 'monthly_lunch_info')
  -- 処理済みのみ
  AND d.processing_status = 'COMPLETED'
ORDER BY vs.distance ASC
LIMIT 10;

-- オプション: 文書メタデータの詳細が必要な場合のみJOIN
SELECT
  d.chunk_id,
  d.chunk_text,
  d.section_title,
  dm.file_name,
  dm.total_pages,
  vs.distance
FROM VECTOR_SEARCH(...) AS vs
JOIN documents AS d ON vs.chunk_id = d.chunk_id
LEFT JOIN document_metadata AS dm ON d.document_id = dm.document_id
WHERE ...;
```

**インデックス更新戦略**:
```
- 自動更新: デフォルトで有効（新しいデータが挿入されると自動的にインデックスに追加）
- 手動再構築: データの大部分が変更された場合
  DROP VECTOR INDEX documents_embedding_idx ON documents;
  CREATE VECTOR INDEX documents_embedding_idx ON documents(...);
```

**コスト見積もり**:
```
前提: 300チャンク/年、768次元埋め込み

ストレージコスト:
- ベクトルデータ: 300 × 768 × 8 bytes = 1.8MB/年
- インデックス: 約3-5倍 = 5-9MB/年
- 合計: ~10MB/年 → $0.02/月

検索コスト:
- 1回のベクトル検索: 約1GB スキャン（インデックス利用時）
- 30回/月 × $6.25/TB = $0.19/月
```

---

### 🟡 改善が望ましい点

#### 2.4 クラスタリング戦略の最適化

**現状**: クラスタリングの記載なし
**影響**: フィルタクエリのパフォーマンス低下
**優先度**: 中

**クラスタリングの原則**:
```
1. カーディナリティの順序: 高 → 低
   - 理由: 低カーディナリティを先にすると効果が薄い

2. フィルタ頻度の順序: 高 → 低
   - 理由: 頻繁にフィルタされるカラムを優先

3. 最大4カラムまで
   - 理由: BigQueryの制限
```

**推奨クラスタリング順序**:

```sql
-- documents テーブル
CLUSTER BY document_type, document_id
-- 理由:
--   1. document_type (低カーディナリティ: 6種類) - 頻繁にフィルタ
--   2. document_id (高カーディナリティ: 数千) - 特定文書の取得

-- pending_events テーブル
CLUSTER BY approval_status, event_type, event_date
-- 理由:
--   1. approval_status (最低カーディナリティ: 3種類) - 最頻出フィルタ
--      ※ただし PENDING の取得が圧倒的に多いため例外的に許容
--   2. event_type (低カーディナリティ: 4-5種類) - 頻繁にフィルタ
--   3. event_date (高カーディナリティ) - ソートに利用

-- photos テーブル
CLUSTER BY document_id
-- 理由:
--   - 特定文書の写真を取得する用途がほとんど
```

**クラスタリング効果の測定**:
```sql
-- クエリ実行前にドライランで確認
-- BigQueryコンソールのクエリバリデータで "Bytes processed" を確認

-- クラスタリングなし
SELECT * FROM documents
WHERE document_type = 'journal';
-- 想定スキャン量: 全テーブル（例: 100MB）

-- クラスタリングあり
SELECT * FROM documents
WHERE document_type = 'journal';
-- 想定スキャン量: journal のみ（例: 15MB）
-- 削減率: 85%
```

---

#### 2.5 スキャン量削減のベストプラクティス

**推奨事項**:

```sql
-- ❌ 悪い例1: SELECT *（不要なカラムもスキャン）
SELECT *
FROM documents
WHERE document_type = 'journal';

-- ✅ 良い例1: 必要なカラムのみ
SELECT
  document_id,
  title,
  chunk_text
FROM documents
WHERE document_type = 'journal';
-- 効果: スキャン量を50-70%削減（カラム数による）

-- ❌ 悪い例2: パーティションフィルタなし
SELECT * FROM documents
WHERE document_type = 'journal'
AND EXTRACT(YEAR FROM publish_date) = 2025;

-- ✅ 良い例2: パーティションフィルタあり
SELECT
  document_id,
  title,
  chunk_text
FROM documents
WHERE document_type = 'journal'
AND publish_date BETWEEN '2025-01-01' AND '2025-12-31';
-- 効果: パーティション pruning により、2025年のパーティションのみスキャン

-- ❌ 悪い例3: 関数適用後のフィルタ
SELECT * FROM documents
WHERE LOWER(document_type) = 'journal';

-- ✅ 良い例3: 直接フィルタ
SELECT * FROM documents
WHERE document_type = 'journal';
-- 効果: クラスタリング効果が有効になる

-- ❌ 悪い例4: 複数テーブルの非効率なJOIN
SELECT d.*, j.*
FROM documents d
JOIN journal j ON d.document_id = j.document_id
WHERE d.publish_date >= '2025-01-01';

-- ✅ 良い例4: 効率的なJOIN（小さいテーブルを右側に）
SELECT
  d.document_id,
  d.chunk_text,
  j.article_number,
  j.summary
FROM documents d
JOIN journal j ON d.document_id = j.document_id
WHERE
  d.publish_date >= '2025-01-01'
  AND d.document_type = 'journal'
  AND d.processing_status = 'COMPLETED';
-- 効果: パーティション pruning + クラスタリング + カラム選択
```

---

#### 2.6 コスト最適化のための設計ポリシー

**推奨ポリシー**:

1. **パーティションフィルタを必須化**
```sql
OPTIONS(
  require_partition_filter=true
)
-- 効果: フィルタ忘れによる全スキャンを防止
```

2. **頻繁にアクセスされるデータのマテリアライゼーション**
```sql
-- 例: 承認待ちイベントの集計（頻繁にクエリされる）
CREATE MATERIALIZED VIEW pending_events_summary
PARTITION BY event_date
CLUSTER BY event_type
AS
SELECT
  event_type,
  event_date,
  COUNT(*) AS pending_count,
  ARRAY_AGG(STRUCT(event_id, event_title) ORDER BY event_date LIMIT 10) AS top_events
FROM pending_events
WHERE approval_status = 'PENDING'
GROUP BY event_type, event_date;

-- 効果:
--   - 集計クエリのスキャン量削減
--   - クエリレスポンス時間の短縮
--   - コスト: マテリアライズドビューの自動更新コスト < 元のクエリコスト
```

3. **高コストクエリのキャッシュ活用**
```sql
-- BigQueryはデフォルトで24時間クエリ結果をキャッシュ
-- 同じクエリは無料で結果取得可能

-- キャッシュを無効化したい場合（開発時）
SELECT * FROM documents
WHERE document_type = 'journal'
OPTIONS(use_query_cache=false);
```

4. **データ保持ポリシー（将来的に）**
```sql
-- 古いデータの削除（例: 10年以上前のデータ）
ALTER TABLE documents
SET OPTIONS(
  partition_expiration_days=3650  -- 10年
);

-- または手動削除
DELETE FROM documents
WHERE publish_date < DATE_SUB(CURRENT_DATE(), INTERVAL 10 YEAR);
-- 注意: DELETEもスキャンコストが発生するため、パーティション単位で削除推奨
```

5. **スロット利用の監視**
```sql
-- INFORMATION_SCHEMAでスロット利用を監視
SELECT
  project_id,
  user_email,
  job_id,
  creation_time,
  total_bytes_processed / POW(10, 9) AS gb_scanned,
  total_slot_ms / 1000 AS slot_seconds,
  ROUND(total_slot_ms / 1000 /
    TIMESTAMP_DIFF(end_time, start_time, SECOND), 2) AS avg_slots
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
ORDER BY total_bytes_processed DESC
LIMIT 100;
```

---

## 3. その他の推奨事項

### 3.1 データモデルのドキュメント化

**必要なドキュメント**:

1. **ER図（Entity-Relationship Diagram）**
```
推奨ツール: dbdiagram.io, Mermaid, draw.io

内容:
- 全テーブルのリレーション
- カーディナリティ（1:1, 1:N, N:M）
- 外部キー制約（論理的な）
```

2. **データフロー図**
```
GAS (Google Drive監視)
  ↓
GCS (gs://bucket/${date}/${hour}/${file}.pdf)
  ↓
BigQuery raw_documents (Object Table)
  ↓
dbt staging (stg_documents) + ML.PROCESS_DOCUMENT
  ↓
dbt intermediate (チャンク化、埋め込み生成)
  ↓
dbt marts (documents, photos, 各種別テーブル)
  ↓
Mastra Agent (RAG) + Frontend (Next.js)
```

3. **サンプルクエリ集**
```sql
-- ユースケース1: 直近1週間のお知らせ検索
-- ユースケース2: 今月の給食献立取得
-- ユースケース3: 承認待ちイベント一覧
-- ユースケース4: ベクトル検索（RAG）
-- ユースケース5: 特定文書の写真取得
```

---

### 3.2 dbtプロジェクト構造（更新版）

**推奨ディレクトリ構造**:

```
dbt_project/
├── dbt_project.yml
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
│   │   │   ├── documents.sql         # テキスト + 埋め込み + 冗長メタデータ
│   │   │   ├── document_metadata.sql # 文書単位のメタデータ（正規化）
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
documents (テキスト + 埋め込み + 冗長メタデータ)
document_metadata (文書単位のメタデータ、正規化)
  ↓
journal, photo_album, etc. (UUID参照)
```

**主要モデルの説明**:

1. `stg_documents_text.sql`:
   - ML.PROCESS_DOCUMENTでテキスト抽出
   - **増分処理用に保存**（materializ ed='incremental'）
   - Document AIの重い処理を再実行しないため

2. `int_document_chunks.sql`:
   - チャンク化ロジック
   - UUID v4生成（`GENERATE_UUID()`）
   - section_id, section_titleの抽出

3. `int_document_embeddings.sql`:
   - ML.GENERATE_EMBEDDINGで埋め込み生成
   - ephemeralまたはincremental（戦略による）

4. `documents.sql`:
   - 最終テーブル（RAG検索用）
   - チャンク単位、冗長メタデータあり
   - Vector Index作成

5. `document_metadata.sql`:
   - 文書単位のメタデータ（正規化）
   - 1 PDF = 1レコード

---

### 3.3 テストとバリデーション

**推奨テスト（UUID版）**:

```yaml
# models/marts/core/_core.yml
version: 2

models:
  - name: documents
    description: "RAG検索用のチャンクテーブル（メタデータ冗長保存）"
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns:
            - chunk_id
    columns:
      - name: chunk_id
        description: "チャンクの一意ID（UUID v4）"
        tests:
          - not_null
          - unique
          - dbt_utils.expression_is_true:
              expression: "LENGTH(chunk_id) = 36"  # UUID形式チェック

      - name: document_id
        description: "文書の一意ID（UUID v4）"
        tests:
          - not_null
          - relationships:
              to: ref('document_metadata')
              field: document_id

      - name: chunk_index
        description: "チャンク順序"
        tests:
          - not_null
          - dbt_utils.sequential_values:
              group_by_columns: ['document_id']
              interval: 1

      - name: document_type
        description: "文書種別"
        tests:
          - not_null
          - accepted_values:
              values: ['journal', 'photo_album', 'monthly_announcement',
                       'monthly_lunch_schedule', 'monthly_lunch_info', 'uncategorized']

      - name: publish_date
        description: "発行日"
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= '2020-01-01'"  # 合理的な範囲

      - name: chunk_embedding
        description: "ベクトル埋め込み"
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: "ARRAY_LENGTH(chunk_embedding) = 768"  # 次元数チェック

  - name: document_metadata
    description: "文書単位のメタデータ（正規化テーブル）"
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns:
            - document_id
    columns:
      - name: document_id
        tests:
          - not_null
          - unique

  - name: pending_events
    description: "承認待ちイベント"
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns:
            - event_id
    columns:
      - name: approval_status
        tests:
          - accepted_values:
              values: ['PENDING', 'APPROVED', 'REJECTED']
```

**カスタムテスト**:
```sql
-- tests/assert_no_duplicate_chunk_ids.sql
-- chunk_idの重複がないことを確認
SELECT
  chunk_id,
  COUNT(*) AS count
FROM {{ ref('documents') }}
GROUP BY chunk_id
HAVING COUNT(*) > 1;

-- tests/assert_no_orphaned_photos.sql
-- 孤立した写真（document_idが存在しない）が無いことを確認
SELECT
  photo_id,
  document_id
FROM {{ ref('photos') }}
WHERE document_id NOT IN (
  SELECT DISTINCT document_id FROM {{ ref('document_metadata') }}
);

-- tests/assert_chunk_ids_in_sections_exist.sql
-- journalのsectionsに含まれるchunk_idsが実際に存在することを確認
WITH section_chunk_ids AS (
  SELECT
    document_id,
    JSON_EXTRACT_ARRAY(sections, '$.chunk_ids') AS chunk_ids_array
  FROM {{ ref('journal') }}
),
flattened AS (
  SELECT
    document_id,
    chunk_id
  FROM section_chunk_ids,
  UNNEST(JSON_EXTRACT_STRING_ARRAY(chunk_ids_array)) AS chunk_id
)
SELECT
  f.document_id,
  f.chunk_id
FROM flattened f
LEFT JOIN {{ ref('documents') }} d
  ON f.chunk_id = d.chunk_id
WHERE d.chunk_id IS NULL;
```

---

### 3.4 パフォーマンス監視

**監視すべきメトリクス**:

1. **スキャン量**
```sql
CREATE VIEW monitoring.daily_scan_summary AS
SELECT
  DATE(creation_time) AS query_date,
  user_email,
  COUNT(*) AS query_count,
  SUM(total_bytes_processed) / POW(10, 9) AS total_gb_scanned,
  AVG(total_bytes_processed) / POW(10, 9) AS avg_gb_per_query,
  MAX(total_bytes_processed) / POW(10, 9) AS max_gb_scanned
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE DATE(creation_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
AND job_type = 'QUERY'
GROUP BY query_date, user_email
ORDER BY query_date DESC, total_gb_scanned DESC;
```

2. **スロット使用率**
```sql
CREATE VIEW monitoring.slot_utilization AS
SELECT
  TIMESTAMP_TRUNC(period_start, HOUR) AS hour,
  project_id,
  SUM(period_slot_ms) / (1000 * 60 * 60) AS slot_hours,
  -- 想定: オンデマンド価格の $6.25/TB と比較
FROM `region-us`.INFORMATION_SCHEMA.JOBS_TIMELINE_BY_PROJECT
WHERE period_start >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY hour, project_id
ORDER BY hour DESC;
```

3. **ベクトル検索パフォーマンス**
```sql
CREATE VIEW monitoring.vector_search_performance AS
SELECT
  DATE(creation_time) AS query_date,
  COUNT(*) AS vector_search_count,
  AVG(total_slot_ms) / 1000 AS avg_seconds,
  AVG(total_bytes_processed) / POW(10, 9) AS avg_gb_scanned
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE query LIKE '%VECTOR_SEARCH%'
AND DATE(creation_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY query_date
ORDER BY query_date DESC;
```

4. **アラート設定**
```sql
-- 例: 1クエリで10GB以上スキャンした場合にアラート
-- Cloud Monitoringと連携
```

---

## 4. アクションアイテム

### 優先度: 高（即座に対応が必要）

- [ ] **全テーブルのスキーマ定義を設計書に追加**
  - documents, photos, pending_events, journal, photo_album, monthly_announcement, monthly_lunch_schedule, monthly_lunch_info, uncategorized, raw_documents
  - 各カラムの型、NULL制約、デフォルト値、説明を記載

- [ ] **パーティショニング戦略を設計書に明記**
  - 各テーブルのパーティションキー
  - require_partition_filter の設定方針
  - パーティション数の見積もり

- [ ] **クラスタリング戦略を設計書に明記**
  - 各テーブルのクラスタリングカラム
  - 順序の根拠（カーディナリティ、フィルタ頻度）

- [ ] **チャンク管理の詳細設計**
  - チャンクサイズ、オーバーラップの決定
  - チャンク化戦略（ページ境界、意味的、固定サイズ）の選択
  - (document_id, chunk_index) の複合キー設計

### 優先度: 中（実装前に対応が望ましい）

- [ ] **ER図の作成**
  - テーブル間のリレーション可視化
  - dbdiagram.io または Mermaid で作成

- [ ] **データフロー図の作成**
  - GAS → GCS → raw_documents → documents → 各種別テーブル
  - 各ステップでの処理内容を明記

- [ ] **サンプルクエリ集の作成**
  - 主要なユースケース5-10個のクエリ例
  - 各クエリのスキャン量見積もり

- [ ] **dbtプロジェクト構造の設計**
  - ディレクトリ構造の決定
  - モデルの依存関係の可視化

- [ ] **ベクトル検索の詳細設計**
  - インデックスタイプ（IVF vs TREE-AH）の選択
  - パラメータチューニング（num_lists, num_probes）

### 優先度: 低（実装後または段階的に対応）

- [ ] **テストとバリデーションの実装**
  - dbt tests の作成
  - カスタムテストの実装

- [ ] **パフォーマンス監視の設定**
  - 監視ビューの作成
  - Cloud Monitoringとの連携

- [ ] **コスト見積もりの精緻化**
  - 実データでのベンチマーク
  - 月次コストレポートの自動化

- [ ] **ドキュメントの継続的更新**
  - スキーマ変更時のドキュメント更新フロー
  - dbt docs の自動生成と公開

---

## 5. 補足資料

### 5.1 BigQuery コスト試算（詳細版）

**前提条件**:
```
- PDF: 月4-5ファイル → 年間60ファイル
- 1ファイル: 平均10ページ
- 1ページ: 平均2,000文字 → 500トークン
- チャンクサイズ: 512トークン、オーバーラップ: 50トークン
- 1ファイル: 平均10チャンク
- 年間総チャンク数: 60 × 10 = 600チャンク
- 運用期間: 10年 → 総チャンク数: 6,000チャンク
```

**ストレージコスト**:
```
1. テキストデータ（documents.chunk_text）:
   - 512トークン ≈ 2KB/チャンク
   - 6,000チャンク × 2KB = 12MB
   - $0.02/GB/月 × 0.012GB = $0.00024/月

2. ベクトルデータ（documents.chunk_embedding）:
   - 768次元 × 8 bytes = 6KB/チャンク
   - 6,000チャンク × 6KB = 36MB
   - $0.02/GB/月 × 0.036GB = $0.00072/月

3. Vector Index:
   - インデックスサイズ ≈ 3-5倍 = 108-180MB
   - $0.02/GB/月 × 0.15GB = $0.003/月

4. メタデータテーブル（journal, monthly_*, photos, pending_events）:
   - 合計 ≈ 5MB
   - $0.02/GB/月 × 0.005GB = $0.0001/月

合計ストレージコスト: $0.004/月（10年運用時）
```

**クエリコスト**:
```
1. ベクトル検索（RAG）:
   - 1回のクエリ: 約100MB-1GB スキャン（パーティション pruning 後）
   - 月30回 × 0.5GB = 15GB/月
   - $6.25/TB × 0.015TB = $0.09375/月

2. メタデータ検索（カレンダー登録、写真表示など）:
   - 1回のクエリ: 約10-100MB スキャン
   - 月100回 × 0.05GB = 5GB/月
   - $6.25/TB × 0.005TB = $0.03125/月

3. dbt 増分処理（1回/時間）:
   - 1回のクエリ: 約10MB スキャン（直前1時間のみ）
   - 月720回 × 0.01GB = 7.2GB/月
   - $6.25/TB × 0.0072TB = $0.045/月

合計クエリコスト: $0.17/月
```

**総コスト**:
```
ストレージ: $0.004/月
クエリ: $0.17/月
合計: $0.174/月 ≈ $2.09/年

※実際はBigQueryの最小料金（無料枠）に収まる可能性が高い
※無料枠: 10GB ストレージ/月、1TB クエリ/月
```

### 5.2 参考リンク

**BigQuery ドキュメント**:
- [パーティション分割テーブル](https://cloud.google.com/bigquery/docs/partitioned-tables)
- [クラスタ化テーブル](https://cloud.google.com/bigquery/docs/clustered-tables)
- [Vector Search](https://cloud.google.com/bigquery/docs/vector-search-intro)
- [Object Table](https://cloud.google.com/bigquery/docs/object-table-introduction)
- [ML.PROCESS_DOCUMENT](https://cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-process-document)

**dbt ドキュメント**:
- [Incremental models](https://docs.getdbt.com/docs/build/incremental-models)
- [dbt-bigquery adapter](https://docs.getdbt.com/reference/resource-configs/bigquery-configs)

**Document AI**:
- [Document AI processors](https://cloud.google.com/document-ai/docs/processors-list)
- [OCR processor](https://cloud.google.com/document-ai/docs/processors-list#processor_doc-ocr)

---

## 6. レビュー結論

**現状の評価**:
- ✅ 高レベルなアーキテクチャは妥当
- ✅ データフローの設計は適切
- ❌ 実装に必要な詳細設計が不足
- ❌ パフォーマンス最適化の考慮が不足

**推奨アクション**:
1. 本レビュー文書の内容を設計書に統合
2. 特に「優先度: 高」のアクションアイテムを即座に対応
3. ER図、データフロー図、サンプルクエリを追加
4. 実装フェーズに進む前にチーム（または自身）でレビュー

**次のステップ**:
設計書を更新後、以下の順序で実装を進めることを推奨します：
1. OpenTofu による BigQuery データセット、テーブル、Object Table の作成
2. dbt プロジェクトの初期化とステージングモデルの実装
3. Document AI との連携とチャンク化ロジックの実装
4. ベクトル検索の実装とパフォーマンステスト
5. 文書種別テーブルの実装と構造化ロジックの実装
