{{ config(materialized='ephemeral') }}

SELECT
    uri,
    `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.url_decode`(
        JSON_VALUE(metadata, '$."original-filename"')
    ) AS original_filename,
    updated AS updated_at
FROM {{ source('pdf_uploads', 'raw_documents') }}
WHERE content_type = 'application/pdf'
