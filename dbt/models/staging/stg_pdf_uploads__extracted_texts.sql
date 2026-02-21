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
        metadata,
        updated,
        ml_generate_text_llm_result,
        ml_generate_text_status
    FROM ML.GENERATE_TEXT(
        MODEL `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.gemini_flash_model`,
        (
            SELECT *
            FROM {{ source('pdf_uploads', 'raw_documents') }}
            WHERE content_type = 'application/pdf'
            {% if var('date', none) is not none and var('hour', none) is not none %}
                AND updated >= TIMESTAMP('{{ var("date") }}T{{ var("hour") }}:00:00Z')
                AND updated < TIMESTAMP_ADD(TIMESTAMP('{{ var("date") }}T{{ var("hour") }}:00:00Z'), INTERVAL 1 HOUR)
            {% endif %}
            {% if is_incremental() %}
                AND uri NOT IN (SELECT uri FROM {{ this }})
            {% endif %}
        ),
        STRUCT(
            'このPDFドキュメントの内容をMarkdown形式で忠実に抽出してください。見出し、表、箇条書き、強調などの書式を適切なMarkdown記法で再現してください。' AS prompt,
            TRUE AS flatten_json_output,
            '{"generationConfig": {"temperature": 0.0, "maxOutputTokens": 8192, "responseMimeType": "application/json", "responseSchema": {"type": "OBJECT", "properties": {"extracted_markdown": {"type": "STRING", "description": "PDFから抽出したMarkdown形式のテキスト"}}, "required": ["extracted_markdown"]}}}' AS model_params
        )
    )
)

SELECT
    uri,
    (SELECT value FROM UNNEST(metadata) WHERE name = 'drive-file-id') AS document_id,
    `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.url_decode`(
        (SELECT value FROM UNNEST(metadata) WHERE name = 'original-filename')
    ) AS original_filename,
    JSON_VALUE(ml_generate_text_llm_result, '$.extracted_markdown') AS extracted_markdown,
    ml_generate_text_llm_result,
    ml_generate_text_status,
    content_type,
    size,
    md5_hash,
    updated AS updated_at
FROM generated
WHERE ml_generate_text_status = ''
  AND JSON_VALUE(ml_generate_text_llm_result, '$.extracted_markdown') IS NOT NULL
