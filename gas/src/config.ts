export const CONFIG = {
  DRIVE_FOLDER_ID: PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID') || '',
  GCS_BUCKET_NAME: PropertiesService.getScriptProperties().getProperty('GCS_BUCKET_NAME') || '',
  GCP_PROJECT_ID: PropertiesService.getScriptProperties().getProperty('GCP_PROJECT_ID') || '',
  ARCHIVE_FOLDER_ID: PropertiesService.getScriptProperties().getProperty('ARCHIVE_FOLDER_ID') || '',
  // サービスアカウントキー（オプション）: 設定されていない場合は実行ユーザーのOAuthを使用
  // GCS_SERVICE_ACCOUNT_KEY: PropertiesService.getScriptProperties().getProperty('GCS_SERVICE_ACCOUNT_KEY')
  MAX_FILES_PER_RUN: 50,
  RETRY_COUNT: 3,
  RETRY_DELAY_MS: 1000,
}

export function validateConfig(): void {
  if (!CONFIG.DRIVE_FOLDER_ID) {
    throw new Error('DRIVE_FOLDER_ID is not configured')
  }
  if (!CONFIG.GCS_BUCKET_NAME) {
    throw new Error('GCS_BUCKET_NAME is not configured')
  }
  if (!CONFIG.GCP_PROJECT_ID) {
    throw new Error('GCP_PROJECT_ID is not configured')
  }
  if (!CONFIG.ARCHIVE_FOLDER_ID) {
    throw new Error('ARCHIVE_FOLDER_ID is not configured')
  }
}
