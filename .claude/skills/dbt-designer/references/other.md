# その他コンポーネント（seeds, analyses, snapshots）

## seeds

### 目的

ソースシステムに存在しないルックアップテーブル・静的マスターデータ。
CSV ファイルとして管理し、`dbt seed` でウェアハウスに読み込む。

### 使うべき場面

- ドキュメントタイプ定義（例: `document_types.csv`）
- 国コード・通貨コードのマッピング
- カテゴリマスター
- テスト用フィクスチャデータ

### 禁止

- ソースシステムのデータを seeds で読み込むこと
  → ソースは `source()` で参照し、staging で処理する

### このプロジェクト固有

**GCS 外部テーブルで seeds を代替**（`seeds_bucket`）:
- 大容量の静的データは GCS にアップロードし BigQuery 外部テーブルとして参照
- dbt の seeds は小規模なマスターデータのみに使用

```
dbt/seeds/
└── document_categories.csv
```

```yaml
# dbt_project.yml
seeds:
  preschool_agent:
    document_categories:
      +column_types:
        category_id: integer
        category_name: string
```

## analyses

### 目的

Jinja テンプレートを使った監査クエリ・探索クエリ。
`dbt run` でマテリアライズされない（`dbt compile` のみ）。

### 使うべき場面

- データ品質の監査クエリ（定期的に手動実行するクエリ）
- データ探索クエリ（パターン調査、異常値検出等）
- マクロの動作確認クエリ

```
dbt/analyses/
├── audit_chunk_counts.sql
└── explore_embedding_distribution.sql
```

### analyses の書き方

```sql
-- analyses/audit_chunk_counts.sql
-- ドキュメントごとのチャンク数を監査するクエリ
select
    document_id,
    count(*) as chunk_count,
    avg(length(chunk_text)) as avg_chunk_length
from {{ ref('fct_document_chunks') }}
group by 1
having count(*) = 0  -- チャンクが0件のドキュメントを検出
```

## snapshots

### 目的

Type 2 SCD（Slowly Changing Dimensions）の実装。
レコードの変更履歴を時系列で保持する。

### 使うべき場面

- ドキュメントのステータス変遷を追跡したい場合
- ユーザー属性の変更履歴を保持したい場合
- 価格・設定の履歴管理

```
dbt/snapshots/
└── snap_documents.sql
```

```sql
-- snapshots/snap_documents.sql
{% snapshot snap_documents %}
{{
    config(
        target_schema='snapshots',
        unique_key='document_id',
        strategy='timestamp',
        updated_at='updated_at',
    )
}}

select * from {{ source('google_drive', 'documents') }}

{% endsnapshot %}
```

### スナップショットの特徴

- `dbt_valid_from` / `dbt_valid_to` カラムが自動追加される
- `dbt_valid_to IS NULL` で現在有効なレコードを取得
- marts の `dim_` テーブルから参照することが多い

## フォルダ構成の原則

### フォルダをプライマリセレクタとして使う

タグ（`+tags`）よりフォルダ選択を優先:

```bash
# ✅ 推奨: フォルダ単位でのビルド
dbt build --select staging+
dbt build --select intermediate+
dbt build --select marts.core+
dbt build --select exports+

# 非推奨: タグでの絞り込み（フォルダが使えない場合のみ）
dbt build --select tag:daily
```

### フォルダ構造の全体像

```
dbt/
├── models/
│   ├── staging/
│   │   └── {source_system}/
│   ├── intermediate/
│   │   └── {business_domain}/
│   ├── marts/
│   │   └── core/
│   └── exports/
├── tests/
├── macros/
├── seeds/
├── analyses/
├── snapshots/
└── dbt_project.yml
```
