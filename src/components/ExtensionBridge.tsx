import React from 'react'
import { SEVERITIES, type Severity } from '../constants'
import { generateBugId, insertBugWithRetry } from '../lib/aiParsers'
import { queryClient } from '../lib/queryClient'
import { buildAttachmentPath, withTeamPayload } from '../lib/teamScope'
import { findTesterByName } from '../lib/testerLookup'
import { useAuth } from '../lib/useAuth'
import { useTeamAccess } from '../lib/teamAccess'
import { supabase } from '../supabaseClient'

const EXTENSION_REQUEST_SOURCE = 'mushi-extension-content'
const EXTENSION_RESPONSE_SOURCE = 'mushi-extension-bridge'

type ExtensionBridgeAction = 'ping' | 'get_context' | 'create_bug'

interface ExtensionBridgeRequest {
  source: string
  direction: 'to-page'
  requestId: string
  action: ExtensionBridgeAction
  payload?: unknown
}

interface ExtensionBridgeResponse {
  source: string
  direction: 'to-content'
  requestId: string
  ok: boolean
  data?: unknown
  error?: string
  code?: string
}

interface ExtensionAttachmentInput {
  name: string
  type: string
  dataUrl: string
}

interface ExtensionCreateBugPayload {
  title: string
  description?: string
  severity?: string
  pageUrl?: string
  pageTitle?: string
  device?: string
  category?: string | null
  attachments?: ExtensionAttachmentInput[]
}

interface ExtensionCreateBugResult {
  bugId: string
  bugUrl: string
  uploadedCount: number
}

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, '')
}

export function extractDomainFromLink(link: string): string | null {
  const raw = link.trim()
  if (!raw) return null

  const candidate = /^(https?:)?\/\//i.test(raw) ? raw : `https://${raw}`

  try {
    return normalizeHostname(new URL(candidate).hostname)
  } catch {
    return null
  }
}

function resolveEntryUrl(entry: unknown): string | null {
  if (entry && typeof entry === 'object' && 'url' in entry) {
    const url = (entry as Record<string, unknown>).url
    return typeof url === 'string' ? url : null
  }
  if (typeof entry === 'string') {
    try {
      const parsed = JSON.parse(entry)
      if (parsed && typeof parsed === 'object' && typeof parsed.url === 'string') {
        return parsed.url
      }
    } catch { /* not JSON, treat as plain URL */ }
    return entry
  }
  return null
}

function normalizeSeverity(severity?: string): Severity {
  if (severity && SEVERITIES.includes(severity as Severity)) {
    return severity as Severity
  }
  return 'high'
}

function buildDescriptionWithPageContext(
  description: string | undefined,
  pageUrl: string | undefined,
  pageTitle: string | undefined,
): string {
  const baseDescription = description?.trim() || ''
  const url = pageUrl?.trim() || ''
  const title = pageTitle?.trim() || ''

  if (!url) return baseDescription

  const contextLines = ['Captured page:']
  if (title) contextLines.push(`Title: ${title}`)
  contextLines.push(`URL: ${url}`)

  if (!baseDescription) {
    return contextLines.join('\n')
  }

  return `${baseDescription}\n\n${contextLines.join('\n')}`
}



function dataUrlToFile(dataUrl: string, fallbackName: string, fallbackType: string): File {
  const [header, encoded] = dataUrl.split(',', 2)
  if (!header || !encoded) {
    throw new Error('Invalid attachment payload.')
  }

  const mimeMatch = header.match(/^data:([^;]+);base64$/)
  const mimeType = mimeMatch?.[1] || fallbackType || 'application/octet-stream'
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  const safeName = fallbackName.trim() || `attachment-${Date.now()}`
  return new File([bytes], safeName, { type: mimeType })
}

function getUserDisplayName(user: ReturnType<typeof useAuth>['user']): string {
  if (!user) return 'Unknown'

  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const metadataName = typeof metadata?.name === 'string' ? metadata.name.trim() : ''
  if (metadataName) return metadataName

  if (user.email?.trim()) return user.email.trim()
  return 'Unknown'
}

export default function ExtensionBridge() {
  const { user } = useAuth()
  const { activeTeamId } = useTeamAccess()
  const [allowedDomains, setAllowedDomains] = React.useState<string[]>([])

  React.useEffect(() => {
    let cancelled = false

    const loadAllowedDomains = async () => {
      if (!supabase || !activeTeamId) {
        if (!cancelled) setAllowedDomains([])
        return
      }

      const { data, error } = await supabase
        .from('products')
        .select('link, links')
        .eq('team_id', activeTeamId)

      if (cancelled) return

      if (error) {
        console.error('Failed to load product domains for extension bridge:', error)
        setAllowedDomains([])
        return
      }

      const allDomains: string[] = []
      for (const row of (data || []) as Array<{ link: string | null; links: unknown[] | null }>) {
        if (row.link) {
          const d = extractDomainFromLink(row.link)
          if (d) allDomains.push(d)
        }
        if (Array.isArray(row.links)) {
          for (const entry of row.links) {
            const url = resolveEntryUrl(entry)
            if (url) {
              const d = extractDomainFromLink(url)
              if (d) allDomains.push(d)
            }
          }
        }
      }

      const domains = Array.from(new Set(allDomains)).sort((a, b) => a.localeCompare(b))
      setAllowedDomains(domains)
    }

    void loadAllowedDomains()

    return () => {
      cancelled = true
    }
  }, [activeTeamId])

  React.useEffect(() => {
    const email = user?.email?.trim() || null
    const authenticated = Boolean(user)
    const authMode = user ? 'supabase' : 'none'
    const displayName = getUserDisplayName(user)
    const contextPayload = {
      authenticated,
      authMode,
      activeTeamId,
      allowedDomains,
      user: {
        id: user?.id || null,
        email,
        name: displayName,
      },
      appBaseUrl: `${window.location.origin}/`,
    }

    const createBugFromPayload = async (payload: ExtensionCreateBugPayload): Promise<ExtensionCreateBugResult> => {
      if (!supabase) {
        throw new Error('Database is not connected.')
      }

      if (!activeTeamId) {
        throw new Error('No active team selected.')
      }

      if (!user) {
        throw new Error('Not authenticated.')
      }

      const title = payload.title?.trim()
      if (!title) {
        throw new Error('Bug title is required.')
      }

      const severity = normalizeSeverity(payload.severity)
      let finalId = await generateBugId(severity, activeTeamId)
      const descriptionWithContext = buildDescriptionWithPageContext(
        payload.description,
        payload.pageUrl,
        payload.pageTitle,
      )

      const tester = getUserDisplayName(user)
      const matchedTester = await findTesterByName(tester, activeTeamId)
      const bugInsert = withTeamPayload(
        {
          id: finalId,
          title,
          description: descriptionWithContext,
          severity,
          tester,
          tester_id: matchedTester?.id || null,
          device: payload.device?.trim() || 'Chrome Extension',
          page: payload.pageTitle?.trim() || 'Web capture',
          category: payload.category?.trim() || null,
        },
        activeTeamId,
      ) as Record<string, unknown>

      finalId = await insertBugWithRetry(supabase, bugInsert, finalId)

      let uploadedCount = 0
      const attachmentInputs = payload.attachments || []

      for (const attachment of attachmentInputs) {
        if (!attachment.dataUrl?.startsWith('data:')) continue

        try {
          const file = dataUrlToFile(attachment.dataUrl, attachment.name, attachment.type)
          const storagePath = buildAttachmentPath(activeTeamId, finalId, file.name)

          const { error: uploadError } = await supabase.storage
            .from('attachments')
            .upload(storagePath, file)

          if (uploadError) {
            console.error('Failed to upload extension attachment:', uploadError)
            continue
          }

          const { data: urlData } = supabase.storage
            .from('attachments')
            .getPublicUrl(storagePath)

          const { error: insertAttachmentError } = await supabase
            .from('attachments')
            .insert(
              withTeamPayload(
                {
                  bug_id: finalId,
                  name: file.name,
                  type: file.type || attachment.type || 'application/octet-stream',
                  url: urlData.publicUrl,
                },
                activeTeamId,
              ),
            )

          if (insertAttachmentError) {
            console.error('Failed to persist extension attachment row:', insertAttachmentError)
            continue
          }

          uploadedCount += 1
        } catch (error) {
          console.error('Failed to process extension attachment:', error)
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['bugs-data'] })

      return {
        bugId: finalId,
        bugUrl: `${window.location.origin}/`,
        uploadedCount,
      }
    }

    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== window) return

      const request = event.data as ExtensionBridgeRequest | null
      if (!request || typeof request !== 'object') return
      if (request.source !== EXTENSION_REQUEST_SOURCE) return
      if (request.direction !== 'to-page') return
      if (!request.requestId || typeof request.requestId !== 'string') return

      const respond = (response: Omit<ExtensionBridgeResponse, 'source' | 'direction' | 'requestId'>) => {
        const payload: ExtensionBridgeResponse = {
          source: EXTENSION_RESPONSE_SOURCE,
          direction: 'to-content',
          requestId: request.requestId,
          ...response,
        }
        window.postMessage(payload, '*')
      }

      void (async () => {
        try {
          if (request.action === 'ping' || request.action === 'get_context') {
            respond({ ok: true, data: contextPayload })
            return
          }

          if (request.action === 'create_bug') {
            if (!contextPayload.authenticated) {
              respond({
                ok: false,
                error: 'Sign in to Mushi before creating bugs from the extension.',
                code: 'UNAUTHENTICATED',
              })
              return
            }

            const payload = (request.payload || {}) as ExtensionCreateBugPayload
            const result = await createBugFromPayload(payload)
            respond({ ok: true, data: result })
            return
          }

          respond({ ok: false, error: `Unknown extension action: ${request.action}` })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unexpected extension bridge error.'
          respond({ ok: false, error: message })
        }
      })()
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [activeTeamId, allowedDomains, user])

  return null
}
