import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { DocumentChunk } from '@/types/documents'

interface ChunkListProps {
  chunks: readonly DocumentChunk[]
}

export default function ChunkList({ chunks }: ChunkListProps) {
  if (chunks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No chunks available</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 text-sm text-gray-500">
        {chunks.length} chunks
      </div>
      <div className="space-y-4">
        {chunks.map((chunk) => (
          <div
            key={chunk.chunk_id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Chunk {chunk.chunk_index + 1}
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 prose-headings:my-2 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-pre:bg-gray-100 prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {chunk.chunk_text}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
