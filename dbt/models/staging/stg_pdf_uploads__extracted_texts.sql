{{
    config(
        materialized='incremental',
        unique_key='uri',
        incremental_strategy='merge',
        partition_by={
            "field": "updated_at",
            "data_type": "timestamp"
        },
        cluster_by=["uri"]
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
        JSON_VALUE(result.ml_generate_text_llm_result, '$.extracted_text') AS extracted_text,
        source.content_type,
        source.size,
        source.md5_hash,
        source.updated AS updated_at
    FROM source
    CROSS JOIN ML.GENERATE_TEXT(
        MODEL `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.gemini_flash_model`,
        TABLE source,
        STRUCT(
            'このPDFドキュメントのテキスト内容をすべて忠実に抽出してください。レイアウトや書式は無視し、プレーンテキストのみを返してください。' AS prompt,
            'application/json' AS response_mime_type,
            '{"type": "OBJECT", "properties": {"extracted_text": {"type": "STRING", "description": "PDFから抽出したテキスト全文"}}, "required": ["extracted_text"]}' AS response_schema,
            TRUE AS flatten_json_output,
            0.0 AS temperature,
            8192 AS max_output_tokens
        )
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
