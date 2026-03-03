{{ config(materialized='table') }}

-- イベントに同期状態を結合したマート（exp_api__events 向け）
-- ビジネスロジック: 未来のイベント OR 未同期イベントのみ対象
SELECT
    e.event_id,
    e.document_id,
    e.event_date,
    e.event_time,
    e.event_title,
    e.event_description,
    e.extracted_at,
    d.title         AS document_title,
    d.document_type,
    d.publish_date,
    h.calendar_event_id,
    h.synced_at
FROM {{ ref('fct_events') }} e
LEFT JOIN {{ ref('dim_documents') }} d
    ON e.document_id = d.document_id
LEFT JOIN {{ ref('fct_calendar_sync_history') }} h
    ON e.event_id = h.event_id
WHERE
    e.event_date >= CURRENT_DATE()   -- 未来のイベント
    OR h.event_id IS NULL            -- OR 未同期イベント（同期失敗フォロー用）
ORDER BY e.event_date ASC
