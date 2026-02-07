import { CONFIG, validateConfig } from './config'
import { getPdfFilesFromFolder, getFileContent, getProcessedFileIds, markFileAsProcessed } from './drive'
import { uploadToGcs, checkFileExistsInGcs } from './gcs'
import { getAuthMethod } from './auth'

interface SyncResult {
  processed: number
  skipped: number
  failed: number
  errors: string[]
}

function syncDriveToGcs(): SyncResult {
  validateConfig()

  const result: SyncResult = {
    processed: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  const processedIds = getProcessedFileIds()
  const files = getPdfFilesFromFolder()

  console.log(`Found ${files.length} PDF files in folder`)

  for (const file of files) {
    try {
      if (processedIds.has(file.id)) {
        console.log(`Skipping already processed file: ${file.name} (${file.id})`)
        result.skipped++
        continue
      }

      if (checkFileExistsInGcs(file.id)) {
        console.log(`File already exists in GCS: ${file.name} (${file.id})`)
        markFileAsProcessed(file.id)
        result.skipped++
        continue
      }

      console.log(`Processing file: ${file.name} (${file.id})`)
      const blob = getFileContent(file.id)
      const uploadResult = uploadToGcs(file.id, file.name, blob, file.modifiedTime)

      if (uploadResult.success) {
        console.log(`Successfully uploaded to: ${uploadResult.gcsPath}`)
        markFileAsProcessed(file.id)
        result.processed++
      } else {
        console.error(`Failed to upload ${file.name}: ${uploadResult.error}`)
        result.failed++
        result.errors.push(`${file.name}: ${uploadResult.error}`)
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      console.error(`Error processing ${file.name}: ${error}`)
      result.failed++
      result.errors.push(`${file.name}: ${error}`)
    }
  }

  console.log(`Sync complete: ${result.processed} processed, ${result.skipped} skipped, ${result.failed} failed`)
  return result
}

function setupTrigger(): void {
  const triggers = ScriptApp.getProjectTriggers()
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'syncDriveToGcs') {
      ScriptApp.deleteTrigger(trigger)
    }
  }

  ScriptApp.newTrigger('syncDriveToGcs')
    .timeBased()
    .everyHours(1)
    .create()

  console.log('Hourly trigger created for syncDriveToGcs')
}

function manualSync(): SyncResult {
  return syncDriveToGcs()
}

function getConfig(): typeof CONFIG {
  return CONFIG
}

interface AuthInfo {
  method: 'service_account' | 'user_oauth'
  description: string
}

function getAuthInfo(): AuthInfo {
  const method = getAuthMethod()
  const description = method === 'service_account'
    ? 'サービスアカウント認証（GCS_SERVICE_ACCOUNT_KEY）を使用中'
    : 'ユーザーOAuth認証を使用中（GCS_SERVICE_ACCOUNT_KEYを設定するとサービスアカウント認証に切り替わります）'
  return { method, description }
}

export { syncDriveToGcs, setupTrigger, manualSync, getConfig, getAuthInfo }
