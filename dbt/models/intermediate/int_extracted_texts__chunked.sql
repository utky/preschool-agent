{{
    config(
        materialized='ephemeral'
    )
}}

-- Markdown構造を意識した階層チャンク分割
-- Level A: ## / ### 見出しで分割
-- Level B: セクション内を \n\n（段落境界）で分割
-- Level C: 1500文字超の段落を句点（。）で分割
-- Rule D: 表（|で始まる行ブロック）は分割しない

WITH source AS (
    SELECT
        uri,
        -- 改行を正規化（\r\n → \n）
        REGEXP_REPLACE(extracted_markdown, r'\r\n', '\n') AS extracted_markdown,
        content_type,
        size,
        md5_hash,
        updated_at,
        document_id
    FROM {{ ref('stg_pdf_uploads__extracted_texts') }}
),

-- Level A: 見出し（## / ###）でセクション分割
-- sentinelを挿入してSPLITする
heading_sections AS (
    SELECT
        document_id,
        uri,
        content_type,
        size,
        md5_hash,
        updated_at,
        section_index,
        TRIM(section_text) AS section_text
    FROM source,
    UNNEST(
        SPLIT(
            REGEXP_REPLACE(
                CONCAT('\n', extracted_markdown),
                r'\n(#{1,3} )',
                '\n<<<HSPLIT>>>\n\\1'
            ),
            '<<<HSPLIT>>>'
        )
    ) AS section_text WITH OFFSET AS section_index
    WHERE TRIM(section_text) != ''
),

-- Level B: セクション内を \n\n（段落境界）で分割
section_paragraphs AS (
    SELECT
        document_id,
        uri,
        content_type,
        size,
        md5_hash,
        updated_at,
        section_index,
        para_index,
        TRIM(paragraph) AS paragraph
    FROM heading_sections,
    UNNEST(SPLIT(section_text, '\n\n')) AS paragraph WITH OFFSET AS para_index
    WHERE TRIM(paragraph) != ''
),

-- Rule D: テーブル行（|で始まる段落）を判定し、gap-and-island で連続テーブル行をグルーピング
classified_paragraphs AS (
    SELECT
        *,
        CASE
            WHEN REGEXP_CONTAINS(LTRIM(paragraph), r'^\|') THEN 'table'
            ELSE 'text'
        END AS block_type
    FROM section_paragraphs
),

-- 前の行と種別が変わったらisland境界
island_lag AS (
    SELECT
        *,
        CASE
            WHEN block_type != LAG(block_type, 1, '') OVER (
                PARTITION BY document_id, section_index
                ORDER BY para_index
            ) THEN 1
            ELSE 0
        END AS is_new_island
    FROM classified_paragraphs
),

island_boundaries AS (
    SELECT
        *,
        SUM(is_new_island) OVER (
            PARTITION BY document_id, section_index
            ORDER BY para_index
        ) AS island_id
    FROM island_lag
),

-- 同一islandの段落をマージ（テーブル行は\nで結合、テキストは\n\nで結合）
merged_blocks AS (
    SELECT
        document_id,
        uri,
        content_type,
        size,
        md5_hash,
        updated_at,
        section_index,
        island_id,
        block_type,
        MIN(para_index) AS block_order,
        CASE
            WHEN block_type = 'table'
                THEN STRING_AGG(paragraph, '\n' ORDER BY para_index)
            ELSE STRING_AGG(paragraph, '\n\n' ORDER BY para_index)
        END AS block_text
    FROM island_boundaries
    GROUP BY document_id, uri, content_type, size, md5_hash, updated_at,
             section_index, island_id, block_type
),

-- Level C: 1500文字超のテキストブロックを句点（。）で分割、テーブルはそのまま保持
final_chunks AS (
    -- テーブルブロック、または1500文字以下のテキスト → そのまま
    SELECT
        document_id,
        uri,
        content_type,
        size,
        md5_hash,
        updated_at,
        section_index,
        block_order,
        0 AS sub_index,
        block_text AS chunk_text
    FROM merged_blocks
    WHERE block_type = 'table' OR LENGTH(block_text) <= 1500

    UNION ALL

    -- 1500文字超のテキスト → 句点（。）で分割
    SELECT
        document_id,
        uri,
        content_type,
        size,
        md5_hash,
        updated_at,
        section_index,
        block_order,
        sentence_offset AS sub_index,
        TRIM(sentence) AS chunk_text
    FROM merged_blocks,
    UNNEST(SPLIT(block_text, '。')) AS sentence WITH OFFSET AS sentence_offset
    WHERE block_type = 'text'
        AND LENGTH(block_text) > 1500
        AND TRIM(sentence) != ''
),

-- 句点分割した断片を再結合して1500文字以内のチャンクにまとめる
-- 句点で分割しただけだと細かすぎるので、累積長で再グルーピング
sentence_groups AS (
    SELECT
        *,
        -- 句点分割されたもの（sub_index > 0 があるブロック）だけ再グルーピング
        SUM(
            CASE
                -- 累積長が1500を超えたら新グループ開始
                WHEN cumulative_len > 1500 AND prev_cumulative_len <= 1500 THEN 1
                WHEN cumulative_len > 1500 AND prev_cumulative_len > 1500 THEN 1
                ELSE 0
            END
        ) OVER (
            PARTITION BY document_id, section_index, block_order
            ORDER BY sub_index
        ) AS sentence_group_id
    FROM (
        SELECT
            *,
            SUM(LENGTH(chunk_text) + 1) OVER (
                PARTITION BY document_id, section_index, block_order
                ORDER BY sub_index
            ) AS cumulative_len,
            COALESCE(
                SUM(LENGTH(chunk_text) + 1) OVER (
                    PARTITION BY document_id, section_index, block_order
                    ORDER BY sub_index
                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ),
                0
            ) AS prev_cumulative_len
        FROM final_chunks
        WHERE sub_index > 0 OR (sub_index = 0 AND section_index >= 0)
    )
),

reaggregated_chunks AS (
    SELECT
        document_id,
        uri,
        content_type,
        size,
        md5_hash,
        updated_at,
        section_index,
        block_order,
        sentence_group_id,
        MIN(sub_index) AS first_sub_index,
        -- 句点分割されたものは「。」付きで再結合
        CASE
            WHEN MAX(sub_index) > 0
                THEN STRING_AGG(chunk_text, '。' ORDER BY sub_index)
            ELSE MAX(chunk_text)
        END AS chunk_text
    FROM sentence_groups
    GROUP BY document_id, uri, content_type, size, md5_hash, updated_at,
             section_index, block_order, sentence_group_id
),

-- document_id ごとに連番 chunk_index 付与
numbered_chunks AS (
    SELECT
        document_id,
        uri,
        content_type,
        size,
        md5_hash,
        updated_at,
        chunk_text,
        ROW_NUMBER() OVER (
            PARTITION BY document_id
            ORDER BY section_index, block_order, sentence_group_id
        ) - 1 AS chunk_index
    FROM reaggregated_chunks
    WHERE TRIM(chunk_text) != ''
        AND LENGTH(TRIM(chunk_text)) >= 10
)

SELECT
    document_id,
    TO_HEX(MD5(CONCAT(document_id, CAST(chunk_index AS STRING)))) AS chunk_id,
    uri,
    chunk_index,
    chunk_text,
    content_type,
    size,
    md5_hash,
    updated_at
FROM numbered_chunks
