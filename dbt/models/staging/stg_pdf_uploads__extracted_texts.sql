{{
    config(
        materialized='incremental',
        unique_key='uri'
    )
}}

WITH source AS (
    SELECT
        uri,
        content_type,
        size,
        md5_hash,
        updated
    FROM {{ source('pdf_uploads', 'raw_documents') }}
    WHERE content_type = 'application/pdf'
    {% if is_incremental() %}
        AND uri NOT IN (SELECT uri FROM {{ this }})
    {% endif %}
),

extracted AS (
    SELECT
        source.uri,
        result.ml_process_document_result.text_segments[OFFSET(0)].text AS extracted_text,
        source.content_type,
        source.size,
        source.md5_hash,
        source.updated AS updated_at
    FROM source
    CROSS JOIN ML.PROCESS_DOCUMENT(
        MODEL `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.document_ocr_model`,
        TABLE source
    ) AS result
)

SELECT
    uri,
    extracted_text,
    content_type,
    size,
    md5_hash,
    updated_at
FROM extracted
