-- Step 2: 文書種別分類の比較（dim_documents 相当）
-- SELECT のみ。テーブルへの書き込みなし。
-- 評価基準: type_match = TRUE の割合が 80% 以上

WITH rules_agg AS (
  SELECT
    STRING_AGG(
      CONCAT('- ', document_type, ': ', description),
      '\n'
      ORDER BY sort_order
    ) AS rules_text
  FROM `lofilab.school_agent.document_type_rules`
),

sample AS (
  SELECT
    s.document_id,
    s.uri,
    s.original_filename,
    CONCAT(
      '以下のファイル名から幼稚園・保育園の文書種別と発行日を判定してください。\n',
      'ファイル名: ', COALESCE(s.original_filename, REGEXP_EXTRACT(s.uri, r'/([^/]+)$')), '\n\n',
      '文書種別の定義:\n',
      r.rules_text
    ) AS prompt
  FROM `lofilab.school_agent.stg_pdf_uploads__extracted_texts` AS s
  CROSS JOIN rules_agg AS r
  LIMIT 10
),

result_flash AS (
  SELECT document_id, ml_generate_text_llm_result AS flash_result
  FROM ML.GENERATE_TEXT(
    MODEL `lofilab.school_agent.gemini_flash_model`,
    TABLE sample,
    STRUCT(
      TRUE AS flatten_json_output,
      '''
      {
        "generationConfig": {
          "temperature": 0.0,
          "maxOutputTokens": 256,
          "thinkingConfig": {"thinkingBudget": 0},
          "responseMimeType": "application/json",
          "responseSchema": {
            "type": "OBJECT",
            "properties": {
              "document_type": {
                "type": "STRING",
                "enum": ["journal","photo_album","monthly_announcement","monthly_lunch_schedule","monthly_lunch_info","uncategorized"]
              },
              "publish_date": {"type": "STRING", "nullable": true}
            },
            "required": ["document_type"]
          }
        }
      }
      ''' AS model_params
    )
  )
  WHERE ml_generate_text_status = ''
),

result_lite AS (
  SELECT document_id, ml_generate_text_llm_result AS lite_result
  FROM ML.GENERATE_TEXT(
    MODEL `lofilab.school_agent.gemini_flash_lite_model`,
    TABLE sample,
    STRUCT(
      TRUE AS flatten_json_output,
      '''
      {
        "generationConfig": {
          "temperature": 0.0,
          "maxOutputTokens": 256,
          "thinkingConfig": {"thinkingBudget": 0},
          "responseMimeType": "application/json",
          "responseSchema": {
            "type": "OBJECT",
            "properties": {
              "document_type": {
                "type": "STRING",
                "enum": ["journal","photo_album","monthly_announcement","monthly_lunch_schedule","monthly_lunch_info","uncategorized"]
              },
              "publish_date": {"type": "STRING", "nullable": true}
            },
            "required": ["document_type"]
          }
        }
      }
      ''' AS model_params
    )
  )
  WHERE ml_generate_text_status = ''
)

SELECT
  s.document_id,
  s.original_filename,
  JSON_VALUE(f.flash_result, '$.document_type') AS flash_type,
  JSON_VALUE(f.flash_result, '$.publish_date')  AS flash_date,
  JSON_VALUE(l.lite_result,  '$.document_type') AS lite_type,
  JSON_VALUE(l.lite_result,  '$.publish_date')  AS lite_date,
  JSON_VALUE(f.flash_result, '$.document_type') = JSON_VALUE(l.lite_result, '$.document_type') AS type_match
FROM sample AS s
JOIN result_flash AS f USING (document_id)
JOIN result_lite  AS l USING (document_id)
ORDER BY type_match ASC, s.document_id;
