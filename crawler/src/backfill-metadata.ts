// 既存GCSオブジェクトに modified_gmt メタデータをバックフィルする一回限りのスクリプト
//
// 対象: media-id メタデータを持つオブジェクト（クローラーアップロード分）
// 除外: drive-file-id のみ持つオブジェクト（GASアップロード分）
//       → WordPressメディアではないため modified_gmt 取得不可
//
// 実行方法:
//   WORDPRESS_BASE_URL=https://... GCS_BUCKET_NAME=... GCP_PROJECT_ID=... \
//   npx tsx src/backfill-metadata.ts

import { Storage } from '@google-cloud/storage'

const WORDPRESS_BASE_URL = process.env['WORDPRESS_BASE_URL']
const GCS_BUCKET_NAME = process.env['GCS_BUCKET_NAME']
const GCP_PROJECT_ID = process.env['GCP_PROJECT_ID']

if (!WORDPRESS_BASE_URL || !GCS_BUCKET_NAME || !GCP_PROJECT_ID) {
  console.error('必須環境変数: WORDPRESS_BASE_URL, GCS_BUCKET_NAME, GCP_PROJECT_ID')
  process.exit(1)
}

/**
 * WordPress API からメディアの modified_gmt を取得する
 */
const fetchModifiedGmt = async (
  baseUrl: string,
  mediaId: string,
): Promise<string | null> => {
  const url = `${baseUrl}/wp-json/wp/v2/media/${mediaId}`
  const response = await fetch(url)
  if (!response.ok) {
    console.warn(`  WordPress API エラー: mediaId=${mediaId} status=${response.status}`)
    return null
  }
  const data = (await response.json()) as { modified_gmt?: string }
  return data.modified_gmt ?? null
}

const run = async (): Promise<void> => {
  const storage = new Storage({ projectId: GCP_PROJECT_ID })
  const bucket = storage.bucket(GCS_BUCKET_NAME!)

  console.log(`バックフィル開始: bucket=${GCS_BUCKET_NAME}`)

  const [files] = await bucket.getFiles({ prefix: 'web/' })
  console.log(`対象オブジェクト候補数: ${files.length}`)

  let successCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const file of files) {
    const customMeta = file.metadata.metadata as Record<string, string> | undefined
    const mediaId = customMeta?.['media-id']

    // media-id がない = GASアップロード分 → スキップ
    if (!mediaId) {
      skippedCount++
      continue
    }

    // すでに modified_gmt が設定済み → スキップ
    if (customMeta?.['modified_gmt']) {
      skippedCount++
      continue
    }

    const modifiedGmt = await fetchModifiedGmt(WORDPRESS_BASE_URL!, mediaId)
    if (!modifiedGmt) {
      console.warn(`  スキップ（modified_gmt 取得失敗）: ${file.name}`)
      errorCount++
      continue
    }

    await file.setMetadata({
      metadata: { modified_gmt: modifiedGmt },
    })

    console.log(`  パッチ完了: ${file.name} → modified_gmt=${modifiedGmt}`)
    successCount++
  }

  console.log(
    `バックフィル完了: 成功=${successCount} スキップ=${skippedCount} エラー=${errorCount}`,
  )
}

run().catch((err) => {
  console.error('バックフィルエラー:', err)
  process.exit(1)
})
