// WordPress REST APIクライアント（純粋関数）

import type { LetterPost, MediaFile } from './types.js'

const PER_PAGE = 100

/**
 * WordPress REST APIからletter投稿を全件取得する
 * ページネーションを自動処理する
 */
export const fetchLetters = async (
  baseUrl: string,
  modifiedAfter: Date,
): Promise<LetterPost[]> => {
  const results: LetterPost[] = []
  let page = 1

  while (true) {
    const url = new URL(`${baseUrl}/wp-json/wp/v2/letter`)
    url.searchParams.set('modified_after', modifiedAfter.toISOString())
    url.searchParams.set('orderby', 'modified')
    url.searchParams.set('order', 'desc')
    url.searchParams.set('per_page', String(PER_PAGE))
    url.searchParams.set('page', String(page))

    const response = await fetch(url.toString())

    if (response.status === 400) {
      throw new Error(`WordPress API から 400 エラー: ${url.toString()}`)
    }
    if (!response.ok) {
      throw new Error(`WordPress API エラー: status=${response.status}`)
    }

    const posts = (await response.json()) as LetterPost[]
    results.push(...posts)

    // 取得件数が per_page 未満なら最終ページ
    if (posts.length < PER_PAGE) {
      break
    }
    page++
  }

  return results
}

/**
 * letter投稿の複数PDF添付から最新1件を選択する純粋関数
 *
 * 【設計方針】
 * WordPress運用上、同一投稿に古いPDFを削除せず訂正版を追加するケースがある。
 * その場合、古いファイルは `-1` サフィックス付きで残存する。
 * 内容的な重複アップロードによるイベント二重登録を防ぐため、
 * 複数添付がある場合は最新（modified日時が最も新しい）ものを訂正版とみなして1件に絞る。
 */
export const selectLatestAttachment = (attachments: MediaFile[]): MediaFile | undefined => {
  if (attachments.length === 0) return undefined
  return attachments.reduce((latest, current) =>
    new Date(current.modified_gmt).getTime() > new Date(latest.modified_gmt).getTime()
      ? current
      : latest,
  )
}

/**
 * 指定したletter投稿に紐づくPDF添付ファイルを取得する
 */
export const fetchAttachments = async (
  baseUrl: string,
  letterId: number,
): Promise<MediaFile[]> => {
  const url = new URL(`${baseUrl}/wp-json/wp/v2/media`)
  url.searchParams.set('parent', String(letterId))
  url.searchParams.set('mime_type', 'application/pdf')

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(
      `添付ファイル取得エラー: letterId=${letterId} status=${response.status}`,
    )
  }

  return (await response.json()) as MediaFile[]
}

/**
 * GCSパスを生成する純粋関数
 * web/{YYYY}/{MM}/{media_id}_{sanitized_title}.pdf
 */
export const buildGcsPath = (media: MediaFile): string => {
  const date = new Date(media.date)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const title = sanitizeFilename(media.title.rendered)
  return `web/${year}/${month}/${media.id}_${title}.pdf`
}

/**
 * ファイル名をサニタイズする純粋関数
 * 日本語はそのまま保持し、ファイルシステムで不正な文字のみ除去する
 */
export const sanitizeFilename = (title: string): string => {
  // HTMLエンティティをデコード
  const decoded = title
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")

  // ファイルシステムで不正な文字を除去（/ \ " : * ? < > | を削除）
  return decoded.replace(/[/\\":*?<>|]/g, '')
}
