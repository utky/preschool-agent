// GCSアップロードロジック

import { Storage } from '@google-cloud/storage'
import type { MediaFile } from './types.js'

/**
 * GCSにファイルが既に存在するか確認する
 */
export const isAlreadyUploaded = async (
  storage: Storage,
  bucketName: string,
  gcsPath: string,
): Promise<boolean> => {
  const [exists] = await storage.bucket(bucketName).file(gcsPath).exists()
  return exists
}

/**
 * PDFをURLからダウンロードしてBufferで返す
 */
export const downloadPdf = async (url: string): Promise<Buffer> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`PDF ダウンロード失敗: url=${url} status=${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * GCSメタデータに設定する original-filename を生成する
 * source_url のパス末尾ファイル名をURLエンコードして返す（GASと同形式）
 */
export const buildOriginalFilename = (sourceUrl: string): string => {
  const decoded = decodeURIComponent(sourceUrl.split('/').pop() ?? '')
  return encodeURIComponent(decoded)
}

/**
 * PDFをGCSにアップロードする
 * dbtが読み取るメタデータ（original-filename等）を付与する
 */
export const uploadToGcs = async (
  storage: Storage,
  bucketName: string,
  gcsPath: string,
  content: Buffer,
  media: MediaFile,
): Promise<void> => {
  const file = storage.bucket(bucketName).file(gcsPath)

  const metadata = {
    contentType: 'application/pdf',
    metadata: {
      // dbtの stg_pdf_uploads__extracted_texts.sql が参照するフィールド
      'original-filename': buildOriginalFilename(media.source_url),
      'source-url': media.source_url,
      'letter-id': String(media.post),
      'media-id': String(media.id),
    },
  }

  await file.save(content, metadata)
}
