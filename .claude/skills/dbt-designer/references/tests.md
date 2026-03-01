# tests 専用ルール

## 目的

複数モデル間の整合性テスト・ビジネスルール検証。
単一モデルの generic tests は YAML に定義し、複雑なテストのみ `tests/` フォルダに配置する。

## generic tests（YAML 定義）

各モデルの `_*.yml` に定義。単一モデルの標準的なチェックに使用。

### 標準テスト

```yaml
columns:
  - name: document_id
    tests:
      - unique        # 主キー: 必須
      - not_null      # 主キー: 必須
  - name: status
    tests:
      - not_null
      - accepted_values:
          values: ['active', 'inactive', 'deleted']
  - name: category_id
    tests:
      - not_null
      - relationships:
          to: ref('dim_categories')
          field: category_id
```

### 付与ルール

- **主キー**: 必ず `unique` + `not_null` を付与
- **外部キー**: `relationships` テストを付与
- **ステータス列**: `accepted_values` で有効値を明示
- **NOT NULL**: ビジネス上 null が許容されないカラムに付与

### publish_date の not_null テスト（このプロジェクト固有）

`publish_date` が null になりうる場合は `where` 条件で除外:

```yaml
- name: publish_date
  tests:
    - not_null:
        config:
          where: "category != 'uncategorized'"
```

## singular tests（`tests/` フォルダ）

複数モデルにまたがるチェックや、generic tests で表現できない複雑な条件に使用。

### 命名規則

```
tests/{対象}__{検証内容}.sql
```

例:
- `tests/fct_document_chunks__embedding_not_null.sql`
- `tests/fct_events__publish_date_consistency.sql`

### 作成基準

- 複数モデルの整合性チェック（A テーブルと B テーブルの件数一致等）
- ビジネスルールの検証（条件付き not null 等）
- 汎用テストで表現できない複雑な SQL 条件

### singular test の書き方

```sql
-- テストは「失敗すべき行」を返す
-- 返された行がある場合 = テスト失敗
select
    chunk_id
from {{ ref('fct_document_chunks') }}
where embedding is null
  and created_at < '2024-01-01'  -- 特定期間は embedding が必須
```

## テスト実行コマンド

```bash
# 全テスト
dbt test

# 特定モデルのテスト
dbt test --select fct_document_chunks

# generic tests のみ
dbt test --select test_type:generic

# singular tests のみ
dbt test --select test_type:singular
```

## テスト設計の考え方

1. **主キーは必ずテスト**: `unique` + `not_null` を省略しない
2. **外部キー整合性**: `relationships` で参照先の存在を保証
3. **ビジネスルールは singular test**: YAML で表現しきれない条件はSQLで書く
4. **テストが重すぎる場合**: `config: severity: warn` で警告に格下げ

```yaml
- name: chunk_text
  tests:
    - not_null:
        config:
          severity: warn  # 警告として扱う（CI を止めない）
```
