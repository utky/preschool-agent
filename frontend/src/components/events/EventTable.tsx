import { Link } from 'react-router-dom'
import type { CalendarEvent } from '@/types/events'

// 日付を日本語形式にフォーマット（純粋関数）
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${year}年${month}月${day}日`
}

// iCalファイルをダウンロードする（純粋関数）
function downloadIcal(icalContent: string, title: string): void {
  const blob = new Blob([icalContent], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[/\\?%*:|"<>]/g, '-')}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function EventTable({ events }: { readonly events: readonly CalendarEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">イベントはありません</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 bg-white shadow sm:rounded-lg">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日付</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時刻</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイトル</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文書</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">iCal</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {events.map((event) => (
            <tr key={event.event_id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                {formatDate(event.event_date)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                {event.event_time ?? '-'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {event.event_title}
              </td>
              <td className="px-4 py-3 text-sm">
                <Link
                  to={`/documents/${event.document_id}`}
                  className="text-indigo-600 hover:underline"
                >
                  {event.document_title}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm">
                <button
                  type="button"
                  onClick={() => downloadIcal(event.ical_content, event.event_title)}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  title="iCalをダウンロード"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  iCal
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
