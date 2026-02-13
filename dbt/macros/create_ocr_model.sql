{% macro create_ocr_model() %}
  CREATE MODEL IF NOT EXISTS `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.document_ocr_model`
  REMOTE WITH CONNECTION `{{ var('vertex_connection_name') }}`
  OPTIONS (
    remote_service_type = 'CLOUD_AI_DOCUMENT_V1',
    document_processor = '{{ var("document_ai_processor_path") }}'
  );
{% endmacro %}
