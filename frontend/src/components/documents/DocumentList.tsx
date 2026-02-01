import { useState } from 'react'
import { apiPost } from '@/lib/api'

interface Document {
  uri: string
  generation: string
  content_type: string
  size: number
  updated: string
}

interface DocumentListProps {
  documents: Document[]
  onProcess?: (uri: string) => void
}

export default function DocumentList({ documents, onProcess }: DocumentListProps) {
  const [processing, setProcessing] = useState<string | null>(null)

  const handleProcess = async (uri: string) => {
    setProcessing(uri)
    try {
      await apiPost('/api/documents/process', { uri })
      onProcess?.(uri)
    } catch (error) {
      console.error('Failed to process document:', error)
    } finally {
      setProcessing(null)
    }
  }

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
    return parts[parts.length - 1]
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
                    {extractFileName(doc.uri)}
                  </div>
                  <div className="mt-1 flex items-center text-sm text-gray-500">
                    <span>{formatSize(doc.size)}</span>
                    <span className="mx-2">•</span>
                    <span>{formatDate(doc.updated)}</span>
                  </div>
                </div>
              </div>
              <div>
                <button
                  onClick={() => handleProcess(doc.uri)}
                  disabled={processing === doc.uri}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing === doc.uri ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    'Process'
                  )}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
