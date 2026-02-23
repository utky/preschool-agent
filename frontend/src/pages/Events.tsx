import { useState, useEffect } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import EventCard from '@/components/events/EventCard'
import type { CalendarEvent, EventsResponse, CalendarSyncResult } from '@/types/events'

export default function Events() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<CalendarSyncResult | null>(null)

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

  const handleSync = async () => {
    try {
      setIsSyncing(true)
      setSyncResult(null)
      const result = await apiPost<CalendarSyncResult>('/api/calendar/sync')
      setSyncResult(result)
      // 同期後にイベント一覧を再取得
      await fetchEvents()
    } catch {
      setError('Failed to sync events')
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

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
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="mt-4 sm:mt-0 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSyncing ? (
            <>
              <svg className="-ml-0.5 mr-1.5 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              同期中...
            </>
          ) : (
            <>
              <svg className="-ml-0.5 mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              今すぐ同期
            </>
          )}
        </button>
      </div>

      {syncResult && (
        <div className="mb-4 rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">
            同期完了: {syncResult.synced}件登録、{syncResult.failed}件失敗
          </p>
        </div>
      )}

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
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">イベントはありません</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.event_id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
