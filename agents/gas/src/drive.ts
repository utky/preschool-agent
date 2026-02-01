import { CONFIG } from './config'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: Date
  size: number
}

export function getPdfFilesFromFolder(): DriveFile[] {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID)
  const files = folder.getFilesByType(MimeType.PDF)
  const result: DriveFile[] = []

  while (files.hasNext() && result.length < CONFIG.MAX_FILES_PER_RUN) {
    const file = files.next()
    result.push({
      id: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      modifiedTime: file.getLastUpdated(),
      size: file.getSize(),
    })
  }

  return result
}

export function getFileContent(fileId: string): GoogleAppsScript.Base.Blob {
  const file = DriveApp.getFileById(fileId)
  return file.getBlob()
}

export function getProcessedFileIds(): Set<string> {
  const properties = PropertiesService.getScriptProperties()
  const stored = properties.getProperty(CONFIG.PROCESSED_FILES_KEY)
  if (!stored) {
    return new Set()
  }
  try {
    const ids = JSON.parse(stored) as string[]
    return new Set(ids)
  } catch {
    return new Set()
  }
}

export function markFileAsProcessed(fileId: string): void {
  const processedIds = getProcessedFileIds()
  processedIds.add(fileId)

  const idsArray = Array.from(processedIds)
  if (idsArray.length > 1000) {
    idsArray.splice(0, idsArray.length - 1000)
  }

  const properties = PropertiesService.getScriptProperties()
  properties.setProperty(CONFIG.PROCESSED_FILES_KEY, JSON.stringify(idsArray))
}
