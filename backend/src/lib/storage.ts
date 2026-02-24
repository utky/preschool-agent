import { Storage } from '@google-cloud/storage'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const storage = new Storage()

const FRONTEND_BUCKET_NAME = process.env.FRONTEND_BUCKET_NAME || 'school-agent-prod-frontend'
const API_DATA_BUCKET_NAME = process.env.API_DATA_BUCKET_NAME || 'school-agent-prod-api-data'

export async function getFrontendIndex(): Promise<string> {
  if (process.env.NODE_ENV === 'development') {
    const localPath = join(process.cwd(), '..', 'frontend', 'dist', 'index.html')
    if (existsSync(localPath)) {
      return readFileSync(localPath, 'utf-8')
    }
    throw new Error('Frontend build not found. Run `npm run build` in frontend directory.')
  }

  const bucket = storage.bucket(FRONTEND_BUCKET_NAME)
  const file = bucket.file('index.html')
  const [contents] = await file.download()
  return contents.toString()
}

// NDJSONを解析してオブジェクト配列を返す
export function parseNdJson<T>(data: string): T[] {
  return data
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T)
}

export async function getApiData(filename: string): Promise<string> {
  if (process.env.NODE_ENV === 'development') {
    const localPath = join(process.cwd(), 'data', filename)
    if (existsSync(localPath)) {
      return readFileSync(localPath, 'utf-8')
    }
    throw new Error(`API data file not found: ${filename}`)
  }

  const bucket = storage.bucket(API_DATA_BUCKET_NAME)
  const file = bucket.file(filename)
  const [contents] = await file.download()
  return contents.toString()
}
