{{
    config(
        materialized='incremental',
        unique_key='document_id',
        incremental_strategy='merge',
        partition_by={
            "field": "publish_date",
            "data_type": "date"
        },
        cluster_by=["document_type"]
    )
}}

-- 文書種別ルールを GCS 外部テーブルから集約してプロンプト文字列を生成
-- ※ JSON schema の enum 値は document_type_rules.document_type と一致させること
WITH rules_agg AS (
    SELECT
        STRING_AGG(
            CONCAT('- ', document_type, ': ', description),
            '\n'
            ORDER BY sort_order
        ) AS rules_text
    FROM {{ source('config', 'document_type_rules') }}
),

source AS (
    -- 新規文書のみ（incremental 時）
    SELECT
        c.document_id,
        c.uri,
        COALESCE(fm.original_filename, REGEXP_EXTRACT(c.uri, r'/([^/]+)$')) AS title,
        COUNT(*) AS total_chunks,
        MAX(c.content_type) AS content_type,
        MAX(c.size) AS size,
        MAX(c.md5_hash) AS md5_hash,
        MAX(c.updated_at) AS updated_at,
        -- GCS 外部テーブルから動的に構築した分類ルールをプロンプトに埋め込む
        CONCAT(
            '以下のファイル名から幼稚園・保育園の文書種別と発行日を判定してください。\n',
            'ファイル名: ', COALESCE(fm.original_filename, REGEXP_EXTRACT(c.uri, r'/([^/]+)$')), '\n\n',
            '文書種別の定義:\n',
            r.rules_text
        ) AS prompt
    FROM {{ ref('int_extracted_texts__chunked') }} c
    LEFT JOIN {{ ref('stg_pdf_uploads__extracted_texts') }} fm ON c.uri = fm.uri
    CROSS JOIN rules_agg r
    {% if is_incremental() %}
    WHERE c.document_id NOT IN (SELECT DISTINCT document_id FROM {{ this }})
    {% endif %}
    GROUP BY c.document_id, c.uri, fm.original_filename, r.rules_text
),

generated AS (
    SELECT
        document_id,
        uri,
        title,
        total_chunks,
        content_type,
        size,
        md5_hash,
        updated_at,
        ml_generate_text_llm_result,
        ml_generate_text_status
    FROM ML.GENERATE_TEXT(
        MODEL `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.gemini_flash_model`,
        TABLE source,
        STRUCT(
            TRUE AS flatten_json_output,
            -- enum 値は GCS 外部テーブル document_type_rules の document_type カラムと一致させること
            '{"generationConfig":{"temperature":0.0,"maxOutputTokens":256,"responseMimeType":"application/json","responseSchema":{"type":"OBJECT","properties":{"document_type":{"type":"STRING","enum":["journal","photo_album","monthly_announcement","monthly_lunch_schedule","monthly_lunch_info","uncategorized"]},"publish_date":{"type":"STRING","nullable":true}},"required":["document_type"]}}}' AS model_params
        )
    )
    WHERE ml_generate_text_status = ''
)

SELECT
    document_id,
    uri,
    title,
    JSON_VALUE(ml_generate_text_llm_result, '$.document_type') AS document_type,
    SAFE.PARSE_DATE('%Y-%m-%d',
        JSON_VALUE(ml_generate_text_llm_result, '$.publish_date')) AS publish_date,
    content_type,
    size,
    md5_hash,
    total_chunks,
    updated_at
FROM generated
