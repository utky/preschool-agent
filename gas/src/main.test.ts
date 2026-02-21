;(globalThis as any).PropertiesService = {
  getScriptProperties: jest.fn(() => ({
    getProperty: jest.fn((key: string) => {
      const props: Record<string, string> = {
        DRIVE_FOLDER_ID: 'input-folder',
        GCS_BUCKET_NAME: 'bucket',
        GCP_PROJECT_ID: 'project',
        ARCHIVE_FOLDER_ID: 'archive-folder',
      }
      return props[key] ?? null
    }),
  })),
}
;(globalThis as any).ScriptApp = {
  getOAuthToken: jest.fn(() => 'token'),
  getProjectTriggers: jest.fn(() => []),
  newTrigger: jest.fn(() => ({
    timeBased: jest.fn(() => ({
      everyHours: jest.fn(() => ({ create: jest.fn() })),
    })),
  })),
  deleteTrigger: jest.fn(),
}

jest.mock('./drive', () => ({
  getPdfFilesFromFolder: jest.fn(),
  getFileContent: jest.fn(),
  moveFileToArchive: jest.fn(),
}))

jest.mock('./gcs', () => ({
  uploadToGcs: jest.fn(),
  checkFileExistsInGcs: jest.fn(),
}))

jest.mock('./auth', () => ({
  getAuthMethod: jest.fn(() => 'user_oauth'),
}))

import { syncDriveToGcs } from './main'
import { getPdfFilesFromFolder, getFileContent, moveFileToArchive } from './drive'
import { uploadToGcs, checkFileExistsInGcs } from './gcs'

const mockGetPdfFiles = getPdfFilesFromFolder as jest.MockedFunction<typeof getPdfFilesFromFolder>
const mockGetFileContent = getFileContent as jest.MockedFunction<typeof getFileContent>
const mockMoveFileToArchive = moveFileToArchive as jest.MockedFunction<typeof moveFileToArchive>
const mockUploadToGcs = uploadToGcs as jest.MockedFunction<typeof uploadToGcs>
const mockCheckFileExistsInGcs = checkFileExistsInGcs as jest.MockedFunction<typeof checkFileExistsInGcs>

const makePdf = (id: string, name: string) => ({
  id,
  name,
  mimeType: 'application/pdf',
  modifiedTime: new Date(),
  size: 100,
})

describe('syncDriveToGcs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should process all files in the input folder', () => {
    const files = [makePdf('f1', 'a.pdf'), makePdf('f2', 'b.pdf')]
    mockGetPdfFiles.mockReturnValue(files)
    mockCheckFileExistsInGcs.mockReturnValue(false)
    mockGetFileContent.mockReturnValue({} as any)
    mockUploadToGcs.mockReturnValue({ success: true, gcsPath: 'gs://bucket/path' })

    const result = syncDriveToGcs()

    expect(result.processed).toBe(2)
    expect(result.skipped).toBe(0)
    expect(mockCheckFileExistsInGcs).toHaveBeenCalledWith('a.pdf')
    expect(mockCheckFileExistsInGcs).toHaveBeenCalledWith('b.pdf')
    expect(mockUploadToGcs).toHaveBeenCalledWith('f1', 'a.pdf', expect.anything())
    expect(mockUploadToGcs).toHaveBeenCalledWith('f2', 'b.pdf', expect.anything())
    expect(mockMoveFileToArchive).toHaveBeenCalledTimes(2)
    expect(mockMoveFileToArchive).toHaveBeenCalledWith('f1')
    expect(mockMoveFileToArchive).toHaveBeenCalledWith('f2')
  })

  it('should move file to archive even if it already exists in GCS', () => {
    mockGetPdfFiles.mockReturnValue([makePdf('f1', 'a.pdf')])
    mockCheckFileExistsInGcs.mockReturnValue(true)

    const result = syncDriveToGcs()

    expect(result.skipped).toBe(1)
    expect(result.processed).toBe(0)
    expect(mockCheckFileExistsInGcs).toHaveBeenCalledWith('a.pdf')
    expect(mockMoveFileToArchive).toHaveBeenCalledWith('f1')
    expect(mockUploadToGcs).not.toHaveBeenCalled()
  })

  it('should not move file to archive if upload fails', () => {
    mockGetPdfFiles.mockReturnValue([makePdf('f1', 'a.pdf')])
    mockCheckFileExistsInGcs.mockReturnValue(false)
    mockGetFileContent.mockReturnValue({} as any)
    mockUploadToGcs.mockReturnValue({ success: false, error: 'Upload failed' })

    expect(() => syncDriveToGcs()).toThrow('Sync failed: 1 file(s) failed - a.pdf: Upload failed')
    expect(mockMoveFileToArchive).not.toHaveBeenCalled()
  })

  it('should count as processed even if move to archive fails after successful upload', () => {
    mockGetPdfFiles.mockReturnValue([makePdf('f1', 'a.pdf')])
    mockCheckFileExistsInGcs.mockReturnValue(false)
    mockGetFileContent.mockReturnValue({} as any)
    mockUploadToGcs.mockReturnValue({ success: true, gcsPath: 'gs://bucket/path' })
    mockMoveFileToArchive.mockImplementationOnce(() => {
      throw new Error('Move failed')
    })

    const result = syncDriveToGcs()

    expect(result.processed).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('should handle empty folder', () => {
    mockGetPdfFiles.mockReturnValue([])

    const result = syncDriveToGcs()

    expect(result.processed).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.failed).toBe(0)
  })

  it('should throw error on getFileContent failure', () => {
    mockGetPdfFiles.mockReturnValue([makePdf('f1', 'a.pdf')])
    mockCheckFileExistsInGcs.mockReturnValue(false)
    mockGetFileContent.mockImplementationOnce(() => {
      throw new Error('File read error')
    })

    expect(() => syncDriveToGcs()).toThrow('Sync failed: 1 file(s) failed - a.pdf: File read error')
  })

  it('should continue processing remaining files when one fails and throw at end', () => {
    const files = [makePdf('f1', 'ok.pdf'), makePdf('f2', 'fail.pdf'), makePdf('f3', 'ok2.pdf')]
    mockGetPdfFiles.mockReturnValue(files)
    mockCheckFileExistsInGcs.mockReturnValue(false)
    mockGetFileContent.mockReturnValue({} as any)
    mockUploadToGcs
      .mockReturnValueOnce({ success: true, gcsPath: 'gs://bucket/p1' })
      .mockReturnValueOnce({ success: false, error: 'Upload failed' })
      .mockReturnValueOnce({ success: true, gcsPath: 'gs://bucket/p3' })

    expect(() => syncDriveToGcs()).toThrow('Sync failed: 1 file(s) failed')
    // 失敗したファイルがあっても残りは処理を続行する
    expect(mockUploadToGcs).toHaveBeenCalledTimes(3)
    expect(mockMoveFileToArchive).toHaveBeenCalledTimes(2)
  })
})
