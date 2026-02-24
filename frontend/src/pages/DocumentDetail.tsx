import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import ChunkList from '@/components/documents/ChunkList'
import type { DocumentDetailResponse } from '@/types/documents'

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DocumentDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await apiGet<DocumentDetailResponse>(`/api/documents/${id}`)
        setData(response)
      } catch {
        setError('Failed to load document')
      } finally {
        setIsLoading(false)
      }
    }
    fetchDocument()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12" role="status">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <Link to="/documents" className="text-sm text-indigo-600 hover:text-indigo-500 mb-4 inline-block">
          &larr; Back to documents
        </Link>
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error ?? 'Document not found'}</p>
        </div>
      </div>
    )
  }

  const { document, chunks } = data

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      <Link to="/documents" className="text-sm text-indigo-600 hover:text-indigo-500 mb-4 inline-block">
        &larr; Back to documents
      </Link>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
          {document.signed_url && (
            <a
              href={document.signed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 shrink-0"
            >
              Open PDF
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          <span>{formatSize(document.size)}</span>
          <span>{document.total_chunks} chunks</span>
          {document.document_type && <span>{document.document_type}</span>}
          {document.publish_date && <span>{document.publish_date}</span>}
        </div>
      </div>

      <ChunkList chunks={chunks} />
    </div>
  )
}
