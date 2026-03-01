# exports レイヤ専用ルール

## 目的

marts のデータを外部システム（GCS 等）に出力するレイヤ（このプロジェクト固有）。
API エンドポイントが GCS 経由でデータを提供するためのエクスポートモデル。

## フォルダ構造

```
dbt/models/exports/
├── _exports__models.yml
├── exp_api__documents.sql
├── exp_api__chunks.sql
└── exp_api__events.sql
```

## 命名規則

```
exp_api__{entity}.sql
```

- 必ず `exp_api__` プレフィックスを付ける
- `{entity}`: エクスポート対象のエンティティ名
- ダブルアンダースコア `__` でプレフィックスとエンティティを区切る

例:
- `exp_api__documents.sql`
- `exp_api__chunks.sql`
- `exp_api__events.sql`

## マテリアライゼーション

**必須: `table`**

```sql
{{ config(materialized='table') }}
```

- GCS エクスポート（EXPORT DATA）前提のため必ず `table`
- `view` は EXPORT DATA で使用できないため禁止

## 責務と制約

### ソースは必ず marts のモデルを参照

```sql
-- ✅ 正しい: marts を ref()
select * from {{ ref('fct_document_chunks') }}

-- ❌ 禁止: intermediate や staging を直接参照
select * from {{ ref('int_document_chunks__embedded') }}
select * from {{ ref('stg_pdf_uploads__extracted_texts') }}
```

### 変換ロジックは書かない

**許容されるもの**:
- カラムの選択（SELECT 対象を絞る）
- フィルタリング（WHERE 条件）
- エンベディング等の重いカラムの除外（API 用に軽量化）

```sql
-- ✅ 許容: カラム選択とフィルタ
select
    document_id,
    name,
    category,
    -- embedding は除外（APIレスポンスに不要）
    chunk_text
from {{ ref('fct_document_chunks') }}
where is_published = true
```

**禁止されるもの**:
- JOIN
- GROUP BY / 集計（COUNT、SUM 等）
- CASE による変換ロジック
- 計算カラムの追加

複雑なロジックが必要な場合 → marts または intermediate に実装してから参照する。

## EXPORT DATA との連携

```sql
-- GCS へのエクスポート例（dbt モデル外で実行）
EXPORT DATA OPTIONS(
  uri='gs://bucket/exports/documents/*.json',
  format='JSON',
  overwrite=true
) AS
SELECT * FROM `project.dataset.exp_api__documents`
```

## YAML スキーマ例

```yaml
# _exports__models.yml
version: 2

models:
  - name: exp_api__documents
    description: API向けドキュメントエクスポートテーブル（GCS出力用）
    config:
      materialized: table
    columns:
      - name: document_id
        description: ドキュメントの一意識別子
        tests:
          - unique
          - not_null
      - name: name
        description: ドキュメント名
        tests:
          - not_null
```
