import { Link } from 'react-router-dom'
import { apiGet } from '@/lib/api'

interface Document {
  document_id: string
  uri: string
  title: string
  document_type: string | null
  publish_date: string | null
  content_type: string
  size: number
  total_chunks: number
  updated_at: string
}

interface DocumentListProps {
  documents: Document[]
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  journal: '日誌',
  photo_album: 'フォトアルバム',
  monthly_announcement: '園だより',
  monthly_lunch_schedule: '給食献立表',
  monthly_lunch_info: '給食便り',
  uncategorized: 'その他',
}

const DOCUMENT_TYPE_COLORS: Record<string, string> = {
  journal: 'bg-blue-100 text-blue-800',
  photo_album: 'bg-pink-100 text-pink-800',
  monthly_announcement: 'bg-green-100 text-green-800',
  monthly_lunch_schedule: 'bg-orange-100 text-orange-800',
  monthly_lunch_info: 'bg-yellow-100 text-yellow-800',
  uncategorized: 'bg-gray-100 text-gray-600',
}

export default function DocumentList({ documents }: DocumentListProps) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // publish_date（YYYY-MM-DD）を「2026年3月」形式で表示、null なら updated_at の日時を表示
  const formatPublishDate = (publishDate: string | null, updatedAt: string) => {
    if (publishDate) {
      const d = new Date(`${publishDate}T00:00:00`)
      return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })
    }
    return new Date(updatedAt).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleDownload = async (uri: string) => {
    try {
      const data = await apiGet<{ url: string }>(`/api/documents/download?uri=${encodeURIComponent(uri)}`)
      window.open(data.url, '_blank')
    } catch (error) {
      console.error('Failed to get download URL:', error)
    }
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
        <p className="mt-1 text-sm text-gray-500">Upload PDFs to Google Drive to get started.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden bg-white shadow sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {documents.map((doc) => (
          <li key={doc.uri}>
            <div className="flex items-center px-4 py-4 sm:px-6">
              <div className="flex min-w-0 flex-1 items-center">
                <div className="flex-shrink-0">
                  <svg className="h-10 w-10 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                    <path fill="white" d="M14 2v6h6" />
                    <text x="8" y="17" fontSize="6" fill="white" fontWeight="bold">PDF</text>
                  </svg>
                </div>
                <div className="min-w-0 flex-1 px-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="truncate text-sm font-medium text-gray-900">
                      <Link to={`/documents/${doc.document_id}`} className="hover:text-indigo-600">
                        {doc.title}
                      </Link>
                    </span>
                    {/* 文書種別バッジ */}
                    {doc.document_type && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${DOCUMENT_TYPE_COLORS[doc.document_type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center text-sm text-gray-500">
                    <span>{formatSize(doc.size)}</span>
                    <span className="mx-2">&bull;</span>
                    {/* publish_date があれば「2026年3月」形式、なければ updated_at */}
                    <span>{formatPublishDate(doc.publish_date, doc.updated_at)}</span>
                  </div>
                </div>
              </div>
              <div>
                <button
                  onClick={() => handleDownload(doc.uri)}
                  className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  <svg className="-ml-0.5 mr-1.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Open
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
