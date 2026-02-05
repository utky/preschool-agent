import { CONFIG } from './config'
import { getAccessToken } from './auth'

function formatDatePath(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  return `${year}-${month}-${day}/${hour}`
}

export function uploadToGcs(
  fileId: string,
  fileName: string,
  blob: GoogleAppsScript.Base.Blob,
  modifiedTime: Date
): { success: boolean; gcsPath?: string; error?: string } {
  const datePath = formatDatePath(modifiedTime)
  const gcsPath = `${datePath}/${fileId}.pdf`
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${CONFIG.GCS_BUCKET_NAME}/o?uploadType=media&name=${encodeURIComponent(gcsPath)}`

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    contentType: blob.getContentType() || 'application/pdf',
    payload: blob.getBytes(),
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'x-goog-meta-original-filename': encodeURIComponent(fileName),
      'x-goog-meta-drive-file-id': fileId,
    },
    muteHttpExceptions: true,
  }

  let lastError: string | undefined

  for (let attempt = 0; attempt < CONFIG.RETRY_COUNT; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, options)
      const responseCode = response.getResponseCode()

      if (responseCode === 200 || responseCode === 201) {
        return { success: true, gcsPath: `gs://${CONFIG.GCS_BUCKET_NAME}/${gcsPath}` }
      }

      lastError = `HTTP ${responseCode}: ${response.getContentText()}`

      if (responseCode === 429 || responseCode >= 500) {
        Utilities.sleep(CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt))
        continue
      }

      return { success: false, error: lastError }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
      Utilities.sleep(CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt))
    }
  }

  return { success: false, error: lastError }
}

export function checkFileExistsInGcs(fileId: string): boolean {
  const prefix = encodeURIComponent('')
  const url = `https://storage.googleapis.com/storage/v1/b/${CONFIG.GCS_BUCKET_NAME}/o?prefix=${prefix}&matchGlob=**/${fileId}.pdf`

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'get',
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
    },
    muteHttpExceptions: true,
  }

  try {
    const response = UrlFetchApp.fetch(url, options)
    if (response.getResponseCode() !== 200) {
      return false
    }
    const data = JSON.parse(response.getContentText()) as { items?: unknown[] }
    return (data.items?.length ?? 0) > 0
  } catch {
    return false
  }
}
