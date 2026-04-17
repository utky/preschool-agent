import { useState, useEffect, useMemo } from 'react'
import { apiGet } from '@/lib/api'
import EventCard from '@/components/events/EventCard'
import type { CalendarEvent, EventsResponse } from '@/types/events'

function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Events({ today = getTodayStr() }: { today?: string }) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await apiGet<EventsResponse>('/api/calendar/events')
      setEvents([...data.events])
    } catch {
      setError('Failed to load events')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  // 当日以降のみ表示し、event_date ASC, event_time ASC（null は末尾）でソート
  const sortedEvents = useMemo(() =>
    [...events]
      .filter((e) => e.event_date >= today)
      .sort((a, b) => {
        const dateCmp = a.event_date.localeCompare(b.event_date)
        if (dateCmp !== 0) return dateCmp
        const aTime = a.event_time ?? '99:99'
        const bTime = b.event_time ?? '99:99'
        return aTime.localeCompare(bTime)
      }),
    [events, today]
  )

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="mt-1 text-sm text-gray-500">
            保育園PDFから自動抽出した行事予定
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedEvents.map((event) => (
            <EventCard key={event.event_id} event={event} />
          ))}
          {sortedEvents.length === 0 && (
            <p className="text-center py-12 text-gray-500">イベントはありません</p>
          )}
        </div>
      )}
    </div>
  )
}
