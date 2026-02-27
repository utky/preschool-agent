-- バックエンドが直接 INSERT するテーブル。dbt はスキーマ管理のみ。
{{
    config(
        materialized='incremental',
        unique_key='event_id',
        incremental_strategy='merge'
    )
}}

SELECT
    CAST(NULL AS STRING) AS event_id,
    CAST(NULL AS STRING) AS calendar_event_id,
    CAST(NULL AS TIMESTAMP) AS synced_at,
    CAST(NULL AS STRING) AS synced_by
FROM (SELECT 1)
WHERE FALSE  -- dbt は何も書き込まない（バックエンドが INSERT する）
