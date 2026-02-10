-- チャンクIDの重複がないことを検証する
SELECT
    chunk_id,
    COUNT(*) AS cnt
FROM {{ ref('fct_document_chunks') }}
GROUP BY chunk_id
HAVING COUNT(*) > 1
