{{
    config(
        materialized='table',
        post_hook=[
            "EXPORT DATA OPTIONS(uri='gs://{{ var(\"api_data_bucket_name\") }}/events/*.json', format='JSON', overwrite=true) AS SELECT * FROM {{ this }}"
        ]
    )
}}

-- API向けイベントエクスポート（GCS出力用）
-- JOIN・フィルタは fct_events_with_sync で完結させ、ここでは書式変換のみ行う
SELECT
    event_id,
    document_id,
    FORMAT_DATE('%Y-%m-%d', event_date)                           AS event_date,
    IF(event_time IS NOT NULL, FORMAT_TIME('%H:%M', event_time), NULL) AS event_time,
    event_title,
    event_description,
    document_title,
    calendar_event_id,
    IF(synced_at IS NOT NULL, FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', synced_at), NULL) AS synced_at
FROM {{ ref('fct_events_with_sync') }}
