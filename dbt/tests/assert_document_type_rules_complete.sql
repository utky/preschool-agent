-- document_type_rules に必須の全種別が存在することを検証
-- 行が返された場合 = 不足している種別がある = テスト失敗
WITH expected_types AS (
    SELECT document_type
    FROM UNNEST([
        'journal',
        'photo_album',
        'monthly_announcement',
        'monthly_lunch_schedule',
        'monthly_lunch_info',
        'uncategorized'
    ]) AS document_type
),
actual_types AS (
    SELECT DISTINCT document_type
    FROM {{ source('config', 'document_type_rules') }}
    WHERE document_type IS NOT NULL
)
SELECT e.document_type AS missing_document_type
FROM expected_types e
LEFT JOIN actual_types a ON e.document_type = a.document_type
WHERE a.document_type IS NULL
