{#
  一度きりのマイグレーション: stg_pdf_uploads__extracted_texts に is_extracted / processed_at を追加する
  実行: dbt run-operation migrate_stg_add_is_extracted
  - 冪等（列が既にあれば ADD はスキップ、UPDATE は NULL 行のみ対象）
  - 既存行はすべて従来フィルタ（status = '' かつ markdown 非 NULL）を通過した行なので判定式で埋める
  - 列追加後は旧コードの merge が列不一致で失敗するため、実行後は速やかに新コードをデプロイすること
#}
{% macro migrate_stg_add_is_extracted() %}
  {% set target_table = '`' ~ var('gcp_project_id') ~ '.' ~ var('dataset_id') ~ '.stg_pdf_uploads__extracted_texts`' %}
  {% set sql %}
    ALTER TABLE {{ target_table }}
      ADD COLUMN IF NOT EXISTS is_extracted BOOL,
      ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;
    UPDATE {{ target_table }}
      SET is_extracted = COALESCE(ml_generate_text_status = '' AND extracted_markdown IS NOT NULL, FALSE)
      WHERE is_extracted IS NULL;
  {% endset %}
  {% do run_query(sql) %}
  {% do log('migrate_stg_add_is_extracted: 完了', info=True) %}
{% endmacro %}
