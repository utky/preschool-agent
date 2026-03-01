{% macro create_document_type_rules_table() %}
  -- GCS 上の CSV を BigLake 外部テーブルとして参照（専用接続SAを使用）
  CREATE EXTERNAL TABLE IF NOT EXISTS
    `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.document_type_rules`
  (
    document_type STRING,
    label_ja      STRING,
    description   STRING,
    sort_order    INT64
  )
  WITH CONNECTION `{{ var('seeds_connection_name') }}`
  OPTIONS (
    format            = 'CSV',
    uris              = ['gs://{{ var("seeds_bucket_name") }}/document_type_rules.csv'],
    skip_leading_rows = 1
  );
{% endmacro %}
