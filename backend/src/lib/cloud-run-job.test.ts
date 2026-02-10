import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// モック設定
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRunJob = jest.fn<(...args: any[]) => any>()
jest.unstable_mockModule('@google-cloud/run', () => ({
  JobsClient: jest.fn(() => ({
    runJob: mockRunJob,
  })),
}))

describe('triggerDbtJob', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    process.env.GCP_PROJECT_ID = 'test-project'
    process.env.GCP_REGION = 'asia-northeast1'
    process.env.DBT_JOB_NAME = 'school-agent-dbt'
  })

  it('should trigger Cloud Run Job and return execution ID', async () => {
    mockRunJob.mockResolvedValue([
      {
        name: 'projects/test-project/locations/asia-northeast1/jobs/school-agent-dbt/executions/exec-123',
      },
      null,
      undefined,
    ])

    const { triggerDbtJob } = await import('./cloud-run-job.js')
    const result = await triggerDbtJob()

    expect(result.success).toBe(true)
    expect(result.executionId).toBe(
      'projects/test-project/locations/asia-northeast1/jobs/school-agent-dbt/executions/exec-123'
    )
    expect(mockRunJob).toHaveBeenCalledWith({
      name: 'projects/test-project/locations/asia-northeast1/jobs/school-agent-dbt',
    })
  })

  it('should handle execution name being null', async () => {
    mockRunJob.mockResolvedValue([
      { name: null },
      null,
      undefined,
    ])

    const { triggerDbtJob } = await import('./cloud-run-job.js')
    const result = await triggerDbtJob()

    expect(result.success).toBe(true)
    expect(result.executionId).toBeUndefined()
  })

  it('should return error on failure', async () => {
    mockRunJob.mockRejectedValue(new Error('Permission denied'))

    const { triggerDbtJob } = await import('./cloud-run-job.js')
    const result = await triggerDbtJob()

    expect(result.success).toBe(false)
    expect(result.error).toBe('Permission denied')
  })

  it('should handle non-Error exception', async () => {
    mockRunJob.mockRejectedValue('String error')

    const { triggerDbtJob } = await import('./cloud-run-job.js')
    const result = await triggerDbtJob()

    expect(result.success).toBe(false)
    expect(result.error).toBe('String error')
  })
})
