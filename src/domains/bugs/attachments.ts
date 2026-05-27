import type { Attachment } from './model'

/** Convert raw File objects to local Attachment entries with blob URLs. */
export function filesToAttachments(files: File[]): Attachment[] {
  return files.map((file) => ({ name: file.name, url: URL.createObjectURL(file), type: file.type, file }))
}

/** Extract pasted images from a ClipboardEvent. Returns File[] (empty if none). */
export function getImageFilesFromPaste(event: React.ClipboardEvent): File[] {
  const items = Array.from(event.clipboardData?.items || [])
  return items
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => {
      const file = item.getAsFile()
      if (!file) return null
      const extension = file.type.split('/')[1] || 'png'
      return new File([file], `pasted-image-${Date.now()}.${extension}`, { type: file.type })
    })
    .filter((file): file is File => file !== null)
}
