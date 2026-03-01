# marts レイヤ専用ルール

## 目的

ビジネス向けの最終エンティティ。ユーザーが直接クエリする成果物。
API エクスポート、ダッシュボード、分析クエリの参照先となる。

## フォルダ構造

部門・ビジネスエリアでサブディレクトリ（このプロジェクトは `marts/core/`）:

```
dbt/models/marts/
└── core/
    ├── _core__models.yml
    ├── dim_documents.sql
    ├── fct_document_chunks.sql
    ├── fct_events.sql
    └── fct_calendar_sync_history.sql
```

同一概念を部門別に複製しない（`finance_orders` と `marketing_orders` を別々に作らない）。

## 命名規則（このプロジェクト固有）

| 種類 | パターン | 例 |
|------|---------|-----|
| ディメンションテーブル | `dim_{entity}.sql` | `dim_documents.sql` |
| ファクトテーブル | `fct_{entity}.sql` | `fct_document_chunks.sql` |
| イベント系ファクト | `fct_{entity}.sql` | `fct_events.sql` |
| 履歴・ログ系ファクト | `fct_{entity}_history.sql` | `fct_calendar_sync_history.sql` |
| 中間生成物（fct化前） | エンティティ名そのまま | `events.sql`（暫定） |

**重要**: バックエンド管理テーブルでも命名規則は必ず適用する。
- ❌ `calendar_sync_history.sql`（プレフィックスなし）
- ✅ `fct_calendar_sync_history.sql`（fct プレフィックス付き）

**dim vs fct の判断基準**:
- `dim_`: 事実を説明する属性の集合（ドキュメント、ユーザー等）
- `fct_`: イベント・トランザクション・履歴の記録（クリック、注文、同期履歴等）

## マテリアライゼーション

**デフォルト: `table`**

```sql
{{ config(materialized='table') }}
```

- エンドユーザーのクエリパフォーマンスを最優先
- BigQuery では毎回全件再構築

**大量データの場合: `incremental`**

```sql
{{ config(
    materialized='incremental',
    unique_key='chunk_id',
    incremental_strategy='merge'
) }}
```

- merge strategy 推奨（BigQuery の MERGE 文を使用）
- `unique_key` で重複排除
- `is_incremental()` マクロで差分のみ処理

## 設計原則

### Wide & denormalized

```sql
-- 正規化せず、必要なカラムをすべて1テーブルに持つ
select
    c.chunk_id,
    c.document_id,
    d.document_name,      -- dim_documents からの非正規化
    d.category,           -- dim_documents からの非正規化
    c.chunk_text,
    c.embedding
from {{ ref('int_document_chunks__embedded') }} c
left join {{ ref('dim_documents') }} d
    on c.document_id = d.document_id
```

計算コストより安いストレージを活用し、JOIN を削減する。

### エンティティグレイン維持

- 1行 = 1ビジネス概念のインスタンス
- `fct_document_chunks`: 1行 = 1チャンク
- `fct_calendar_sync_history`: 1行 = 1同期実行

### intermediate への切り出し判断

4〜5テーブル以上の JOIN が marts 内に出てきたら → intermediate に切り出す

```
marts の SELECT が複雑すぎる場合:
  → int_{entity}__{transformation}.sql を作成
  → marts はシンプルな SELECT に簡略化
```

## YAML スキーマ例

```yaml
# _core__models.yml
version: 2

models:
  - name: fct_calendar_sync_history
    description: カレンダー同期の実行履歴ファクトテーブル
    config:
      materialized: table
    columns:
      - name: sync_id
        description: 同期実行の一意識別子
        tests:
          - unique
          - not_null
      - name: synced_at
        description: 同期実行日時
        tests:
          - not_null
      - name: status
        description: 同期ステータス
        tests:
          - not_null
          - accepted_values:
              values: ['success', 'failure', 'partial']

  - name: dim_documents
    description: ドキュメントのディメンションテーブル
    config:
      materialized: table
    columns:
      - name: document_id
        description: ドキュメントの一意識別子
        tests:
          - unique
          - not_null
```
