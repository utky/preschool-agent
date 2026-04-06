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
-- ical_content: イベントごとのiCalテキスト（フロントエンドのBlobダウンロード用）
SELECT
    event_id,
    document_id,
    event_title,
    event_description,
    document_title,
    calendar_event_id,
    FORMAT_DATE('%Y-%m-%d', event_date) AS event_date,
    IF(event_time IS NOT NULL, FORMAT_TIME('%H:%M', event_time), NULL) AS event_time,
    IF(synced_at IS NOT NULL, FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', synced_at), NULL) AS synced_at,
    CONCAT(
        'BEGIN:VCALENDAR\n',
        'VERSION:2.0\n',
        'PRODID:-//preschool-agent//EN\n',
        'CALSCALE:GREGORIAN\n',
        'BEGIN:VEVENT\n',
        'UID:', event_id, '@preschool-agent\n',
        'SUMMARY:', COALESCE(event_title, ''), '\n',
        'DESCRIPTION:', REPLACE(COALESCE(event_description, ''), '\n', '\\n'), '\n',
        IF(
            event_time IS NOT NULL,
            CONCAT(
                'DTSTART;TZID=Asia/Tokyo:', FORMAT_DATE('%Y%m%d', event_date), 'T',
                REPLACE(FORMAT_TIME('%H:%M', event_time), ':', ''), '00\n',
                'DTEND;TZID=Asia/Tokyo:', FORMAT_DATE('%Y%m%d', event_date), 'T',
                REPLACE(FORMAT_TIME('%H:%M', TIME_ADD(event_time, INTERVAL 60 MINUTE)), ':', ''), '00\n'
            ),
            CONCAT(
                'DTSTART;VALUE=DATE:', FORMAT_DATE('%Y%m%d', event_date), '\n',
                'DTEND;VALUE=DATE:', FORMAT_DATE('%Y%m%d', DATE_ADD(event_date, INTERVAL 1 DAY)), '\n'
            )
        ),
        'END:VEVENT\n',
        'END:VCALENDAR'
    ) AS ical_content
FROM {{ ref('fct_events_with_sync') }}
