{% macro create_url_decode_udf() %}
  CREATE FUNCTION IF NOT EXISTS `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.url_decode`(encoded STRING)
  RETURNS STRING
  LANGUAGE js AS "return decodeURIComponent(encoded);";
{% endmacro %}
