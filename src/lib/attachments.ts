import type { Attachment } from '../types'

/** Convert raw File objects to local Attachment entries with blob URLs. */
export function filesToAttachments(files: File[]): Attachment[] {
  return files.map((f) => ({ name: f.name, url: URL.createObjectURL(f), type: f.type, file: f }))
}

/** Extract pasted images from a ClipboardEvent. Returns File[] (empty if none). */
export function getImageFilesFromPaste(e: React.ClipboardEvent): File[] {
  const items = Array.from(e.clipboardData?.items || [])
  return items
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => {
      const file = item.getAsFile()
      if (!file) return null
      const ext = file.type.split('/')[1] || 'png'
      return new File([file], `pasted-image-${Date.now()}.${ext}`, { type: file.type })
    })
    .filter((f): f is File => f !== null)
}
