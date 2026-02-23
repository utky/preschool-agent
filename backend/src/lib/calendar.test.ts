import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { CalendarEvent, CalendarSyncResult } from '../types/events.js'

// BigQuery モック
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockQuery = jest.fn<(...args: any[]) => any>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockInsert = jest.fn<(...args: any[]) => any>()
jest.unstable_mockModule('@google-cloud/bigquery', () => ({
  BigQuery: jest.fn(() => ({
    query: mockQuery,
    dataset: jest.fn(() => ({
      table: jest.fn(() => ({
        insert: mockInsert,
      })),
    })),
  })),
}))

// Google Calendar API モック
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockEventsInsert = jest.fn<(...args: any[]) => any>()
jest.unstable_mockModule('googleapis', () => ({
  google: {
    calendar: jest.fn(() => ({
      events: {
        insert: mockEventsInsert,
      },
    })),
    auth: {
      GoogleAuth: jest.fn(() => ({})),
    },
  },
}))

const mockUnsyncedEvent: CalendarEvent = {
  event_id: 'abc123',
  document_id: 'doc1',
  event_date: '2026-04-01',
  event_type: '入園式',
  event_title: '入園式',
  event_description: '春の入園式を行います',
  extracted_at: '2026-02-01T00:00:00Z',
  is_synced: false,
  calendar_event_id: null,
  synced_at: null,
}

describe('getUnsyncedEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.BIGQUERY_DATASET_ID = 'test_dataset'
  })

  it('should return unsynced events from BigQuery', async () => {
    mockQuery.mockResolvedValue([[mockUnsyncedEvent]])

    const { getUnsyncedEvents } = await import('./calendar.js')
    const result = await getUnsyncedEvents()

    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
    expect(result[0]!.event_id).toBe('abc123')
    expect(result[0]!.is_synced).toBe(false)
  })

  it('should return empty array when no unsynced events', async () => {
    mockQuery.mockResolvedValue([[]])

    const { getUnsyncedEvents } = await import('./calendar.js')
    const result = await getUnsyncedEvents()

    expect(result).toEqual([])
  })

  it('should query with is_synced = false condition', async () => {
    mockQuery.mockResolvedValue([[]])

    const { getUnsyncedEvents } = await import('./calendar.js')
    await getUnsyncedEvents()

    const callArgs = mockQuery.mock.calls[0]![0] as { query: string }
    expect(callArgs.query).toContain('is_synced')
  })
})

describe('createCalendarEvent', () => {
  const calendarId = 'test@group.calendar.google.com'

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GOOGLE_CALENDAR_ID = calendarId
  })

  it('should create an all-day event and return calendar event id', async () => {
    mockEventsInsert.mockResolvedValue({ data: { id: 'gcal_event_123' } })

    const { createCalendarEvent } = await import('./calendar.js')
    const result = await createCalendarEvent(mockUnsyncedEvent, calendarId)

    expect(result).toBe('gcal_event_123')
    expect(mockEventsInsert).toHaveBeenCalledTimes(1)
    const callArgs = mockEventsInsert.mock.calls[0]![0] as {
      calendarId: string
      requestBody: { summary: string; description: string; start: { date: string }; end: { date: string } }
    }
    expect(callArgs.calendarId).toBe(calendarId)
    expect(callArgs.requestBody.summary).toBe('入園式')
    expect(callArgs.requestBody.start.date).toBe('2026-04-01')
    expect(callArgs.requestBody.end.date).toBe('2026-04-01')
  })

  it('should throw error when calendar API fails', async () => {
    mockEventsInsert.mockRejectedValue(new Error('Calendar API error'))

    const { createCalendarEvent } = await import('./calendar.js')
    await expect(createCalendarEvent(mockUnsyncedEvent, calendarId)).rejects.toThrow('Calendar API error')
  })

  it('should throw error when response has no id', async () => {
    mockEventsInsert.mockResolvedValue({ data: {} })

    const { createCalendarEvent } = await import('./calendar.js')
    await expect(createCalendarEvent(mockUnsyncedEvent, calendarId)).rejects.toThrow()
  })
})

describe('recordSync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.BIGQUERY_DATASET_ID = 'test_dataset'
  })

  it('should insert sync record into BigQuery', async () => {
    mockInsert.mockResolvedValue([])

    const { recordSync } = await import('./calendar.js')
    await recordSync('event_id_1', 'gcal_event_456')

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertedRows = mockInsert.mock.calls[0]![0] as Array<{
      event_id: string
      calendar_event_id: string
      synced_by: string
    }>
    expect(insertedRows[0]!.event_id).toBe('event_id_1')
    expect(insertedRows[0]!.calendar_event_id).toBe('gcal_event_456')
    expect(insertedRows[0]!.synced_by).toBe('backend')
  })
})

describe('syncAllEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.BIGQUERY_DATASET_ID = 'test_dataset'
    process.env.GOOGLE_CALENDAR_ID = 'test@group.calendar.google.com'
  })

  it('should sync all unsynced events and return result', async () => {
    mockQuery.mockResolvedValue([[mockUnsyncedEvent]])
    mockEventsInsert.mockResolvedValue({ data: { id: 'gcal_event_789' } })
    mockInsert.mockResolvedValue([])

    const { syncAllEvents } = await import('./calendar.js')
    const result: CalendarSyncResult = await syncAllEvents()

    expect(result.synced).toBe(1)
    expect(result.failed).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('should continue on error and record failed count', async () => {
    const event2: CalendarEvent = { ...mockUnsyncedEvent, event_id: 'def456', event_title: '運動会' }
    mockQuery.mockResolvedValue([[mockUnsyncedEvent, event2]])
    mockEventsInsert
      .mockRejectedValueOnce(new Error('Calendar API error'))
      .mockResolvedValueOnce({ data: { id: 'gcal_event_789' } })
    mockInsert.mockResolvedValue([])

    const { syncAllEvents } = await import('./calendar.js')
    const result: CalendarSyncResult = await syncAllEvents()

    expect(result.synced).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Calendar API error')
  })

  it('should return zero counts when no events to sync', async () => {
    mockQuery.mockResolvedValue([[]])

    const { syncAllEvents } = await import('./calendar.js')
    const result: CalendarSyncResult = await syncAllEvents()

    expect(result.synced).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
  })
})
