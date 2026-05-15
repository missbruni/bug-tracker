/// <reference lib="dom" />
import { test, expect, describe } from 'bun:test'
import { filesToAttachments, getImageFilesFromPaste } from '../attachments'

describe('filesToAttachments', () => {
  test('converts files to attachment objects with blob URLs', () => {
    const file = new File(['hello'], 'screenshot.png', { type: 'image/png' })
    const result = filesToAttachments([file])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('screenshot.png')
    expect(result[0].type).toBe('image/png')
    expect(result[0].file).toBe(file)
    expect(result[0].url).toMatch(/^blob:/)
  })

  test('handles multiple files', () => {
    const files = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
    ]
    const result = filesToAttachments(files)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('a.png')
    expect(result[1].name).toBe('b.jpg')
  })

  test('returns empty array for empty input', () => {
    expect(filesToAttachments([])).toEqual([])
  })
})

describe('getImageFilesFromPaste', () => {
  function makePasteEvent(items: DataTransferItem[]): React.ClipboardEvent {
    return {
      clipboardData: {
        items: items as unknown as DataTransferItemList,
      },
    } as unknown as React.ClipboardEvent
  }

  test('extracts image files from paste event', () => {
    const file = new File(['img'], 'image.png', { type: 'image/png' })
    const item = {
      type: 'image/png',
      getAsFile: () => file,
    } as unknown as DataTransferItem
    const result = getImageFilesFromPaste(makePasteEvent([item]))
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('image/png')
    expect(result[0].name).toMatch(/^pasted-image-\d+\.png$/)
  })

  test('ignores non-image items', () => {
    const item = {
      type: 'text/plain',
      getAsFile: () => null,
    } as unknown as DataTransferItem
    const result = getImageFilesFromPaste(makePasteEvent([item]))
    expect(result).toHaveLength(0)
  })

  test('handles null getAsFile gracefully', () => {
    const item = {
      type: 'image/png',
      getAsFile: () => null,
    } as unknown as DataTransferItem
    const result = getImageFilesFromPaste(makePasteEvent([item]))
    expect(result).toHaveLength(0)
  })

  test('returns empty for empty clipboard', () => {
    const result = getImageFilesFromPaste(makePasteEvent([]))
    expect(result).toHaveLength(0)
  })
})
