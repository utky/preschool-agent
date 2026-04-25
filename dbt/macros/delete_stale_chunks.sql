{% macro delete_stale_chunks() %}
  {% if is_incremental() %}
  -- md5_hash が変わった文書の旧チャンクを全削除（チャンク数減少による orphan チャンクも含む）
  DELETE FROM {{ this }}
  WHERE document_id IN (
    SELECT DISTINCT s.document_id
    FROM {{ ref('stg_pdf_uploads__extracted_texts') }} AS s
    WHERE s.uri IN (SELECT DISTINCT uri FROM {{ this }})
    AND (s.uri, s.md5_hash) NOT IN (
        SELECT DISTINCT uri, md5_hash FROM {{ this }}
    )
  )
  {% endif %}
{% endmacro %}
