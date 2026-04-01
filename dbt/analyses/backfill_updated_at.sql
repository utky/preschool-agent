-- updated_at バックフィル（一回限り実行）
--
-- 前提: backfill-metadata.ts を実行して GCS オブジェクトに modified_gmt を設定済みであること
-- 実行順序:
--   1. このファイルの UPDATE 1 を実行
--   2. このファイルの UPDATE 2 を実行
--   3. dbt run --select exp_api__documents

-- UPDATE 1: stg_pdf_uploads__extracted_texts の updated_at を修正
-- raw_documents（GCS Object Table）から modified_gmt メタデータを読み取り、
-- COALESCE で GAS 分（modified_gmt なし）は GCS の updated にフォールバック
UPDATE
    `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.stg_pdf_uploads__extracted_texts`
        AS stg_tgt
SET
    stg_tgt.updated_at = COALESCE(
        TIMESTAMP(
            (
                SELECT value
                FROM UNNEST(src.metadata)
                WHERE name = 'modified_gmt'
            )
        ),
        src.updated
    )
FROM {{ source('pdf_uploads', 'raw_documents') }} AS src
WHERE
    stg_tgt.uri = src.uri
    AND src.content_type = 'application/pdf';

-- UPDATE 2: dim_documents の updated_at を修正
-- incremental マテリアライゼーションのため dbt run では既存行が更新されない
UPDATE
    `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.dim_documents` AS dim_tgt
SET
    dim_tgt.updated_at = stg.updated_at
FROM
    `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.stg_pdf_uploads__extracted_texts`
        AS stg
WHERE
    dim_tgt.document_id = COALESCE(
        (
            SELECT value FROM UNNEST(stg.metadata)
            WHERE name = 'media-id'
        ),
        (
            SELECT value FROM UNNEST(stg.metadata)
            WHERE name = 'drive-file-id'
        )
    );
