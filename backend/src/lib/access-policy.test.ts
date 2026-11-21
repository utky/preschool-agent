import { describe, it, expect } from '@jest/globals'
import { parseGcsUri, isSignableObject, parseAllowedEmails, isEmailAllowed } from './access-policy.js'

const PDF_BUCKET = 'school-agent-lofilab-pdf-uploads'

describe('access-policy', () => {
  describe('parseGcsUri', () => {
    it('should split a valid gs:// URI into bucket and object', () => {
      expect(parseGcsUri(`gs://${PDF_BUCKET}/2026/04/お知らせ.pdf`)).toEqual({
        bucket: PDF_BUCKET,
        object: '2026/04/お知らせ.pdf',
      })
    })

    it.each([
      ['empty string', ''],
      ['http URL', 'https://storage.googleapis.com/bucket/file.pdf'],
      ['missing object', `gs://${PDF_BUCKET}/`],
      ['missing slash after bucket', `gs://${PDF_BUCKET}`],
      ['empty bucket', 'gs:///file.pdf'],
      ['leading whitespace', ` gs://${PDF_BUCKET}/file.pdf`],
    ])('should return null for %s', (_label, uri) => {
      expect(parseGcsUri(uri)).toBeNull()
    })
  })

  describe('isSignableObject', () => {
    const ref = { bucket: PDF_BUCKET, object: 'file.pdf' }

    it('should allow objects in the allowed bucket', () => {
      expect(isSignableObject(ref, PDF_BUCKET)).toBe(true)
    })

    it('should reject objects in other buckets', () => {
      expect(isSignableObject({ bucket: 'school-agent-lofilab-api-data', object: 'documents_000.json' }, PDF_BUCKET)).toBe(false)
    })

    it('should reject buckets that only share a prefix with the allowed bucket', () => {
      expect(isSignableObject({ bucket: `${PDF_BUCKET}-evil`, object: 'file.pdf' }, PDF_BUCKET)).toBe(false)
    })

    it.each([
      ['undefined', undefined],
      ['empty string', ''],
    ])('should reject everything when the allowed bucket is %s', (_label, allowed) => {
      expect(isSignableObject(ref, allowed)).toBe(false)
    })
  })

  describe('parseAllowedEmails', () => {
    it('should trim, lowercase and drop empty entries', () => {
      expect(parseAllowedEmails(' Alice@Example.com, ,bob@example.com ,')).toEqual([
        'alice@example.com',
        'bob@example.com',
      ])
    })

    it.each([
      ['undefined', undefined],
      ['empty string', ''],
      ['only separators', ' , ,'],
    ])('should return an empty list for %s', (_label, raw) => {
      expect(parseAllowedEmails(raw)).toEqual([])
    })
  })

  describe('isEmailAllowed', () => {
    const allowed = ['alice@example.com', 'bob@example.com']

    it('should allow an email in the list', () => {
      expect(isEmailAllowed('alice@example.com', allowed)).toBe(true)
    })

    it('should compare emails case-insensitively', () => {
      expect(isEmailAllowed('Alice@Example.COM', allowed)).toBe(true)
    })

    it('should reject an email not in the list', () => {
      expect(isEmailAllowed('mallory@example.com', allowed)).toBe(false)
    })

    it('should reject every email when the list is empty', () => {
      expect(isEmailAllowed('alice@example.com', [])).toBe(false)
    })
  })
})
