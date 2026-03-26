// 環境変数から設定を読み取る

import type { CrawlerConfig } from './types.js'

// 必須環境変数を読み取り、未設定の場合はエラーをスロー
const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません`)
  }
  return value
}

export const loadConfig = (): CrawlerConfig => ({
  wordpressBaseUrl: requireEnv('WORDPRESS_BASE_URL'),
  gcsBucketName: requireEnv('GCS_BUCKET_NAME'),
  gcsProjectId: requireEnv('GCP_PROJECT_ID'),
  sinceDateTime: requireEnv('SINCE_DATETIME'),
})
