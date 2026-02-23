{{
    config(
        materialized='incremental',
        unique_key='event_id',
        incremental_strategy='merge',
        partition_by={"field": "event_date", "data_type": "date"},
        cluster_by=["event_type"]
    )
}}

WITH source AS (
    SELECT
        document_id,
        CONCAT('PDFから日付が指定されたイベントや予定を全て抽出してください。以下のキーワードが出現する場合は特に予定に関する記述である可能性が高いです。\n\n来月、日時、行事予定、日にち、令和、提出\n\n', extracted_markdown) AS prompt
    FROM {{ ref('stg_pdf_uploads__extracted_texts') }}
    {% if is_incremental() %}
      WHERE document_id NOT IN (SELECT DISTINCT document_id FROM {{ this }})
    {% endif %}
),
generated AS (
    SELECT document_id, ml_generate_text_llm_result, ml_generate_text_status
    FROM ML.GENERATE_TEXT(
        MODEL `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.gemini_flash_model`,
        TABLE source,
        STRUCT(
            TRUE AS flatten_json_output,
            '{"generationConfig":{"temperature":0.0,"maxOutputTokens":8192,"responseMimeType":"application/json","responseSchema":{"type":"OBJECT","properties":{"events":{"type":"ARRAY","items":{"type":"OBJECT","properties":{"event_date":{"type":"STRING"},"event_type":{"type":"STRING"},"event_title":{"type":"STRING"},"event_description":{"type":"STRING"}},"required":["event_date","event_type","event_title","event_description"]}}}}}}' AS model_params
        )
    )
    WHERE ml_generate_text_status = ''
),
unnested AS (
    SELECT
        g.document_id,
        JSON_VALUE(ev, '$.event_date') AS event_date_str,
        JSON_VALUE(ev, '$.event_type') AS event_type,
        JSON_VALUE(ev, '$.event_title') AS event_title,
        JSON_VALUE(ev, '$.event_description') AS event_description
    FROM generated g, UNNEST(JSON_QUERY_ARRAY(g.ml_generate_text_llm_result, '$.events')) ev
)
SELECT
    TO_HEX(MD5(CONCAT(document_id, event_date_str, event_title))) AS event_id,
    document_id,
    SAFE.PARSE_DATE('%Y-%m-%d', event_date_str) AS event_date,
    event_type,
    event_title,
    event_description,
    CURRENT_TIMESTAMP() AS extracted_at
FROM unnested
WHERE SAFE.PARSE_DATE('%Y-%m-%d', event_date_str) IS NOT NULL
  AND TRIM(event_title) != ''
