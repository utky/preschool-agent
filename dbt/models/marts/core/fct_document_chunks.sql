{{
    config(
        materialized='table',
        partition_by={
            "field": "publish_date",
            "data_type": "date"
        },
        cluster_by=["document_id", "document_type"]
    )
}}

WITH chunks AS (
    SELECT
        chunk_id,
        document_id,
        chunk_index,
        chunk_text
    FROM {{ ref('int_extracted_texts__chunked') }}
),

documents AS (
    SELECT
        document_id,
        title,
        document_type,
        publish_date
    FROM {{ ref('dim_documents') }}
)

SELECT
    c.chunk_id,
    c.document_id,
    c.chunk_index,
    c.chunk_text,
    -- RAG用冗長メタデータ（JOINなしで参照可能にする）
    d.title,
    d.document_type,
    d.publish_date
FROM chunks c
INNER JOIN documents d ON c.document_id = d.document_id
