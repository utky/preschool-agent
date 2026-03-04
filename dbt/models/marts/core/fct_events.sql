{{
    config(
        materialized='incremental',
        unique_key='event_id',
        incremental_strategy='merge',
        partition_by={"field": "event_date", "data_type": "date"},
        cluster_by=["document_id"]
    )
}}

WITH source AS (  -- noqa: ST03
    SELECT
        document_id,
        CONCAT(
            'PDFから日付が指定されたイベントや予定を全て抽出してください。\n',
            '以下のキーワードが出現する場合は特に予定に関する記述である可能性が高いです。\n',
            '来月、日時、行事予定、日にち、令和、提出\n\n',
            '時刻が明記されている場合はevent_timeをHH:MM形式（24時間）で抽出してください。時刻がない場合はnullにしてください。\n\n',
            extracted_markdown
        ) AS prompt
    FROM {{ ref('stg_pdf_uploads__extracted_texts') }}
    {% if is_incremental() %}
        WHERE document_id NOT IN (SELECT DISTINCT document_id FROM {{ this }})  -- noqa: RF02
    {% endif %}
),

generated AS (
    SELECT
        document_id,
        ml_generate_text_llm_result,
        ml_generate_text_status
    FROM
        ML.GENERATE_TEXT(
            model `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.gemini_flash_model`,
            table source,
            STRUCT(
                TRUE AS flatten_json_output,
                '{"generationConfig":{"temperature":0.0,"maxOutputTokens":8192,"responseMimeType":"application/json","responseSchema":{"type":"OBJECT","properties":{"events":{"type":"ARRAY","items":{"type":"OBJECT","properties":{"event_date":{"type":"STRING"},"event_time":{"type":"STRING","nullable":true},"event_title":{"type":"STRING"},"event_description":{"type":"STRING"}},"required":["event_date","event_title","event_description"]}}}}}}' AS model_params  -- noqa: LT05
            )
        )
    WHERE ml_generate_text_status = ''
),

unnested AS (
    SELECT
        g.document_id,
        JSON_VALUE(ev, '$.event_date') AS event_date_str,
        JSON_VALUE(ev, '$.event_time') AS event_time_str,
        JSON_VALUE(ev, '$.event_title') AS event_title,
        JSON_VALUE(ev, '$.event_description') AS event_description
    FROM generated AS g, UNNEST(JSON_QUERY_ARRAY(g.ml_generate_text_llm_result, '$.events')) AS ev
)

SELECT
    document_id,
    event_title,
    event_description,
    TO_HEX(MD5(CONCAT(document_id, event_date_str, COALESCE(event_time_str, ''), event_title))) AS event_id,
    SAFE.PARSE_DATE('%Y-%m-%d', event_date_str) AS event_date,
    IF(event_time_str IS NOT NULL, SAFE.PARSE_TIME('%H:%M', event_time_str), NULL) AS event_time,
    CURRENT_TIMESTAMP() AS extracted_at
FROM unnested
WHERE
    SAFE.PARSE_DATE('%Y-%m-%d', event_date_str) IS NOT NULL
    AND TRIM(event_title) != ''
