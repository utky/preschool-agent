// Cloud Run Jobエントリーポイント

import { Storage } from '@google-cloud/storage'
import { loadConfig } from './config.js'
import { fetchLetters, fetchAttachments, selectLatestAttachment, buildGcsPath } from './wordpress.js'
import {
  isAlreadyUploaded,
  downloadPdf,
  uploadToGcs,
} from './gcs.js'
import type { UploadResult } from './types.js'

const run = async (): Promise<void> => {
  const config = loadConfig()
  const storage = new Storage({ projectId: config.gcsProjectId })

  console.log(`クローラー開始: sinceDateTime=${config.sinceDateTime}`)

  const sinceDate = new Date(config.sinceDateTime)
  const letters = await fetchLetters(config.wordpressBaseUrl, sinceDate)
  console.log(`letter投稿数: ${letters.length}`)

  const results: UploadResult[] = []

  for (const letter of letters) {
    const attachments = await fetchAttachments(
      config.wordpressBaseUrl,
      letter.id,
    )

    // 複数添付がある場合は最新（訂正版）のみ処理する
    // 設計方針: wordpress.ts の selectLatestAttachment 参照
    const media = selectLatestAttachment(attachments)
    if (!media) continue

    const gcsPath = buildGcsPath(media)

    // 既にアップロード済みならスキップ（冪等性保証）
    const alreadyUploaded = await isAlreadyUploaded(
      storage,
      config.gcsBucketName,
      gcsPath,
    )
    if (alreadyUploaded) {
      console.log(`スキップ（既存）: ${gcsPath}`)
      results.push({ mediaId: media.id, gcsPath, skipped: true })
      continue
    }

    try {
      const pdfBuffer = await downloadPdf(media.source_url, config.wordpressBaseUrl)
      await uploadToGcs(storage, config.gcsBucketName, gcsPath, pdfBuffer, media)
      console.log(`アップロード完了: ${gcsPath}`)
      results.push({ mediaId: media.id, gcsPath, skipped: false })
    } catch (err) {
      console.error(`アップロード失敗（継続）: ${gcsPath}`, err)
      results.push({ mediaId: media.id, gcsPath, skipped: false, error: true })
    }
  }

  const uploaded = results.filter((r) => !r.skipped && !r.error).length
  const skipped = results.filter((r) => r.skipped).length
  const errors = results.filter((r) => r.error).length
  console.log(
    `クローラー完了: アップロード=${uploaded} スキップ=${skipped} エラー=${errors} 合計=${results.length}`,
  )
  if (errors > 0) {
    console.error(`${errors}件のアップロードに失敗しました`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('クローラーエラー:', err)
  process.exit(1)
})
