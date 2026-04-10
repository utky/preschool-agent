import { Link } from 'react-router-dom'
import type { CalendarEvent } from '@/types/events'

// 日付を日本語形式にフォーマット（純粋関数）
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${year}年${month}月${day}日`
}

// Google CalendarのイベントテンプレートURLを生成する（純粋関数）
function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const [year, month, day] = event.event_date.split('-')
  const pad = (n: number) => String(n).padStart(2, '0')
  let dates: string

  if (event.event_time) {
    // 時刻あり: 開始〜+1時間
    const [hour, minute] = event.event_time.split(':').map(Number)
    const endHour = (hour + 1) % 24
    const start = `${year}${month}${day}T${pad(hour)}${pad(minute)}00`
    const end = `${year}${month}${day}T${pad(endHour)}${pad(minute)}00`
    dates = `${start}/${end}`
  } else {
    // 終日: 翌日が終了日（Google Calendarの終日イベントは終了日が排他的）
    const next = new Date(Number(year), Number(month) - 1, Number(day) + 1)
    const endStr = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`
    dates = `${year}${month}${day}/${endStr}`
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.event_title,
    dates,
    details: event.event_description,
    ctz: 'Asia/Tokyo',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
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
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">カレンダー</th>
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
                <a
                  href={buildGoogleCalendarUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  title="Google Calendarに追加"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  追加
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
