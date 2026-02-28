-- dim_documents.document_type が document_type_rules の部分集合であることを検証
-- 行が返された場合 = 未登録の種別が dim_documents に存在する = テスト失敗
WITH actual_types AS (
    SELECT DISTINCT document_type
    FROM {{ ref('dim_documents') }}
    WHERE document_type IS NOT NULL
),
valid_types AS (
    SELECT DISTINCT document_type
    FROM {{ source('config', 'document_type_rules') }}
    WHERE document_type IS NOT NULL
)
SELECT a.document_type AS invalid_document_type
FROM actual_types a
LEFT JOIN valid_types v ON a.document_type = v.document_type
WHERE v.document_type IS NULL
