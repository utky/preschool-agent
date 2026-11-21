// アクセス制御のポリシー判定（純粋関数）

// GCS オブジェクトの参照
export interface GcsObjectRef {
  readonly bucket: string
  readonly object: string
}

const GCS_URI_PATTERN = /^gs:\/\/([^/]+)\/(.+)$/

// `gs://<bucket>/<object>` 形式の URI を分解する。形式が不正な場合は null
export function parseGcsUri(uri: string): GcsObjectRef | null {
  const match = GCS_URI_PATTERN.exec(uri)
  if (!match) return null
  const [, bucket, object] = match
  return bucket && object ? { bucket, object } : null
}

// 署名付きURLを発行してよいオブジェクトか判定する
// 許可バケットが未設定（undefined / 空文字）の場合は常に false（fail-closed）
export function isSignableObject(ref: GcsObjectRef, allowedBucket: string | undefined): boolean {
  return Boolean(allowedBucket) && ref.bucket === allowedBucket
}

// カンマ区切りのメールアドレス許可リストを正規化（trim・小文字化・空要素除去）して返す
export function parseAllowedEmails(raw: string | undefined): readonly string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
}

// ログインを許可するメールアドレスか判定する
// 許可リストが空の場合は常に false（fail-closed）
export function isEmailAllowed(email: string, allowed: readonly string[]): boolean {
  return allowed.includes(email.trim().toLowerCase())
}
