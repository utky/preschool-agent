# intermediate レイヤ専用ルール

## 目的

staging の atomic モデルをビジネスコンセプトに変換する橋渡しレイヤ。
複雑な変換・JOIN・粒度変換を分離して、marts をシンプルに保つ。

## フォルダ構造

ビジネスドメインごとにサブディレクトリ（staging と異なりソースシステムでは分類しない）:

```
dbt/models/intermediate/
├── documents/
│   ├── _documents__models.yml
│   ├── int_extracted_texts__chunked.sql
│   └── int_document_chunks__embedded.sql
├── calendar/
│   ├── _calendar__models.yml
│   └── int_calendar_events__normalized.sql
```

## 命名規則

```
int_{entity}__{transformation}.sql
```

- `{entity}`: 処理対象のエンティティ（複数形推奨）
- `{transformation}`: 変換の動詞（何をしているかを表す）
- ダブルアンダースコア `__` でエンティティと変換を区切る

**動詞の例**:
- `pivoted`: カラムの pivot/unpivot
- `aggregated`: 集計処理
- `joined`: 複数ソースの結合
- `fanned_out`: 1行を複数行に展開
- `embedded`: ベクトル埋め込み生成
- `chunked`: テキストのチャンク分割
- `normalized`: 正規化・標準化

例:
- `int_extracted_texts__chunked.sql`
- `int_document_chunks__embedded.sql`
- `int_calendar_events__normalized.sql`

## マテリアライゼーション

**デフォルト: `ephemeral`**

```sql
{{ config(materialized='ephemeral') }}
```

- ウェアハウスに余分なテーブルを作らない（CTE として展開される）
- BigQuery ではストレージコストなし

**例外: `view`**
- デバッグが必要な場合
- カスタムスキーマ推奨: `{{ config(materialized='view', schema='intermediate') }}`

**例外: `table`**
- ML関数（`ML.GENERATE_EMBEDDING` 等）の入力として必要な場合
- 上流の `incremental` モデルに依存して重い処理を避けたい場合

## 主な用途

### 1. 複数 staging モデルの JOIN

```sql
-- int_documents__with_texts.sql
select
    d.document_id,
    d.name,
    t.extracted_text
from {{ ref('stg_google_drive__documents') }} d
left join {{ ref('stg_pdf_uploads__extracted_texts') }} t
    on d.document_id = t.document_id
```

目安: 4〜6テーブル程度の JOIN まで。それ以上は分割を検討。

### 2. Re-graining（粒度変換）

**Fan-out（1行 → 複数行）**:
```sql
-- int_extracted_texts__chunked.sql
-- 1ドキュメント → 複数チャンク
select
    document_id,
    chunk_index,
    chunk_text
from {{ ref('stg_pdf_uploads__extracted_texts') }},
unnest(split(extracted_text, '\n\n')) as chunk_text with offset as chunk_index
```

**Collapse（複数行 → 1行）**:
```sql
-- GROUP BY で粒度を落とす
```

### 3. 複雑なロジックの分離

marts に直接書くと長くなるロジックを分離することで:
- テストが書きやすくなる
- 可読性が上がる
- 再利用可能になる

## DAG 設計原則

「**Narrow the DAG, widen the tables**」

- モデルは多入力・単出力が理想
- 1つの intermediate モデルが複数の下流モデルに参照される場合 → 構造見直しのサイン
- intermediate は基本的に 1つの marts モデルのためだけに存在する

## YAML スキーマ例

```yaml
# _documents__models.yml
version: 2

models:
  - name: int_extracted_texts__chunked
    description: 抽出テキストをチャンク単位に分割した中間モデル
    columns:
      - name: document_id
        description: ドキュメントID
        tests:
          - not_null
      - name: chunk_index
        description: チャンクのインデックス（0始まり）
        tests:
          - not_null
```
