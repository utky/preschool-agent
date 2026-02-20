import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { Hono } from 'hono'
import pino from 'pino'
import { createHttpLogger, extractTraceContext } from './logger.js'

// テスト用: 本番のlogger.tsと同じmessageKeyでログ出力をキャプチャ
function createTestLogger() {
  const logs: string[] = []
  const stream = { write(msg: string) { logs.push(msg) } }
  const log = pino({ level: 'trace', messageKey: 'message' }, stream)
  return { log, logs }
}

// 環境変数のバックアップ
const originalEnv = { ...process.env }

describe('httpLogger middleware', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function createApp(log: pino.Logger, path: string, status: number = 200, body: string = 'ok') {
    const app = new Hono()
    app.use('*', createHttpLogger(log))
    app.get(path, (c) => c.text(body, status as 200))
    return app
  }

  it('should log info for successful requests (2xx)', async () => {
    const { log, logs } = createTestLogger()
    const app = createApp(log, '/test')

    const res = await app.request('/test')
    expect(res.status).toBe(200)

    expect(logs).toHaveLength(1)
    const parsed = JSON.parse(logs[0])
    expect(parsed.message).toBe('HTTP request completed')
    expect(parsed['http.request.method']).toBe('GET')
    expect(parsed['http.response.status_code']).toBe(200)
    expect(parsed['url.path']).toBe('/test')
    expect(typeof parsed['http.server.request.duration']).toBe('number')
  })

  it('should log warn for client errors (4xx)', async () => {
    const { log, logs } = createTestLogger()
    const app = createApp(log, '/missing', 404, 'not found')

    const res = await app.request('/missing')
    expect(res.status).toBe(404)

    expect(logs).toHaveLength(1)
    const parsed = JSON.parse(logs[0])
    expect(parsed.message).toBe('HTTP request client error')
    expect(parsed.level).toBe(40) // warn
    expect(parsed['http.response.status_code']).toBe(404)
  })

  it('should log error for server errors (5xx)', async () => {
    const { log, logs } = createTestLogger()
    const app = createApp(log, '/fail', 500, 'internal error')

    const res = await app.request('/fail')
    expect(res.status).toBe(500)

    expect(logs).toHaveLength(1)
    const parsed = JSON.parse(logs[0])
    expect(parsed.message).toBe('HTTP request failed')
    expect(parsed.level).toBe(50) // error
    expect(parsed['http.response.status_code']).toBe(500)
  })

  it.each([
    [399, 30, 'HTTP request completed'],
    [400, 40, 'HTTP request client error'],
    [499, 40, 'HTTP request client error'],
    [500, 50, 'HTTP request failed'],
  ])('should log status %i as level %i', async (status, expectedLevel, expectedMsg) => {
    const { log, logs } = createTestLogger()
    const app = createApp(log, '/boundary', status, 'body')

    await app.request('/boundary')

    const parsed = JSON.parse(logs[0])
    expect(parsed.level).toBe(expectedLevel)
    expect(parsed.message).toBe(expectedMsg)
    expect(parsed['http.response.status_code']).toBe(status)
  })

  it('should include duration in nanoseconds as a number', async () => {
    const { log, logs } = createTestLogger()
    const app = createApp(log, '/timed')

    await app.request('/timed')

    const parsed = JSON.parse(logs[0])
    const duration = parsed['http.server.request.duration']
    expect(typeof duration).toBe('number')
    expect(Number.isInteger(duration)).toBe(true)
    expect(duration).toBeGreaterThanOrEqual(0)
  })

  it('should include User-Agent when provided', async () => {
    const { log, logs } = createTestLogger()
    const app = createApp(log, '/ua')

    await app.request('/ua', {
      headers: { 'User-Agent': 'Mozilla/5.0 Test Browser' },
    })

    const parsed = JSON.parse(logs[0])
    expect(parsed['user_agent.original']).toBe('Mozilla/5.0 Test Browser')
  })

  it('should include client address from X-Forwarded-For', async () => {
    const { log, logs } = createTestLogger()
    const app = createApp(log, '/xff')

    await app.request('/xff', {
      headers: { 'X-Forwarded-For': '192.168.1.100' },
    })

    const parsed = JSON.parse(logs[0])
    expect(parsed['client.address']).toBe('192.168.1.100')
  })
})

describe('extractTraceContext', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.GCP_PROJECT
    delete process.env.GOOGLE_CLOUD_PROJECT
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should extract trace_id and span_id from header', () => {
    const result = extractTraceContext('abc123def456/789;o=1')
    expect(result.trace_id).toBe('abc123def456')
    expect(result.span_id).toBe('789')
  })

  it('should add logging.googleapis.com/trace when GCP_PROJECT is set', () => {
    process.env.GCP_PROJECT = 'my-project'
    const result = extractTraceContext('trace123/span456;o=1')
    expect(result['logging.googleapis.com/trace']).toBe('projects/my-project/traces/trace123')
    expect(result['logging.googleapis.com/spanId']).toBe('span456')
  })

  it('should add logging.googleapis.com/trace when GOOGLE_CLOUD_PROJECT is set', () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'another-project'
    const result = extractTraceContext('trace123/span456;o=1')
    expect(result['logging.googleapis.com/trace']).toBe('projects/another-project/traces/trace123')
  })

  it('should prioritize GCP_PROJECT over GOOGLE_CLOUD_PROJECT', () => {
    process.env.GCP_PROJECT = 'priority-project'
    process.env.GOOGLE_CLOUD_PROJECT = 'fallback-project'
    const result = extractTraceContext('trace123/span456;o=1')
    expect(result['logging.googleapis.com/trace']).toBe('projects/priority-project/traces/trace123')
  })

  it('should return empty object when header is undefined', () => {
    const result = extractTraceContext(undefined)
    expect(result).toEqual({})
  })

  it('should return empty object when header is empty string', () => {
    const result = extractTraceContext('')
    expect(result).toEqual({})
  })

  it('should handle header without span_id', () => {
    const result = extractTraceContext('traceonly;o=1')
    expect(result.trace_id).toBe('traceonly')
    expect(result.span_id).toBeUndefined()
  })

  it('should not include GCP fields when no project env is set', () => {
    const result = extractTraceContext('trace123/span456;o=1')
    expect(result['logging.googleapis.com/trace']).toBeUndefined()
    expect(result['logging.googleapis.com/spanId']).toBeUndefined()
  })
})
