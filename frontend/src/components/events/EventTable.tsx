import { Link } from 'react-router-dom'
import type { CalendarEvent } from '@/types/events'

// 日付を日本語形式にフォーマット（純粋関数）
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${year}年${month}月${day}日`
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
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">同期</th>
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
                {event.is_synced && (
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    登録済み
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
