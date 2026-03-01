# staging レイヤ専用ルール

## 目的

ソースの生データを atomic な building block に変換する基盤レイヤ。
downstream モデルが参照しやすい標準化された形式に整える。

## フォルダ構造

ソースシステムごとにサブディレクトリを作成:

```
dbt/models/staging/
├── google_drive/
│   ├── _google_drive__sources.yml
│   ├── _google_drive__models.yml
│   └── stg_google_drive__documents.sql
├── pdf_uploads/
│   ├── _pdf_uploads__sources.yml
│   ├── _pdf_uploads__models.yml
│   └── stg_pdf_uploads__extracted_texts.sql
```

- ローダー機構（Fivetran等）や業務ドメインでは分類しない
- あくまでソースシステム（データの出所）で分類する

## 命名規則

```
stg_{source}__{entity}.sql
```

- `{source}`: ソースシステム名（例: `google_drive`, `pdf_uploads`, `bigquery`）
- `{entity}`: エンティティ名（例: `documents`, `extracted_texts`）
- ダブルアンダースコア `__` でソースとエンティティを区切る
- 公式推奨は複数形だがこのプロジェクトは単数形も許容

例:
- `stg_google_drive__documents.sql`
- `stg_pdf_uploads__extracted_texts.sql`

## マテリアライゼーション

**デフォルト: `view`**

```sql
{{ config(materialized='view') }}
```

- ストレージを消費せず、常に最新ソースデータを参照できる
- BigQuery の view は無料（クエリ時に課金）

**例外: `incremental`**
- `ML.GENERATE_TEXT` 等の外部 AI 処理を含む場合
- 実行コストが高い処理を毎回再実行したくない場合

## やること ✅

- **カラムのリネーム**: ソースの冗長なプレフィックス除去、snake_case 統一
  ```sql
  document_id as id,
  document_name as name,
  ```
- **型キャスト**: STRING → TIMESTAMP、INT → FLOAT 等
  ```sql
  CAST(created_at AS TIMESTAMP) as created_at,
  ```
- **単純な計算**: cents → dollars、単位変換
  ```sql
  amount_cents / 100.0 as amount_dollars,
  ```
- **CASE による単純分類**: ステータスコードの文字列変換等
- **ML.GENERATE_TEXT 等の外部処理**（このプロジェクト固有）

## やってはいけないこと ❌

- **JOIN**: 他テーブルとの結合 → intermediate で行う
- **集計**: GROUP BY、COUNT、SUM 等 → intermediate または marts で行う
- **ビジネスロジック**: ビジネス定義に依存した判断 → marts で行う

## base モデル（複雑なケース向け）

staging の前段に `base/` フォルダを作り `base_` プレフィックスのモデルを置く:

**使用ケース**:
- 削除テーブルを JOIN して論理削除フラグを付ける場合
- 同構造の複数ソースを UNION する場合（マルチリージョン等）

```
staging/google_drive/
├── base/
│   └── base_google_drive__documents_deleted.sql
└── stg_google_drive__documents.sql  ← base を ref() する
```

## YAML スキーマ例

```yaml
# _google_drive__models.yml
version: 2

models:
  - name: stg_google_drive__documents
    description: Google Drive からのドキュメント一覧（staging）
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
