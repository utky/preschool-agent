const mockGetProperty = jest.fn()
const mockGetScriptProperties = jest.fn(() => ({
  getProperty: mockGetProperty,
}))

;(globalThis as any).PropertiesService = {
  getScriptProperties: mockGetScriptProperties,
}

describe('config', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGetProperty.mockReset()
  })

  describe('CONFIG', () => {
    it('should read ARCHIVE_FOLDER_ID from Script Properties', async () => {
      mockGetProperty.mockImplementation((key: string) => {
        const props: Record<string, string> = {
          DRIVE_FOLDER_ID: 'input-folder',
          GCS_BUCKET_NAME: 'bucket',
          GCP_PROJECT_ID: 'project',
          ARCHIVE_FOLDER_ID: 'archive-folder-123',
        }
        return props[key] ?? null
      })
      const { CONFIG } = await import('./config')
      expect(CONFIG.ARCHIVE_FOLDER_ID).toBe('archive-folder-123')
    })

    it('should default ARCHIVE_FOLDER_ID to empty string when not set', async () => {
      mockGetProperty.mockReturnValue(null)
      const { CONFIG } = await import('./config')
      expect(CONFIG.ARCHIVE_FOLDER_ID).toBe('')
    })

  })

  describe('validateConfig', () => {
    it('should throw when DRIVE_FOLDER_ID is not configured', async () => {
      mockGetProperty.mockImplementation((key: string) =>
        key === 'DRIVE_FOLDER_ID' ? null : 'some-value'
      )
      const { validateConfig } = await import('./config')
      expect(() => validateConfig()).toThrow('DRIVE_FOLDER_ID is not configured')
    })

    it('should throw when GCS_BUCKET_NAME is not configured', async () => {
      mockGetProperty.mockImplementation((key: string) =>
        key === 'GCS_BUCKET_NAME' ? null : 'some-value'
      )
      const { validateConfig } = await import('./config')
      expect(() => validateConfig()).toThrow('GCS_BUCKET_NAME is not configured')
    })

    it('should throw when GCP_PROJECT_ID is not configured', async () => {
      mockGetProperty.mockImplementation((key: string) =>
        key === 'GCP_PROJECT_ID' ? null : 'some-value'
      )
      const { validateConfig } = await import('./config')
      expect(() => validateConfig()).toThrow('GCP_PROJECT_ID is not configured')
    })

    it('should throw when ARCHIVE_FOLDER_ID is not configured', async () => {
      mockGetProperty.mockImplementation((key: string) =>
        key === 'ARCHIVE_FOLDER_ID' ? null : 'some-value'
      )
      const { validateConfig } = await import('./config')
      expect(() => validateConfig()).toThrow('ARCHIVE_FOLDER_ID is not configured')
    })

    it('should not throw when all configs are set', async () => {
      mockGetProperty.mockReturnValue('some-value')
      const { validateConfig } = await import('./config')
      expect(() => validateConfig()).not.toThrow()
    })
  })
})
