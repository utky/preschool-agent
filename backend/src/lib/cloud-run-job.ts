import { JobsClient } from '@google-cloud/run'
import type { TriggerJobResponse } from '../types/documents.js'

const client = new JobsClient()

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'lofilab'
const GCP_REGION = process.env.GCP_REGION || 'asia-northeast1'
const DBT_JOB_NAME = process.env.DBT_JOB_NAME || 'school-agent-dbt'

export async function triggerDbtJob(): Promise<TriggerJobResponse> {
  const name = `projects/${GCP_PROJECT_ID}/locations/${GCP_REGION}/jobs/${DBT_JOB_NAME}`

  try {
    const [execution] = await client.runJob({ name })
    return {
      success: true,
      executionId: execution.name ?? undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
