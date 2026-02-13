{% macro create_ocr_model() %}
  CREATE MODEL IF NOT EXISTS `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.gemini_flash_model`
  REMOTE WITH CONNECTION `{{ var('vertex_connection_name') }}`
  OPTIONS (
    ENDPOINT = 'gemini-2.5-flash'
  );
{% endmacro %}
