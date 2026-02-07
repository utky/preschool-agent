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
      modifiedTime: file.getLastUpdated() as unknown as Date,
      size: file.getSize(),
    })
  }

  return result
}

export function getFileContent(fileId: string): GoogleAppsScript.Base.Blob {
  const file = DriveApp.getFileById(fileId)
  return file.getBlob()
}

export function moveFileToArchive(fileId: string): void {
  const file = DriveApp.getFileById(fileId)
  const archiveFolder = DriveApp.getFolderById(CONFIG.ARCHIVE_FOLDER_ID)
  file.moveTo(archiveFolder)
}
