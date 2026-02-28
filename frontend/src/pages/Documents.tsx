import { useState, useEffect, useMemo } from 'react'
import { apiGet } from '@/lib/api'
import DocumentList from '@/components/documents/DocumentList'

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

interface DocumentsResponse {
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

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string>('all')

  const fetchDocuments = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await apiGet<DocumentsResponse>('/api/documents')
      setDocuments(data.documents || [])
    } catch (err) {
      setError('Failed to load documents')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  // ユニークな document_type の一覧（null を除く）
  const documentTypes = useMemo(() => {
    const types = new Set<string>()
    for (const doc of documents) {
      if (doc.document_type) types.add(doc.document_type)
    }
    return Array.from(types).sort()
  }, [documents])

  // フィルタ + publish_date 降順ソート（null は末尾）
  const filteredDocuments = useMemo(() => {
    const filtered =
      selectedType === 'all'
        ? documents
        : documents.filter((doc) => doc.document_type === selectedType)

    return [...filtered].sort((a, b) => {
      if (a.publish_date && b.publish_date) {
        return b.publish_date.localeCompare(a.publish_date)
      }
      if (a.publish_date) return -1
      if (b.publish_date) return 1
      return b.updated_at.localeCompare(a.updated_at)
    })
  }, [documents, selectedType])

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
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            PDF documents uploaded from Google Drive
          </p>
        </div>
        <button
          onClick={fetchDocuments}
          className="mt-4 sm:mt-0 inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          <svg className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* 種別フィルタ */}
      {documentTypes.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedType('all')}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              selectedType === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
            }`}
          >
            すべて
          </button>
          {documentTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                selectedType === type
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
              }`}
            >
              {DOCUMENT_TYPE_LABELS[type] ?? type}
            </button>
          ))}
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
      ) : (
        <DocumentList documents={filteredDocuments} />
      )}
    </div>
  )
}
