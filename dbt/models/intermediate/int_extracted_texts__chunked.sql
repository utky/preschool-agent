{{
    config(
        materialized='ephemeral'
    )
}}

WITH source AS (
    SELECT
        uri,
        extracted_markdown,
        content_type,
        size,
        md5_hash,
        updated_at,
        TO_HEX(MD5(uri)) AS document_id,
        LENGTH(extracted_markdown) AS text_length
    FROM {{ ref('stg_pdf_uploads__extracted_texts') }}
),

chunk_indices AS (
    SELECT
        source.*,
        chunk_index
    FROM source,
    UNNEST(
        GENERATE_ARRAY(0, CAST(FLOOR(text_length / 2000) AS INT64))
    ) AS chunk_index
)

SELECT
    document_id,
    TO_HEX(MD5(CONCAT(uri, CAST(chunk_index AS STRING)))) AS chunk_id,
    uri,
    chunk_index,
    CASE
        -- 最後のチャンク: 残り全部
        WHEN (chunk_index + 1) * 2000 >= text_length
            THEN SUBSTR(extracted_markdown, chunk_index * 2000 + 1)
        -- 句点（。）で区切れる場合: 最後の句点の直後まで
        WHEN INSTR(
            REVERSE(SUBSTR(extracted_markdown, chunk_index * 2000 + 1, 2000)),
            '。'
        ) > 0
            THEN SUBSTR(
                extracted_markdown,
                chunk_index * 2000 + 1,
                2000 - INSTR(
                    REVERSE(SUBSTR(extracted_markdown, chunk_index * 2000 + 1, 2000)),
                    '。'
                ) + 1
            )
        -- 句点がない場合: そのまま2000文字で切る
        ELSE SUBSTR(extracted_markdown, chunk_index * 2000 + 1, 2000)
    END AS chunk_text,
    content_type,
    size,
    md5_hash,
    updated_at
FROM chunk_indices
