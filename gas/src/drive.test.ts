const mockMoveTo = jest.fn()
const mockGetFileById = jest.fn(() => ({
  moveTo: mockMoveTo,
  getId: jest.fn(() => 'file-123'),
  getName: jest.fn(() => 'test.pdf'),
  getMimeType: jest.fn(() => 'application/pdf'),
  getLastUpdated: jest.fn(() => new Date()),
  getSize: jest.fn(() => 1024),
  getBlob: jest.fn(() => ({})),
}))

const mockArchiveFolder = { id: 'archive-folder' }
const mockInputFolder = {
  getFilesByType: jest.fn(() => ({
    hasNext: jest.fn().mockReturnValueOnce(false),
    next: jest.fn(),
  })),
}
const mockGetFolderById = jest.fn((id: string) =>
  id === 'archive-folder' ? mockArchiveFolder : mockInputFolder
)

;(globalThis as any).DriveApp = {
  getFileById: mockGetFileById,
  getFolderById: mockGetFolderById,
}
;(globalThis as any).MimeType = { PDF: 'application/pdf' }
;(globalThis as any).PropertiesService = {
  getScriptProperties: jest.fn(() => ({
    getProperty: jest.fn((key: string) => {
      const props: Record<string, string> = {
        DRIVE_FOLDER_ID: 'input-folder',
        ARCHIVE_FOLDER_ID: 'archive-folder',
        GCS_BUCKET_NAME: 'bucket',
        GCP_PROJECT_ID: 'project',
      }
      return props[key] ?? null
    }),
  })),
}

import { moveFileToArchive } from './drive'

describe('drive', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('moveFileToArchive', () => {
    it('should move file to archive folder using DriveApp', () => {
      moveFileToArchive('file-123')

      expect(mockGetFileById).toHaveBeenCalledWith('file-123')
      expect(mockGetFolderById).toHaveBeenCalledWith('archive-folder')
      expect(mockMoveTo).toHaveBeenCalledWith(mockArchiveFolder)
    })

    it('should throw when moveTo fails', () => {
      mockMoveTo.mockImplementationOnce(() => {
        throw new Error('Permission denied')
      })

      expect(() => moveFileToArchive('file-123')).toThrow('Permission denied')
    })
  })

})
