import { Link } from 'react-router-dom'
import { apiGet } from '@/lib/api'

interface Document {
  uri: string
  generation: string
  content_type: string
  size: number
  updated: string
  document_id?: string
  title?: string
}

interface DocumentListProps {
  documents: Document[]
}

export default function DocumentList({ documents }: DocumentListProps) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const extractFileName = (uri: string) => {
    const parts = uri.split('/')
    return decodeURIComponent(parts[parts.length - 1])
  }

  const getDisplayName = (doc: Document) => {
    if (doc.title) return doc.title
    return extractFileName(doc.uri)
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
                  <div className="truncate text-sm font-medium text-gray-900">
                    {doc.document_id ? (
                      <Link to={`/documents/${doc.document_id}`} className="hover:text-indigo-600">
                        {getDisplayName(doc)}
                      </Link>
                    ) : (
                      getDisplayName(doc)
                    )}
                  </div>
                  <div className="mt-1 flex items-center text-sm text-gray-500">
                    <span>{formatSize(doc.size)}</span>
                    <span className="mx-2">&bull;</span>
                    <span>{formatDate(doc.updated)}</span>
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
