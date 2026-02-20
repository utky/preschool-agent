{% macro create_embedding_model() %}
  CREATE MODEL IF NOT EXISTS `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.text_embedding_model`
  REMOTE WITH CONNECTION `{{ var('vertex_connection_name') }}`
  OPTIONS (ENDPOINT = 'text-embedding-005');
{% endmacro %}
