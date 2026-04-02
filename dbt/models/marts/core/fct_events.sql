{{
    config(
        materialized='incremental',
        unique_key='event_id',
        incremental_strategy='merge',
        partition_by={"field": "event_date", "data_type": "date"},
        cluster_by=["document_id"]
    )
}}

-- fct_events v2 の改善点:
--   - dim_documents.publish_date をプロンプトに渡し、年の推定精度を向上
--   - 和暦→西暦変換ルールを明示
--   - 期間イベントを開始/終了の複数イベントに分割する指示を追加
--   - Few-shot 例を追加
--   - thinkingBudget を 0 に戻す（プロンプト詳細化により不要と判断、コスト削減）
--     ※ docs/design/02_pdf_parsing.md の「Thinking無効化」方針に準拠

WITH source AS (  -- noqa: ST03
    SELECT
        s.document_id,
        CONCAT(
            -- [1] 文書の発行日を冒頭に明示して年推定の根拠を与える
            '# 文書情報\n',
            'この文書の発行日: ',
            FORMAT_DATE(
                '%Y年%m月%d日',
                COALESCE(d.publish_date, DATE(s.updated_at))
            ),
            '\n\n',
            -- [2] 和暦→西暦変換ルールを明示
            '# 和暦→西暦変換ルール\n',
            '令和元年=2019年、令和2年=2020年、令和3年=2021年、令和4年=2022年、',
            '令和5年=2023年、令和6年=2024年、令和7年=2025年、令和8年=2026年、令和9年=2027年\n\n',
            'PDFから日付が指定されたイベントや予定を全て抽出してください。\n',
            '\n',
            '# 抽出条件\n',
            '以下のキーワードが出現する場合は特に予定に関する記述である可能性が高いです。\n',
            '来月、日時、行事予定、日にち、令和、提出\n\n',
            -- [3] 年の補完ルールを追加
            '# 年の補完ルール\n',
            '月日のみ（例: 「4月7日」）の記述は文書発行日の年を基準に西暦年を補完してください。\n',
            '発行月より大幅に前の月（例: 発行が3月なのに「12月」）は前年または翌年を検討してください。\n\n',
            -- [4] 期間イベントの分割指示を追加
            '# 期間イベントの扱い\n',
            '「〇月△日〜□月▽日まで春休み」のような期間の記述は以下のように別々のイベントとして抽出してください:\n',
            '- 開始日: タイトルを「{行事名} 開始」とする\n',
            '- 終了日: タイトルを「{行事名} 終了」とする\n\n',
            '# 除外条件\n',
            '以下の条件に該当する場合は抽出から除外してください。\n',
            '- 日次の保育内容の表\n',
            '- 各クラス出席停止人数の表\n',
            '\n',
            '# 出力条件\n',
            '- event_date は必ず YYYY-MM-DD 形式（西暦）で出力してください。\n',
            '- 時刻が明記されている場合はevent_timeをHH:MM形式（24時間）で抽出してください。時刻がない場合はnullにしてください。\n\n',
            -- [5] Few-shot 例を追加
            '# 抽出例\n',
            '入力: 「春休みは3月17日(火)から4月4日(土)まで。4月7日(火)より半日保育で保育開始。」\n',
            '発行日が 2026-03-01 の場合の出力例:\n',
            '{"events": [\n',
            '  {"event_date": "2026-03-17", "event_time": null, "event_title": "春休み 開始", "event_description": "春休み開始（3/17〜4/4）"},\n',
            '  {"event_date": "2026-04-04", "event_time": null, "event_title": "春休み 終了", "event_description": "春休み終了（3/17〜4/4）"},\n',
            '  {"event_date": "2026-04-07", "event_time": null, "event_title": "保育開始（半日保育）", "event_description": "在園児の保育開始。4月7日(火)より半日保育。"}\n',
            ']}\n\n',
            '# 抽出対象テキスト\n',
            s.extracted_markdown
        ) AS prompt
    FROM {{ ref('stg_pdf_uploads__extracted_texts') }} AS s
    -- dim_documents から発行日を取得（まだ処理されていない文書は NULL → updated_at にフォールバック）
    LEFT JOIN {{ ref('dim_documents') }} AS d ON s.document_id = d.document_id
    {% if is_incremental() %}
        WHERE s.document_id NOT IN (SELECT DISTINCT document_id FROM {{ this }})  -- noqa: RF02
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
                        "events": {
                          "type": "ARRAY",
                          "items": {
                            "type": "OBJECT",
                            "properties": {
                              "event_date": {
                                "type": "STRING"
                              },
                              "event_time": {
                                "type": "STRING",
                                "nullable": true
                              },
                              "event_title": {
                                "type": "STRING"
                              },
                              "event_description": {
                                "type": "STRING"
                              }
                            },
                            "required": ["event_date", "event_title", "event_description"]
                          }
                        }
                      }
                    }
                  }
                }
                ''' AS model_params
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
