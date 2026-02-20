import pino from 'pino'

// pinoレベル → Cloud Logging severity マッピング
const SEVERITY_MAP: Record<number, string> = {
  10: 'DEBUG',     // trace
  20: 'DEBUG',     // debug
  30: 'INFO',      // info
  40: 'WARNING',   // warn
  50: 'ERROR',     // error
  60: 'CRITICAL',  // fatal
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level(_label, number) {
      return {
        severity: SEVERITY_MAP[number] || 'DEFAULT',
        'severity.text': SEVERITY_MAP[number] || 'DEFAULT',
      }
    },
  },
  // ISO 8601タイムスタンプ
  timestamp: pino.stdTimeFunctions.isoTime,
  // pinoデフォルトの"pid","hostname"を除外
  base: {
    'service.name': process.env.SERVICE_NAME || 'preschool-backend',
    'deployment.environment': process.env.NODE_ENV || 'development',
  },
  // Cloud Loggingが "message" フィールドを期待
  messageKey: 'message',
})
