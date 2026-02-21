{{
    config(
        materialized='table',
        partition_by={
            "field": "publish_date",
            "data_type": "date"
        },
        cluster_by=["document_type"]
    )
}}

WITH chunks AS (
    SELECT
        document_id,
        uri,
        content_type,
        size,
        md5_hash,
        updated_at,
        COUNT(*) AS total_chunks
    FROM {{ ref('int_extracted_texts__chunked') }}
    GROUP BY document_id, uri, content_type, size, md5_hash, updated_at
),

file_metadata AS (
    SELECT uri, original_filename
    FROM {{ ref('stg_pdf_uploads__extracted_texts') }}
)

SELECT
    c.document_id,
    c.uri,
    COALESCE(fm.original_filename, REGEXP_EXTRACT(c.uri, r'/([^/]+)$')) AS title,
    -- Slice 6で文書種別分類を実装予定
    CAST(NULL AS STRING) AS document_type,
    -- Slice 6で発行日抽出を実装予定
    CAST(NULL AS DATE) AS publish_date,
    c.content_type,
    c.size,
    c.md5_hash,
    c.total_chunks,
    c.updated_at
FROM chunks c
LEFT JOIN file_metadata fm ON c.uri = fm.uri
