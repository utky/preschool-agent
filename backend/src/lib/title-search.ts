import { BigQuery } from '@google-cloud/bigquery'
import type { ChatSource } from '../types/chat.js'

const bigquery = new BigQuery()
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'school_agent'

/** dim_documentsのタイトルでキーワード検索し、マッチした文書のチャンクを返す */
export async function searchByTitle(
  keywords: readonly string[],
  limit = 10
): Promise<readonly ChatSource[]> {
  if (keywords.length === 0) {
    return []
  }

  const conditions = keywords.map((_, i) => `d.title LIKE @keyword${i}`)
  const params: Record<string, string> = {}
  keywords.forEach((k, i) => {
    params[`keyword${i}`] = `%${k}%`
  })

  const query = `
    SELECT c.document_id, d.title, c.chunk_text, c.chunk_index
    FROM \`${DATASET_ID}.fct_document_chunks\` c
    JOIN \`${DATASET_ID}.dim_documents\` d ON c.document_id = d.document_id
    WHERE ${conditions.join(' OR ')}
    ORDER BY c.document_id, c.chunk_index
    LIMIT ${limit}
  `

  const [rows] = await bigquery.query({ query, params })
  return rows as ChatSource[]
}
