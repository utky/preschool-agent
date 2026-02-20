{{
    config(
        materialized='table',
        schema='school_agent',
        labels={
            'layer': 'intermediate',
            'application': 'school-agent'
        }
    )
}}

-- チャンクにベクトル埋め込みを生成する中間モデル
-- ML.GENERATE_EMBEDDINGはephemeralでは使用不可のためtableで永続化

WITH chunks AS (
    SELECT
        chunk_id,
        document_id,
        uri,
        chunk_index,
        chunk_text,
        content_type,
        size,
        md5_hash,
        updated_at
    FROM {{ ref('int_extracted_texts__chunked') }}
),

embedded AS (
    SELECT *
    FROM ML.GENERATE_EMBEDDING(
        MODEL `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.text_embedding_model`,
        (
            SELECT
                chunk_id,
                document_id,
                uri,
                chunk_index,
                chunk_text AS content,
                content_type,
                size,
                md5_hash,
                updated_at
            FROM chunks
        ),
        STRUCT(
            'RETRIEVAL_DOCUMENT' AS task_type,
            TRUE AS flatten_json_output
        )
    )
)

SELECT
    chunk_id,
    document_id,
    uri,
    chunk_index,
    content AS chunk_text,
    ml_generate_embedding_result AS chunk_embedding,
    content_type,
    size,
    md5_hash,
    updated_at
FROM embedded
