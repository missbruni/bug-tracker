/**
 * Build a shareable URL that filters the bug list to a specific bug.
 * Uses the existing `?q=` search param so the link works with the
 * current filter infrastructure — no extra routing needed.
 */
export function buildBugPermalink(bugId: string): string {
  const url = new URL(window.location.href)
  // Reset filters so the recipient sees a clean view focused on this bug
  const keep = new URLSearchParams()
  keep.set('q', bugId)
  url.search = keep.toString()
  url.hash = ''
  return url.toString()
}

/**
 * Copy `text` to the clipboard.
 * Returns `true` on success, `false` on failure.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
