{{
    config(
        materialized='incremental',
        unique_key='uri',
        incremental_strategy='merge',
        partition_by={
            "field": "updated_at",
            "data_type": "timestamp"
        },
        cluster_by=["uri"]
    )
}}

WITH generated AS (
    SELECT
        uri,
        content_type,
        size,
        md5_hash,
        metadata,
        updated,
        ml_generate_text_llm_result,
        ml_generate_text_status
    FROM ML.GENERATE_TEXT(
        model `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.gemini_flash_model`,
        (
            SELECT *
            FROM {{ source('pdf_uploads', 'raw_documents') }}
            WHERE
                content_type = 'application/pdf'
                {% if var('start_datetime', none) is not none and var('end_datetime', none) is not none %}

                    -- Object Table の述語プッシュダウンを活用するため updated でスキャン範囲を絞る
                    -- modified_gmt（WordPress更新日時）と updated（GCSアップロード時刻）のズレを考慮して +1日のバッファを持たせる
                    AND updated >= TIMESTAMP('{{ var("start_datetime") }}')
                    AND updated < TIMESTAMP_ADD(TIMESTAMP('{{ var("end_datetime") }}'), INTERVAL 1 DAY)
                    -- updated_at カラムの定義と一致させるため modified_gmt 優先で正確な時間ウィンドウ判定を行う
                    AND COALESCE(
                        TIMESTAMP((SELECT value FROM UNNEST(metadata) WHERE name = 'modified_gmt')),
                        updated
                    ) >= TIMESTAMP('{{ var("start_datetime") }}')
                    AND COALESCE(
                        TIMESTAMP((SELECT value FROM UNNEST(metadata) WHERE name = 'modified_gmt')),
                        updated
                    ) < TIMESTAMP('{{ var("end_datetime") }}')

                {% endif %}
                {% if is_incremental() %}
                    AND uri NOT IN (SELECT existing.uri FROM {{ this }} AS existing)
                {% endif %}
        ),
        STRUCT(
            'あなたはPDFドキュメントのテキスト抽出専門家です。PDFに含まれる実際の文書コンテンツのみをMarkdown形式で抽出してください。\n\n## 抽出ルール\n- 見出し（H1〜H3）、箇条書き、番号付きリスト、表はMarkdown記法で再現する\n- 太字・斜体などの強調は適切なMarkdown記法を使う\n- 段落間には空行を入れる\n\n## 除外・無視するもの\n- 「start of OCR」「end of OCR」などのOCR処理マーカー\n- ページ番号・ヘッダー・フッターの繰り返し要素\n- 文書の内容と無関係なメタデータ・処理コメント\n- スキャン品質情報・ファイル情報などの技術的ノイズ\n\n## 出力形式\n整形されたMarkdownテキストのみを出力する。説明文や前置き（「以下が抽出内容です」など）は不要。' AS prompt,  -- noqa: LT05
            TRUE AS flatten_json_output,
            '''
            {
              "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": 8192,
                "thinkingConfig": {
                  "thinkingBudget": 0
                },
                "responseMimeType": "application/json",
                "responseSchema": {
                  "type": "OBJECT",
                  "properties": {
                    "extracted_markdown": {
                      "type": "STRING",
                      "description": "PDFから抽出したMarkdown形式のテキスト"
                    }
                  },
                  "required": [
                    "extracted_markdown"
                  ]
                }
              }
            }
            ''' AS model_params
        )
    )
)

SELECT
    uri,
    COALESCE(
        -- GAS（Google Drive）アップロード: drive-file-idを使用
        (
            SELECT value FROM UNNEST(metadata)
            WHERE name = 'drive-file-id'
        ),
        -- クローラー（WordPress）アップロード: WordPressメディアIDを使用
        (
            SELECT value FROM UNNEST(metadata)
            WHERE name = 'media-id'
        )
    ) AS document_id,
    `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.url_decode`(
        (
            SELECT value FROM UNNEST(metadata)
            WHERE name = 'original-filename'
        )
    ) AS original_filename,
    JSON_VALUE(ml_generate_text_llm_result, '$.extracted_markdown')
        AS extracted_markdown,
    ml_generate_text_llm_result,
    ml_generate_text_status,
    content_type,
    size,
    md5_hash,
    COALESCE(
        TIMESTAMP(
            (
                SELECT value FROM UNNEST(metadata)
                WHERE name = 'modified_gmt'
            )
        ),
        updated
    ) AS updated_at
FROM generated
WHERE
    ml_generate_text_status = ''
    AND JSON_VALUE(
        ml_generate_text_llm_result, '$.extracted_markdown'
    ) IS NOT NULL
