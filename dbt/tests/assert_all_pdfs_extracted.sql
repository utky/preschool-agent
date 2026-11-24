-- PDF の抽出漏れを検知する（severity: warn）
-- 1. staging に抽出失敗（is_extracted = FALSE）で残っている行
-- 2. Object Table に存在するが staging に 1 行もない PDF（時間ウィンドウ漏れ）
-- error にすると dbt build が下流を skip して取り込み全体が止まるため warn とする
-- dbt Job ログの警告をログベースアラートで検知してメール通知する
{{ config(severity='warn') }}

SELECT
    stg.uri,
    'extraction_failed' AS reason,
    stg.ml_generate_text_status AS detail
FROM {{ ref('stg_pdf_uploads__extracted_texts') }} AS stg
WHERE NOT stg.is_extracted

UNION ALL

SELECT
    raw.uri,
    'not_processed' AS reason,
    CAST(NULL AS STRING) AS detail
FROM {{ source('pdf_uploads', 'raw_documents') }} AS raw
WHERE
    raw.content_type = 'application/pdf'
    AND raw.uri NOT IN (
        SELECT existing.uri FROM {{ ref('stg_pdf_uploads__extracted_texts') }} AS existing
    )
