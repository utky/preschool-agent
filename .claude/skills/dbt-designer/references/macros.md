# macros 専用ルール

## 目的

複数モデルで再利用されるロジックを Jinja マクロとして定義。
DRY 原則をモデル間で実現するための仕組み。

## フォルダ構造

```
dbt/macros/
├── generate_schema_name.sql    ← dbt 組み込みオーバーライド
├── date_spine.sql
└── safe_divide.sql
```

## 使うべき場面

- 同じ SQL パターンが **3箇所以上** に登場する場合
- 環境変数・プロジェクト変数を抽象化したい場合
- dbt 組み込みマクロのオーバーライド（`generate_schema_name` 等）

## 使わないべき場面

- 1〜2箇所にしか使わないロジック（DRY より可読性を優先）
- ドキュメントなしのマクロ（必ず docstring を書く）
- モデル内で一度しか使わない複雑な CTE（inline で書く）

## 命名規則

```
macros/{目的}.sql
```

- マクロ名は `snake_case`
- ファイル名 = マクロ名（1ファイル1マクロが理想）
- 例: `macros/safe_divide.sql` → `{% macro safe_divide(numerator, denominator) %}`

## マクロの書き方

```sql
-- macros/safe_divide.sql
{% macro safe_divide(numerator, denominator, default=0) %}
    -- ゼロ除算を防ぐ安全な除算マクロ
    -- Args:
    --   numerator: 分子
    --   denominator: 分母
    --   default: 分母が0の場合のデフォルト値（デフォルト: 0）
    CASE
        WHEN {{ denominator }} = 0 THEN {{ default }}
        ELSE {{ numerator }} / {{ denominator }}
    END
{% endmacro %}
```

使用例:
```sql
select
    document_id,
    {{ safe_divide('matched_chunks', 'total_chunks') }} as match_rate
from {{ ref('fct_document_chunks') }}
```

## dbt 組み込みマクロのオーバーライド

### generate_schema_name（よく使う）

```sql
-- macros/generate_schema_name.sql
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- set default_schema = target.schema -%}
    {%- if custom_schema_name is none -%}
        {{ default_schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
```

## テスト

マクロは直接テストしにくいため、マクロを使用するモデルのテストで間接的に検証する。
複雑なマクロは `analyses/` に検証クエリを置くことも検討する。
