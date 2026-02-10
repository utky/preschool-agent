{% macro chunk_text(text_column, chunk_size=2000) %}
{#
  テキストを指定サイズごとに分割する。
  句点（。）の位置で分割を調整し、文の途中で切れないようにする。
#}
WITH text_with_length AS (
    SELECT
        *,
        LENGTH({{ text_column }}) AS text_length
    FROM {{ caller() }}
),
chunk_indices AS (
    SELECT
        *,
        chunk_index
    FROM text_with_length,
    UNNEST(GENERATE_ARRAY(0, CAST(FLOOR(text_length / {{ chunk_size }}) AS INT64))) AS chunk_index
)
SELECT
    * EXCEPT(text_length, chunk_index, {{ text_column }}),
    chunk_index,
    CASE
        -- 最後のチャンク: 残り全部
        WHEN (chunk_index + 1) * {{ chunk_size }} >= text_length
            THEN SUBSTR({{ text_column }}, chunk_index * {{ chunk_size }} + 1)
        -- 句点で区切れる場合: 句点の直後まで
        WHEN STRPOS(
            SUBSTR({{ text_column }}, chunk_index * {{ chunk_size }} + 1, {{ chunk_size }}),
            '。'
        ) > 0
            THEN SUBSTR(
                {{ text_column }},
                chunk_index * {{ chunk_size }} + 1,
                {{ chunk_size }} - (
                    {{ chunk_size }} - INSTR(
                        REVERSE(SUBSTR({{ text_column }}, chunk_index * {{ chunk_size }} + 1, {{ chunk_size }})),
                        '。'
                    )
                ) + 1
            )
        -- 句点がない場合: そのまま chunk_size で切る
        ELSE SUBSTR({{ text_column }}, chunk_index * {{ chunk_size }} + 1, {{ chunk_size }})
    END AS chunk_text
FROM chunk_indices
{% endmacro %}
