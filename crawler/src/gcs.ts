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
 * source_urlに日本語等の非ASCII文字が含まれる場合はencodeURIでエンコードする
 * サイトのホットリンク防止に対応するためRefererヘッダーを付与する
 */
export const downloadPdf = async (url: string, referer: string): Promise<Buffer> => {
  // encodeURIでURLとして有効な形式にエンコード（スキームや / などは保持）
  const encodedUrl = encodeURI(url)
  const response = await fetch(encodedUrl, {
    headers: { Referer: referer },
  })
  if (!response.ok) {
    throw new Error(`PDF ダウンロード失敗: url=${encodedUrl} status=${response.status}`)
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

  // @google-cloud/storage v7 ではカスタムメタデータは metadata.metadata に格納する
  await file.save(content, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        // dbtの stg_pdf_uploads__extracted_texts.sql が参照するフィールド
        'original-filename': buildOriginalFilename(media.source_url),
        'source-url': media.source_url,
        'letter-id': String(media.post),
        'media-id': String(media.id),
        'modified_gmt': media.modified_gmt,  // WordPressの文書更新日時（UTC）
      },
    },
  })
}
