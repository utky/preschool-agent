{{
    config(
        materialized='table',
        post_hook=[
            "EXPORT DATA OPTIONS(uri='gs://{{ var(\"api_data_bucket_name\") }}/events/*.json', format='JSON', overwrite=true) AS SELECT event_id, document_id, CAST(event_date AS STRING) AS event_date, event_type, event_title, event_description, CAST(extracted_at AS STRING) AS extracted_at, is_synced, calendar_event_id, CAST(synced_at AS STRING) AS synced_at FROM {{ this }}"
        ]
    )
}}

SELECT
    e.event_id,
    e.document_id,
    e.event_date,
    e.event_type,
    e.event_title,
    e.event_description,
    e.extracted_at,
    h.event_id IS NOT NULL AS is_synced,
    h.calendar_event_id,
    h.synced_at
FROM {{ ref('events') }} e
LEFT JOIN {{ ref('calendar_sync_history') }} h ON e.event_id = h.event_id
WHERE e.event_date >= CURRENT_DATE()   -- 未来のイベント
   OR h.event_id IS NULL               -- OR 未同期イベント（同期失敗フォロー用）
ORDER BY e.event_date ASC
