import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { CalendarEvent, CalendarSyncResult } from '../types/events.js'

// calendar lib モック
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSyncAllEvents = jest.fn<(...args: any[]) => any>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetUnsyncedEvents = jest.fn<(...args: any[]) => any>()
jest.unstable_mockModule('../lib/calendar.js', () => ({
  syncAllEvents: mockSyncAllEvents,
  getUnsyncedEvents: mockGetUnsyncedEvents,
}))

// storage lib モック
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetApiData = jest.fn<(...args: any[]) => any>()
jest.unstable_mockModule('../lib/storage.js', () => ({
  getApiData: mockGetApiData,
}))

// auth middleware モック（認証をスキップ）
jest.unstable_mockModule('../middleware/auth.js', () => ({
  requireAuth: jest.fn((_c: unknown, next: () => Promise<void>) => next()),
}))

const mockEvents: CalendarEvent[] = [
  {
    event_id: 'abc123',
    document_id: 'doc1',
    document_title: '令和8年度春の行事予定',
    event_date: '2026-04-01',
    event_time: '10:00',
    event_title: '入園式',
    event_description: '春の入園式',
    extracted_at: '2026-02-01T00:00:00Z',
    is_synced: true,
    calendar_event_id: 'gcal_001',
    synced_at: '2026-02-10T10:00:00Z',
  },
  {
    event_id: 'def456',
    document_id: 'doc1',
    document_title: '令和8年度春の行事予定',
    event_date: '2026-05-01',
    event_time: null,
    event_title: '春の遠足',
    event_description: '公園への遠足',
    extracted_at: '2026-02-01T00:00:00Z',
    is_synced: false,
    calendar_event_id: null,
    synced_at: null,
  },
]

describe('GET /api/calendar/events', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return events from JSONL file', async () => {
    const jsonl = mockEvents.map((e) => JSON.stringify(e)).join('\n')
    mockGetApiData.mockResolvedValue(jsonl)

    const { default: calendarRoute } = await import('./calendar.js')
    const req = new Request('http://localhost/events')
    const res = await calendarRoute.fetch(req)
    const body = await res.json() as { events: CalendarEvent[] }

    expect(res.status).toBe(200)
    expect(body.events).toHaveLength(2)
    expect(body.events[0]!.event_id).toBe('abc123')
    expect(body.events[1]!.event_id).toBe('def456')
    expect(mockGetApiData).toHaveBeenCalledWith('events/000000000000.json')
  })

  it('should handle empty JSONL file', async () => {
    mockGetApiData.mockResolvedValue('')

    const { default: calendarRoute } = await import('./calendar.js')
    const req = new Request('http://localhost/events')
    const res = await calendarRoute.fetch(req)
    const body = await res.json() as { events: CalendarEvent[] }

    expect(res.status).toBe(200)
    expect(body.events).toHaveLength(0)
  })
})

describe('POST /api/calendar/sync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should trigger sync and return result', async () => {
    const mockResult: CalendarSyncResult = { synced: 2, skipped: 0, failed: 0, errors: [] }
    mockSyncAllEvents.mockResolvedValue(mockResult)

    const { default: calendarRoute } = await import('./calendar.js')
    const req = new Request('http://localhost/sync', { method: 'POST' })
    const res = await calendarRoute.fetch(req)
    const body = await res.json() as CalendarSyncResult

    expect(res.status).toBe(200)
    expect(body.synced).toBe(2)
    expect(body.failed).toBe(0)
    expect(mockSyncAllEvents).toHaveBeenCalledTimes(1)
  })

  it('should return partial results when some events fail', async () => {
    const mockResult: CalendarSyncResult = {
      synced: 1,
      skipped: 0,
      failed: 1,
      errors: ['Calendar API error'],
    }
    mockSyncAllEvents.mockResolvedValue(mockResult)

    const { default: calendarRoute } = await import('./calendar.js')
    const req = new Request('http://localhost/sync', { method: 'POST' })
    const res = await calendarRoute.fetch(req)
    const body = await res.json() as CalendarSyncResult

    expect(res.status).toBe(200)
    expect(body.synced).toBe(1)
    expect(body.failed).toBe(1)
    expect(body.errors).toHaveLength(1)
  })
})
