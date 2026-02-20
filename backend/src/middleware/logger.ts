import type { MiddlewareHandler } from 'hono'
import type { Logger } from 'pino'
import { logger as defaultLogger } from '../lib/logger.js'

/** X-Cloud-Trace-Context ヘッダーからトレース情報を抽出 */
export function extractTraceContext(header: string | undefined): Record<string, string | undefined> {
  if (!header) return {}
  const [tracePart] = header.split(';')
  const [traceId, spanId] = tracePart.split('/')
  if (!traceId) return {}

  const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
  return {
    trace_id: traceId,
    span_id: spanId || undefined,
    // Cloud Logging特殊フィールド
    ...(projectId && {
      'logging.googleapis.com/trace': `projects/${projectId}/traces/${traceId}`,
      'logging.googleapis.com/spanId': spanId,
    }),
  }
}

/** HTTPリクエスト/レスポンスログミドルウェアを生成 */
export function createHttpLogger(log: Logger = defaultLogger): MiddlewareHandler {
  return async (c, next) => {
    const startTime = performance.now()

    await next()

    const durationMs = performance.now() - startTime
    const status = c.res.status
    const path = new URL(c.req.url).pathname
    const traceContext = extractTraceContext(c.req.header('X-Cloud-Trace-Context'))

    const logData = {
      ...traceContext,
      'http.request.method': c.req.method,
      'http.response.status_code': status,
      'url.path': path,
      'user_agent.original': c.req.header('User-Agent'),
      'client.address': c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
      'http.server.request.duration': Math.round(durationMs * 1_000_000), // ナノ秒
    }

    if (status >= 500) {
      log.error(logData, 'HTTP request failed')
    } else if (status >= 400) {
      log.warn(logData, 'HTTP request client error')
    } else {
      log.info(logData, 'HTTP request completed')
    }
  }
}

/** デフォルトロガーを使用するミドルウェアインスタンス */
export const httpLogger: MiddlewareHandler = createHttpLogger()
