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
        JSON_VALUE(result.ml_generate_text_llm_result, '$.extracted_markdown') AS extracted_markdown,
        source.content_type,
        source.size,
        source.md5_hash,
        source.updated AS updated_at
    FROM source
    CROSS JOIN ML.GENERATE_TEXT(
        MODEL `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.gemini_flash_model`,
        TABLE source,
        STRUCT(
            'このPDFドキュメントの内容をMarkdown形式で忠実に抽出してください。見出し、表、箇条書き、強調などの書式を適切なMarkdown記法で再現してください。' AS prompt,
            TRUE AS flatten_json_output,
            '{"generationConfig": {"temperature": 0.0, "maxOutputTokens": 8192, "responseMimeType": "application/json", "responseSchema": {"type": "OBJECT", "properties": {"extracted_markdown": {"type": "STRING", "description": "PDFから抽出したMarkdown形式のテキスト"}}, "required": ["extracted_markdown"]}}}' AS model_params
        )
    ) AS result
)

SELECT
    uri,
    extracted_markdown,
    content_type,
    size,
    md5_hash,
    updated_at
FROM extracted
