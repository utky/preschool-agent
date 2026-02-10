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
)

SELECT
    document_id,
    uri,
    -- 暫定: GCS URIからファイル名を抽出してタイトルとする
    REGEXP_EXTRACT(uri, r'/([^/]+)$') AS title,
    -- Slice 6で文書種別分類を実装予定
    CAST(NULL AS STRING) AS document_type,
    -- Slice 6で発行日抽出を実装予定
    CAST(NULL AS DATE) AS publish_date,
    content_type,
    size,
    md5_hash,
    total_chunks,
    updated_at
FROM chunks
