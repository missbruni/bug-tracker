/// <reference lib="dom" />
import { test, expect, describe, mock, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AttachmentCard from '../AttachmentCard'
import type { Attachment } from '../../types'

afterEach(() => cleanup())

describe('AttachmentCard', () => {
  test('renders image preview for image attachment', () => {
    const att: Attachment = { name: 'photo.png', url: 'https://example.com/photo.png', type: 'image/png' }
    render(<AttachmentCard att={att} />)
    const img = screen.getByAltText('photo.png')
    expect(img).toBeInTheDocument()
    expect(img.tagName).toBe('IMG')
  })

  test('renders video preview for video attachment', () => {
    const att: Attachment = { name: 'clip.mp4', url: 'https://example.com/clip.mp4', type: 'video/mp4' }
    const { container } = render(<AttachmentCard att={att} />)
    expect(container.querySelector('video')).not.toBeNull()
  })

  test('renders generic icon for non-media attachment', () => {
    const att: Attachment = { name: 'doc.pdf', url: 'https://example.com/doc.pdf', type: 'application/pdf' }
    render(<AttachmentCard att={att} />)
    expect(screen.getByText('doc.pdf')).toBeInTheDocument()
    // Should not have img or video
    expect(screen.queryByRole('img')).toBeNull()
  })

  test('renders attachment name', () => {
    const att: Attachment = { name: 'screenshot.jpg', url: 'https://example.com/screenshot.jpg', type: 'image/jpeg' }
    render(<AttachmentCard att={att} />)
    expect(screen.getByText('screenshot.jpg')).toBeInTheDocument()
  })

  test('renders remove button when onRemove is provided', () => {
    const onRemove = mock(() => {})
    const att: Attachment = { name: 'file.png', url: 'https://example.com/file.png', type: 'image/png' }
    const { container } = render(<AttachmentCard att={att} onRemove={onRemove} />)
    const removeBtn = container.querySelector('.lucide-x')?.closest('button')
    expect(removeBtn).not.toBeNull()
    fireEvent.click(removeBtn!)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  test('does not render remove button when onRemove is not provided', () => {
    const att: Attachment = { name: 'file.png', url: 'https://example.com/file.png', type: 'image/png' }
    const { container } = render(<AttachmentCard att={att} />)
    const removeBtn = container.querySelector('.lucide-x')?.closest('button')
    expect(removeBtn).toBeUndefined()
  })

  test('calls onImageClick when image preview is clicked', () => {
    const onImageClick = mock(() => {})
    const att: Attachment = { name: 'photo.png', url: 'https://example.com/photo.png', type: 'image/png' }
    render(<AttachmentCard att={att} onImageClick={onImageClick} />)
    fireEvent.click(screen.getByAltText('photo.png'))
    expect(onImageClick).toHaveBeenCalledWith('https://example.com/photo.png', 'photo.png', 'image')
  })

  test('renders note when present', () => {
    const att: Attachment = { name: 'file.png', url: 'https://example.com/file.png', type: 'image/png', note: 'Screenshot of the bug' }
    render(<AttachmentCard att={att} />)
    expect(screen.getByText('Screenshot of the bug')).toBeInTheDocument()
  })
})
