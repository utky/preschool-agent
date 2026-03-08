import { BigQuery } from '@google-cloud/bigquery'
import { calendar } from '@googleapis/calendar'
import { GoogleAuth } from 'google-auth-library'
import { logger } from './logger.js'
import type { CalendarEvent, CalendarSyncResult } from '../types/events.js'

const bigquery = new BigQuery()
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'school_agent'
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || ''

/** イベント時刻に応じてGoogle Calendar start/end を構築する純粋関数 */
export const buildCalendarEventTimes = (event: CalendarEvent) => {
  if (event.event_time) {
    const startDateTime = `${event.event_date}T${event.event_time}:00+09:00`
    const startMs = new Date(startDateTime).getTime()
    const endDateTime = new Date(startMs + 60 * 60 * 1000).toISOString()
    return {
      start: { dateTime: startDateTime, timeZone: 'Asia/Tokyo' },
      end: { dateTime: endDateTime, timeZone: 'Asia/Tokyo' },
    }
  }
  // Google Calendar APIのend.dateはexclusive（翌日を指定する必要がある）
  const nextDay = new Date(event.event_date)
  nextDay.setDate(nextDay.getDate() + 1)
  const endDate = nextDay.toISOString().slice(0, 10)
  return {
    start: { date: event.event_date },
    end: { date: endDate },
  }
}

/** BigQuery から未同期イベント一覧を取得する */
export async function getUnsyncedEvents(): Promise<CalendarEvent[]> {
  const query = `
    SELECT
      e.event_id,
      e.document_id,
      d.title AS document_title,
      CAST(e.event_date AS STRING) AS event_date,
      IF(e.event_time IS NOT NULL, FORMAT_TIME('%H:%M', e.event_time), NULL) AS event_time,
      e.event_title,
      e.event_description,
      CAST(e.extracted_at AS STRING) AS extracted_at,
      h.event_id IS NOT NULL AS is_synced,
      h.calendar_event_id,
      CAST(h.synced_at AS STRING) AS synced_at
    FROM \`${DATASET_ID}.fct_events\` e
    LEFT JOIN \`${DATASET_ID}.dim_documents\` d ON e.document_id = d.document_id
    LEFT JOIN \`${DATASET_ID}.fct_calendar_sync_history\` h ON e.event_id = h.event_id
    WHERE h.event_id IS NULL
    ORDER BY e.event_date ASC
  `
  const [rows] = await bigquery.query({ query })
  return rows as CalendarEvent[]
}

/** Google Calendar にイベントを作成し、calendar_event_id を返す */
export async function createCalendarEvent(event: CalendarEvent, calendarId: string): Promise<string> {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
  // google-auth-library v9とv10の型互換性のためにキャスト
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cal = calendar({ version: 'v3', auth: auth as any })

  const times = buildCalendarEventTimes(event)
  const response = await cal.events.insert({
    calendarId,
    requestBody: {
      summary: event.event_title,
      description: event.event_description,
      ...times,
    },
  })

  const id = response.data.id
  if (!id) {
    throw new Error(`Calendar event creation returned no id for event: ${event.event_id}`)
  }
  return id
}

/** BigQuery の fct_calendar_sync_history テーブルに同期記録を INSERT する */
export async function recordSync(eventId: string, calendarEventId: string): Promise<void> {
  const table = bigquery.dataset(DATASET_ID).table('fct_calendar_sync_history')
  await table.insert([
    {
      event_id: eventId,
      calendar_event_id: calendarEventId,
      synced_at: new Date().toISOString(),
      synced_by: 'backend',
    },
  ])
}

/** 未同期イベントをすべて Google Calendar に同期する（エラーがあっても続行） */
export async function syncAllEvents(): Promise<CalendarSyncResult> {
  const calendarId = CALENDAR_ID
  const events = await getUnsyncedEvents()

  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const event of events) {
    try {
      const calendarEventId = await createCalendarEvent(event, calendarId)
      await recordSync(event.event_id, calendarEventId)
      synced++
    } catch (err) {
      failed++
      const message = err instanceof Error ? err.message : String(err)
      errors.push(message)
      logger.error({ event_id: event.event_id, err: message }, 'カレンダーイベント同期失敗')
    }
  }

  return { synced, skipped: 0, failed, errors }
}
