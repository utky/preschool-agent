import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'school_agent'

export interface DocumentRecord {
  uri: string
  generation: string
  content_type: string
  size: number
  updated: string
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const query = `
    SELECT
      uri,
      CAST(generation AS STRING) as generation,
      content_type,
      size,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', updated) as updated
    FROM \`${DATASET_ID}.raw_documents\`
    ORDER BY updated DESC
    LIMIT 100
  `

  const [rows] = await bigquery.query({ query })
  return rows as DocumentRecord[]
}

export interface ProcessResult {
  success: boolean
  jobId?: string
  error?: string
}

export async function processDocument(uri: string): Promise<ProcessResult> {
  const query = `
    SELECT
      ml_process_document_result.text_segments[0].text as extracted_text
    FROM ML.PROCESS_DOCUMENT(
      MODEL \`${DATASET_ID}.document_ocr_model\`,
      TABLE (SELECT uri FROM UNNEST(['${uri}']) AS uri)
    )
  `

  try {
    const [job] = await bigquery.createQueryJob({ query })
    return { success: true, jobId: job.id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
