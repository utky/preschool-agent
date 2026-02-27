{{
    config(
        materialized='table',
        post_hook=[
            "EXPORT DATA OPTIONS(uri='gs://{{ var(\"api_data_bucket_name\") }}/documents_*.json', format='JSON', overwrite=true) AS SELECT document_id, uri, title, document_type, publish_date, content_type, size, total_chunks, updated_at FROM {{ this }}"
        ]
    )
}}

SELECT
    document_id,
    uri,
    title,
    document_type,
    CAST(publish_date AS STRING) AS publish_date,
    content_type,
    size,
    total_chunks,
    updated_at
FROM {{ ref('dim_documents') }}
ORDER BY updated_at DESC
