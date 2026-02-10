{% macro export_to_gcs(bucket_name, path, format='JSON') %}
{#
  BigQuery EXPORT DATA でGCSにデータをエクスポートするヘルパー。
  post_hook として使用する。
#}
EXPORT DATA OPTIONS(
    uri='gs://{{ bucket_name }}/{{ path }}/*.json',
    format='{{ format }}',
    overwrite=true
) AS
{% endmacro %}
