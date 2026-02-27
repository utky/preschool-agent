{{
    config(
        materialized='table',
        post_hook=[
            "EXPORT DATA OPTIONS(uri='gs://{{ var(\"api_data_bucket_name\") }}/chunks_*.json', format='JSON', overwrite=true) AS SELECT chunk_id, document_id, chunk_index, chunk_text, title, document_type, publish_date FROM {{ this }}"
        ]
    )
}}

SELECT
    chunk_id,
    document_id,
    chunk_index,
    chunk_text,
    title,
    document_type,
    CAST(publish_date AS STRING) AS publish_date
FROM {{ ref('fct_document_chunks') }}
ORDER BY document_id, chunk_index
