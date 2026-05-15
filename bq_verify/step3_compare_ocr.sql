-- Step 3: OCR 品質の比較（stg_pdf_uploads__extracted_texts 相当）
-- SELECT のみ。テーブルへの書き込みなし。
-- 評価基準: 出力長の差 ≤ 20%、プレビューを目視で確認

WITH sample AS (
  SELECT *
  FROM `lofilab.school_agent.raw_documents`
  WHERE content_type = 'application/pdf'
  LIMIT 3
),

result_flash AS (
  SELECT
    uri,
    ml_generate_text_llm_result AS flash_result,
    ml_generate_text_status      AS flash_status
  FROM ML.GENERATE_TEXT(
    MODEL `lofilab.school_agent.gemini_flash_model`,
    (SELECT * FROM sample),
    STRUCT(
      'あなたはPDFドキュメントのテキスト抽出専門家です。PDFに含まれる実際の文書コンテンツのみをMarkdown形式で抽出してください。\n\n## 抽出ルール\n- 見出し（H1〜H3）、箇条書き、番号付きリスト、表はMarkdown記法で再現する\n- 太字・斜体などの強調は適切なMarkdown記法を使う\n- 段落間には空行を入れる\n\n## 除外・無視するもの\n- 「start of OCR」「end of OCR」などのOCR処理マーカー\n- ページ番号・ヘッダー・フッターの繰り返し要素\n- 文書の内容と無関係なメタデータ・処理コメント\n- スキャン品質情報・ファイル情報などの技術的ノイズ\n\n## 出力形式\n整形されたMarkdownテキストのみを出力する。説明文や前置き（「以下が抽出内容です」など）は不要。' AS prompt,
      TRUE AS flatten_json_output,
      '''
      {
        "generationConfig": {
          "temperature": 0.0,
          "maxOutputTokens": 8192,
          "thinkingConfig": {"thinkingBudget": 0},
          "responseMimeType": "application/json",
          "responseSchema": {
            "type": "OBJECT",
            "properties": {
              "extracted_markdown": {
                "type": "STRING",
                "description": "PDFから抽出したMarkdown形式のテキスト"
              }
            },
            "required": ["extracted_markdown"]
          }
        }
      }
      ''' AS model_params
    )
  )
),

result_lite AS (
  SELECT
    uri,
    ml_generate_text_llm_result AS lite_result,
    ml_generate_text_status      AS lite_status
  FROM ML.GENERATE_TEXT(
    MODEL `lofilab.school_agent.gemini_flash_lite_model`,
    (SELECT * FROM sample),
    STRUCT(
      'あなたはPDFドキュメントのテキスト抽出専門家です。PDFに含まれる実際の文書コンテンツのみをMarkdown形式で抽出してください。\n\n## 抽出ルール\n- 見出し（H1〜H3）、箇条書き、番号付きリスト、表はMarkdown記法で再現する\n- 太字・斜体などの強調は適切なMarkdown記法を使う\n- 段落間には空行を入れる\n\n## 除外・無視するもの\n- 「start of OCR」「end of OCR」などのOCR処理マーカー\n- ページ番号・ヘッダー・フッターの繰り返し要素\n- 文書の内容と無関係なメタデータ・処理コメント\n- スキャン品質情報・ファイル情報などの技術的ノイズ\n\n## 出力形式\n整形されたMarkdownテキストのみを出力する。説明文や前置き（「以下が抽出内容です」など）は不要。' AS prompt,
      TRUE AS flatten_json_output,
      '''
      {
        "generationConfig": {
          "temperature": 0.0,
          "maxOutputTokens": 8192,
          "thinkingConfig": {"thinkingBudget": 0},
          "responseMimeType": "application/json",
          "responseSchema": {
            "type": "OBJECT",
            "properties": {
              "extracted_markdown": {
                "type": "STRING",
                "description": "PDFから抽出したMarkdown形式のテキスト"
              }
            },
            "required": ["extracted_markdown"]
          }
        }
      }
      ''' AS model_params
    )
  )
)

SELECT
  f.uri,
  LENGTH(JSON_VALUE(f.flash_result, '$.extracted_markdown'))                       AS flash_len,
  LENGTH(JSON_VALUE(l.lite_result,  '$.extracted_markdown'))                       AS lite_len,
  ROUND(
    ABS(
      LENGTH(JSON_VALUE(f.flash_result, '$.extracted_markdown')) -
      LENGTH(JSON_VALUE(l.lite_result,  '$.extracted_markdown'))
    ) / NULLIF(LENGTH(JSON_VALUE(f.flash_result, '$.extracted_markdown')), 0),
    3
  )                                                                                AS length_diff_ratio,
  -- 差が 20% 以内なら TRUE
  ABS(
    LENGTH(JSON_VALUE(f.flash_result, '$.extracted_markdown')) -
    LENGTH(JSON_VALUE(l.lite_result,  '$.extracted_markdown'))
  ) / NULLIF(LENGTH(JSON_VALUE(f.flash_result, '$.extracted_markdown')), 0) < 0.2 AS length_ok,
  LEFT(JSON_VALUE(f.flash_result, '$.extracted_markdown'), 500)                   AS flash_preview,
  LEFT(JSON_VALUE(l.lite_result,  '$.extracted_markdown'), 500)                   AS lite_preview
FROM result_flash AS f
JOIN result_lite  AS l USING (uri)
WHERE f.flash_status = '' AND l.lite_status = ''
ORDER BY length_diff_ratio DESC;
