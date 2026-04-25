{{
    config(
        materialized='incremental',
        unique_key='chunk_id',
        incremental_strategy='merge',
        schema='school_agent',
        labels={
            'layer': 'intermediate',
            'application': 'school-agent'
        },
        pre_hook="{% if is_incremental() %}DELETE FROM {{ this }} WHERE chunk_id NOT IN (SELECT chunk_id FROM {{ ref('int_extracted_texts__chunked') }}){% endif %}"
    )
}}

-- チャンクにベクトル埋め込みを生成する中間モデル
-- incrementalにより新規チャンクおよびコンテンツ変更チャンクのみembeddingを生成（コスト最適化）
-- pre_hookで削除されたチャンクのorphan embeddingを掃除する

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
    {% if is_incremental() %}
        -- chunk_id が存在しても md5_hash（文書コンテンツ）が変わっていれば再 embedding
        WHERE (chunk_id, md5_hash) NOT IN (
            SELECT
                t.chunk_id,
                t.md5_hash
            FROM {{ this }} AS t
        )
    {% endif %}
),

embedded AS (
    SELECT *
    FROM ML.GENERATE_EMBEDDING(
        model `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.text_embedding_model`,
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
