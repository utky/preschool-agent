/**
 * サービスアカウント認証モジュール
 * GASからGCSへアクセスするためのOAuth2トークンを取得する
 */

interface ServiceAccountKey {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
}

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

const TOKEN_CACHE_KEY = 'GCS_ACCESS_TOKEN'
const TOKEN_EXPIRY_KEY = 'GCS_TOKEN_EXPIRY'
// トークンの有効期限より5分前に更新
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

/**
 * サービスアカウントキーをScript Propertiesから取得
 */
function getServiceAccountKey(): ServiceAccountKey | null {
  const keyJson = PropertiesService.getScriptProperties().getProperty('GCS_SERVICE_ACCOUNT_KEY')
  if (!keyJson) {
    return null
  }
  try {
    return JSON.parse(keyJson) as ServiceAccountKey
  } catch {
    console.error('Failed to parse service account key JSON')
    return null
  }
}

/**
 * JWTヘッダーをBase64URLエンコード
 */
function base64UrlEncode(data: string): string {
  const base64 = Utilities.base64Encode(data, Utilities.Charset.UTF_8)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * RSA-SHA256で署名を生成
 */
function signJwt(input: string, privateKey: string): string {
  // PEMフォーマットからキーを抽出
  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const pemContents = privateKey
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '')

  const keyBytes = Utilities.base64Decode(pemContents)
  const signature = Utilities.computeRsaSha256Signature(input, keyBytes)
  const base64Signature = Utilities.base64Encode(signature)
  return base64Signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * サービスアカウントでアクセストークンを取得
 */
function getServiceAccountToken(serviceAccountKey: ServiceAccountKey): string {
  const now = Math.floor(Date.now() / 1000)
  const expiry = now + 3600 // 1時間後

  // JWTクレームセット
  const claimSet = {
    iss: serviceAccountKey.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write',
    aud: serviceAccountKey.token_uri,
    iat: now,
    exp: expiry,
  }

  // JWTヘッダー
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }

  // JWT作成
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet))
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`
  const signature = signJwt(signatureInput, serviceAccountKey.private_key)
  const jwt = `${signatureInput}.${signature}`

  // トークンエンドポイントにリクエスト
  const response = UrlFetchApp.fetch(serviceAccountKey.token_uri, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    },
    muteHttpExceptions: true,
  })

  if (response.getResponseCode() !== 200) {
    throw new Error(`Failed to get access token: ${response.getContentText()}`)
  }

  const tokenResponse = JSON.parse(response.getContentText()) as TokenResponse
  return tokenResponse.access_token
}

/**
 * キャッシュからトークンを取得、または新規取得
 */
function getCachedToken(serviceAccountKey: ServiceAccountKey): string {
  const cache = CacheService.getScriptCache()
  const cachedToken = cache.get(TOKEN_CACHE_KEY)
  const cachedExpiry = cache.get(TOKEN_EXPIRY_KEY)

  // キャッシュが有効な場合はそれを使用
  if (cachedToken && cachedExpiry) {
    const expiryTime = parseInt(cachedExpiry, 10)
    if (Date.now() < expiryTime - TOKEN_REFRESH_BUFFER_MS) {
      return cachedToken
    }
  }

  // 新規トークン取得
  const token = getServiceAccountToken(serviceAccountKey)
  const expiryTime = Date.now() + 3600 * 1000 // 1時間後

  // キャッシュに保存（最大6時間、ただしトークンは1時間で失効）
  cache.put(TOKEN_CACHE_KEY, token, 3600)
  cache.put(TOKEN_EXPIRY_KEY, expiryTime.toString(), 3600)

  return token
}

/**
 * GCSアクセス用のアクセストークンを取得
 * サービスアカウントキーが設定されている場合はそれを使用、
 * そうでなければ実行ユーザーのOAuthトークンを使用
 */
export function getAccessToken(): string {
  const serviceAccountKey = getServiceAccountKey()

  if (serviceAccountKey) {
    console.log('Using service account authentication')
    return getCachedToken(serviceAccountKey)
  }

  // フォールバック: 実行ユーザーのトークン
  console.log('Using user OAuth token (fallback)')
  return ScriptApp.getOAuthToken()
}

/**
 * 認証方式を確認するヘルパー関数
 */
export function getAuthMethod(): 'service_account' | 'user_oauth' {
  const serviceAccountKey = getServiceAccountKey()
  return serviceAccountKey ? 'service_account' : 'user_oauth'
}
