import { describe, it, expect } from '@jest/globals'
import pino from 'pino'

// テスト用のログ出力をキャプチャするためのヘルパー
function createTestLogger() {
  const logs: string[] = []

  const stream = {
    write(msg: string) {
      logs.push(msg)
    },
  }

  // logger.ts と同じ設定を再現してテスト
  const SEVERITY_MAP: Record<number, string> = {
    10: 'DEBUG',
    20: 'DEBUG',
    30: 'INFO',
    40: 'WARNING',
    50: 'ERROR',
    60: 'CRITICAL',
  }

  const logger = pino(
    {
      level: 'trace',
      formatters: {
        level(_label: string, number: number) {
          return {
            severity: SEVERITY_MAP[number] || 'DEFAULT',
            'severity.text': SEVERITY_MAP[number] || 'DEFAULT',
          }
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      base: {
        'service.name': 'test-service',
        'deployment.environment': 'test',
      },
      messageKey: 'message',
    },
    stream
  )

  return { logger, logs }
}

describe('logger', () => {
  describe('JSON出力', () => {
    it('should output valid JSON per line', () => {
      const { logger, logs } = createTestLogger()
      logger.info('test message')

      expect(logs).toHaveLength(1)
      const parsed = JSON.parse(logs[0])
      expect(parsed).toBeDefined()
    })

    it('should use "message" as the message key', () => {
      const { logger, logs } = createTestLogger()
      logger.info('hello world')

      const parsed = JSON.parse(logs[0])
      expect(parsed.message).toBe('hello world')
      expect(parsed.msg).toBeUndefined()
    })
  })

  describe('severity マッピング', () => {
    it.each([
      ['trace', 'DEBUG'],
      ['debug', 'DEBUG'],
      ['info', 'INFO'],
      ['warn', 'WARNING'],
      ['error', 'ERROR'],
      ['fatal', 'CRITICAL'],
    ])('should map %s to severity %s', (level, expectedSeverity) => {
      const { logger, logs } = createTestLogger()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(logger as any)[level]('test')

      const parsed = JSON.parse(logs[0])
      expect(parsed.severity).toBe(expectedSeverity)
      expect(parsed['severity.text']).toBe(expectedSeverity)
    })
  })

  describe('ベースフィールド', () => {
    it('should include service.name in every log', () => {
      const { logger, logs } = createTestLogger()
      logger.info('test')

      const parsed = JSON.parse(logs[0])
      expect(parsed['service.name']).toBe('test-service')
    })

    it('should include deployment.environment in every log', () => {
      const { logger, logs } = createTestLogger()
      logger.info('test')

      const parsed = JSON.parse(logs[0])
      expect(parsed['deployment.environment']).toBe('test')
    })
  })

  describe('タイムスタンプ', () => {
    it('should include ISO 8601 timestamp', () => {
      const { logger, logs } = createTestLogger()
      logger.info('test')

      const parsed = JSON.parse(logs[0])
      expect(parsed.time).toBeDefined()
      expect(new Date(parsed.time).toISOString()).toBeTruthy()
    })
  })

  describe('追加フィールド', () => {
    it('should include extra fields passed as first argument', () => {
      const { logger, logs } = createTestLogger()
      logger.info({ 'http.request.method': 'GET', 'url.path': '/api/test' }, 'request')

      const parsed = JSON.parse(logs[0])
      expect(parsed['http.request.method']).toBe('GET')
      expect(parsed['url.path']).toBe('/api/test')
    })

    it('should serialize error objects with err key', () => {
      const { logger, logs } = createTestLogger()
      const error = new Error('something broke')
      logger.error({ err: error }, 'failure')

      const parsed = JSON.parse(logs[0])
      expect(parsed.err).toBeDefined()
      expect(parsed.err.message).toBe('something broke')
      expect(parsed.err.type).toBe('Error')
    })
  })

  describe('pid/hostnameの除外', () => {
    it('should not include pid or hostname', () => {
      const { logger, logs } = createTestLogger()
      logger.info('test')

      const parsed = JSON.parse(logs[0])
      expect(parsed.pid).toBeUndefined()
      expect(parsed.hostname).toBeUndefined()
    })
  })
})
