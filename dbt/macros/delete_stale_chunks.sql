{% macro delete_stale_chunks() %}
  {% if is_incremental() %}
  -- md5_hash が変わった文書の旧チャンクを全削除（チャンク数減少による orphan チャンクも含む）
  DELETE FROM {{ this }}
  WHERE document_id IN (
    SELECT DISTINCT s.document_id
    FROM {{ ref('stg_pdf_uploads__extracted_texts') }} AS s
    WHERE s.uri IN (SELECT DISTINCT uri FROM {{ this }})
    AND NOT EXISTS (
        SELECT 1
        FROM {{ this }} AS t
        WHERE t.uri = s.uri
            AND t.md5_hash = s.md5_hash
    )
  )
  {% endif %}
{% endmacro %}
