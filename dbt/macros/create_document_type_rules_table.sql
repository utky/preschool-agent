{% macro create_document_type_rules_table() %}
  -- GCS 上の CSV を BigQuery 外部テーブルとして参照（通常の外部テーブル、接続不要）
  CREATE EXTERNAL TABLE IF NOT EXISTS
    `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.document_type_rules`
  (
    document_type STRING,
    label_ja      STRING,
    description   STRING,
    sort_order    INT64
  )
  OPTIONS (
    format            = 'CSV',
    uris              = ['gs://{{ var("seeds_bucket_name") }}/document_type_rules.csv'],
    skip_leading_rows = 1
  );
{% endmacro %}
