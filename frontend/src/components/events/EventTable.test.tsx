import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import EventTable from './EventTable'
import type { CalendarEvent } from '@/types/events'

const mockSyncedEvent: CalendarEvent = {
  event_id: 'abc123',
  document_id: 'doc1',
  document_title: '令和8年度春の行事予定',
  event_date: '2026-04-01',
  event_time: '10:00',
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
  document_title: '令和8年度春の行事予定',
  event_date: '2026-05-01',
  event_time: null,
  event_title: '春の遠足',
  event_description: '公園への遠足を実施します。',
  extracted_at: '2026-02-01T00:00:00Z',
  is_synced: false,
  calendar_event_id: null,
  synced_at: null,
}

const renderTable = (events: readonly CalendarEvent[]) =>
  render(
    <MemoryRouter>
      <EventTable events={events} />
    </MemoryRouter>
  )

describe('EventTable', () => {
  it('should render table headers', () => {
    renderTable([mockSyncedEvent])

    expect(screen.getByText('日付')).toBeInTheDocument()
    expect(screen.getByText('時刻')).toBeInTheDocument()
    expect(screen.getByText('タイトル')).toBeInTheDocument()
    expect(screen.getByText('文書')).toBeInTheDocument()
    expect(screen.getByText('同期')).toBeInTheDocument()
  })

  it('should render one row per event', () => {
    renderTable([mockSyncedEvent, mockUnsyncedEvent])

    expect(screen.getByText('入園式')).toBeInTheDocument()
    expect(screen.getByText('春の遠足')).toBeInTheDocument()
  })

  it('should display event_date in Japanese format', () => {
    renderTable([mockSyncedEvent])

    expect(screen.getByText('2026年4月1日')).toBeInTheDocument()
  })

  it('should display event_time when set', () => {
    renderTable([mockSyncedEvent])

    expect(screen.getByText('10:00')).toBeInTheDocument()
  })

  it('should display "-" when event_time is null', () => {
    renderTable([mockUnsyncedEvent])

    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('should render document_title as a Link to /documents/:id', () => {
    renderTable([mockSyncedEvent])

    const link = screen.getByRole('link', { name: '令和8年度春の行事予定' })
    expect(link).toHaveAttribute('href', '/documents/doc1')
  })

  it('should show synced badge when is_synced is true', () => {
    renderTable([mockSyncedEvent])

    expect(screen.getByText('登録済み')).toBeInTheDocument()
  })

  it('should not show synced badge when is_synced is false', () => {
    renderTable([mockUnsyncedEvent])

    expect(screen.queryByText('登録済み')).not.toBeInTheDocument()
  })

  it('should show empty message when events array is empty', () => {
    renderTable([])

    expect(screen.getByText('イベントはありません')).toBeInTheDocument()
  })
})
