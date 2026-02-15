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

WITH generated AS (
    SELECT
        uri,
        content_type,
        size,
        md5_hash,
        updated,
        ml_generate_text_llm_result
    FROM ML.GENERATE_TEXT(
        MODEL `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.gemini_flash_model`,
        TABLE {{ source('pdf_uploads', 'raw_documents') }},
        STRUCT(
            'このPDFドキュメントの内容をMarkdown形式で忠実に抽出してください。見出し、表、箇条書き、強調などの書式を適切なMarkdown記法で再現してください。' AS prompt,
            TRUE AS flatten_json_output,
            '{"generationConfig": {"temperature": 0.0, "maxOutputTokens": 8192, "responseMimeType": "application/json", "responseSchema": {"type": "OBJECT", "properties": {"extracted_markdown": {"type": "STRING", "description": "PDFから抽出したMarkdown形式のテキスト"}}, "required": ["extracted_markdown"]}}}' AS model_params
        )
    )
    WHERE content_type = 'application/pdf'
)

SELECT
    uri,
    JSON_VALUE(ml_generate_text_llm_result, '$.extracted_markdown') AS extracted_markdown,
    content_type,
    size,
    md5_hash,
    updated AS updated_at
FROM generated
{% if is_incremental() %}
WHERE uri NOT IN (SELECT uri FROM {{ this }})
{% endif %}
