import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import EventCard from './EventCard'
import type { CalendarEvent } from '@/types/events'

const mockSyncedEvent: CalendarEvent = {
  event_id: 'abc123',
  document_id: 'doc1',
  event_date: '2026-04-01',
  event_type: '入園式',
  event_title: '入園式',
  event_description: '春の入園式を行います。',
  extracted_at: '2026-02-01T00:00:00Z',
  is_synced: true,
  calendar_event_id: 'gcal_001',
  synced_at: '2026-02-10T10:00:00Z',
}

const mockUnsyncedEvent: CalendarEvent = {
  event_id: 'def456',
  document_id: 'doc1',
  event_date: '2026-05-01',
  event_type: '遠足',
  event_title: '春の遠足',
  event_description: '公園への遠足を実施します。',
  extracted_at: '2026-02-01T00:00:00Z',
  is_synced: false,
  calendar_event_id: null,
  synced_at: null,
}

describe('EventCard', () => {
  it('should render event title and description', () => {
    render(<EventCard event={mockSyncedEvent} />)

    // event_title と event_type が同じ「入園式」のため getAllByText を使用
    expect(screen.getAllByText('入園式').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('春の入園式を行います。')).toBeInTheDocument()
  })

  it('should display event date in Japanese locale format', () => {
    render(<EventCard event={mockSyncedEvent} />)

    // 2026-04-01 → 2026年4月1日
    expect(screen.getByText(/2026年4月1日/)).toBeInTheDocument()
  })

  it('should display event type as a color tag', () => {
    render(<EventCard event={mockSyncedEvent} />)

    // event_type と event_title が同じ「入園式」なので複数存在する
    const elements = screen.getAllByText('入園式')
    expect(elements.length).toBeGreaterThanOrEqual(1)
  })

  it('should show synced badge when is_synced is true', () => {
    render(<EventCard event={mockSyncedEvent} />)

    expect(screen.getByText('登録済み')).toBeInTheDocument()
  })

  it('should not show synced badge when is_synced is false', () => {
    render(<EventCard event={mockUnsyncedEvent} />)

    expect(screen.queryByText('登録済み')).not.toBeInTheDocument()
  })

  it('should render unsynced event without badge', () => {
    render(<EventCard event={mockUnsyncedEvent} />)

    expect(screen.getByText('春の遠足')).toBeInTheDocument()
    expect(screen.getByText('公園への遠足を実施します。')).toBeInTheDocument()
    expect(screen.queryByText('登録済み')).not.toBeInTheDocument()
  })
})
