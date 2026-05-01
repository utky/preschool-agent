-- split_by_headings UDF の単体テスト
-- 各パターンで正しいセクション数に分割されることを確認する
-- 行が返れば失敗（dbtデータテスト規約）
WITH test_cases AS (
    SELECT
        '## 見出し（既存機能）' AS test_name,
        2 AS expected_sections,
        ARRAY_LENGTH(
            `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.split_by_headings`(
                'イントロ\n## セクション'
            )
        ) AS actual_sections
    UNION ALL
    SELECT
        '● 見出し' AS test_name,
        2 AS expected_sections,
        ARRAY_LENGTH(
            `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.split_by_headings`(
                'イントロ\n●セクション'
            )
        ) AS actual_sections
    UNION ALL
    SELECT
        '▶ 見出し' AS test_name,
        2 AS expected_sections,
        ARRAY_LENGTH(
            `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.split_by_headings`(
                'イントロ\n▶イベント'
            )
        ) AS actual_sections
    UNION ALL
    SELECT
        '*短文* 見出し' AS test_name,
        2 AS expected_sections,
        ARRAY_LENGTH(
            `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.split_by_headings`(
                'イントロ\n*見出し*\nコンテンツ'
            )
        ) AS actual_sections
    UNION ALL
    SELECT
        '連続する ● ブロック' AS test_name,
        3 AS expected_sections,
        ARRAY_LENGTH(
            `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.split_by_headings`(
                'イントロ\n●最初\n●次'
            )
        ) AS actual_sections
)

SELECT
    test_name,
    expected_sections,
    actual_sections
FROM test_cases
WHERE expected_sections != actual_sections
