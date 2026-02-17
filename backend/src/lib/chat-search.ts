import { BigQuery } from '@google-cloud/bigquery'
import type { ChatSource } from '../types/chat.js'

const bigquery = new BigQuery()
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'school_agent'

/** メッセージを空白で分割しキーワード配列にする */
export function extractKeywords(message: string): readonly string[] {
  return message.split(/\s+/).filter((k) => k.length > 0)
}

/** 検索結果を日本語テキストに整形する */
export function formatSearchResponse(
  keywords: readonly string[],
  sources: readonly ChatSource[]
): string {
  if (sources.length === 0) {
    return `「${keywords.join('、')}」に一致する文書は見つかりませんでした。別のキーワードで検索してみてください。`
  }

  const titles = [...new Set(sources.map((s) => s.title))]
  const titleList = titles.map((t) => `・${t}`).join('\n')
  return `「${keywords.join('、')}」で${sources.length}件のチャンクが見つかりました。\n\n関連文書:\n${titleList}`
}

/** BigQueryでチャンクをキーワード検索する */
export async function searchChunks(
  keywords: readonly string[]
): Promise<readonly ChatSource[]> {
  if (keywords.length === 0) {
    return []
  }

  const conditions = keywords.map((_, i) => `chunk_text LIKE @keyword${i}`)
  const params: Record<string, string> = {}
  keywords.forEach((k, i) => {
    params[`keyword${i}`] = `%${k}%`
  })

  const query = `
    SELECT document_id, title, chunk_text, chunk_index
    FROM \`${DATASET_ID}.fct_document_chunks\`
    WHERE ${conditions.join(' OR ')}
    ORDER BY document_id, chunk_index
    LIMIT 10
  `

  const [rows] = await bigquery.query({ query, params })
  return rows as ChatSource[]
}
