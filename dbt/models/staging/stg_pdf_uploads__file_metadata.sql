{{ config(materialized='ephemeral') }}

SELECT
    uri,
    `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.url_decode`(
        (SELECT value FROM UNNEST(metadata) WHERE name = 'original-filename')
    ) AS original_filename,
    updated AS updated_at
FROM {{ source('pdf_uploads', 'raw_documents') }}
WHERE content_type = 'application/pdf'
{% if var('date', none) is not none and var('hour', none) is not none %}
    AND updated >= TIMESTAMP('{{ var("date") }}T{{ var("hour") }}:00:00Z')
    AND updated < TIMESTAMP_ADD(TIMESTAMP('{{ var("date") }}T{{ var("hour") }}:00:00Z'), INTERVAL 1 HOUR)
{% endif %}
