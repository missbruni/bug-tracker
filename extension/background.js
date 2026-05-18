const DEFAULT_MUSHI_BASE_URL = 'https://mushi-navy.vercel.app/'
const FALLBACK_BASE_URLS = ['http://localhost:5173/', 'http://localhost:5174/']
const CONTEXT_CACHE_MS = 20_000
let getMushiContextLock = null
const SETTINGS_DEFAULTS = {
  floatingShortcutEnabled: false,
}
const DEBUG_LOGS = false

function safeJSONStringify(value) {
  const seen = new WeakSet()
  return JSON.stringify(value, (_key, current) => {
    if (current instanceof Error) {
      return {
        name: current.name,
        message: current.message,
        stack: current.stack,
      }
    }

    if (typeof current === 'object' && current !== null) {
      if (seen.has(current)) return '[Circular]'
      seen.add(current)
    }

    return current
  }, 2)
}

function debugLog(...args) {
  if (!DEBUG_LOGS) return
  const payload = {
    scope: 'background',
    ts: new Date().toISOString(),
    args,
  }

  try {
    console.log(`[MushiExt:bg] ${safeJSONStringify(payload)}`)
  } catch {
    console.log('[MushiExt:bg]', ...args)
  }
}

function isLocalhostTab(tabUrl) {
  if (!tabUrl) return false
  try {
    const parsed = new URL(tabUrl)
    return parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  } catch {
    return false
  }
}

let cachedContext = null

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeBaseUrl(rawUrl) {
  const candidate = (rawUrl || '').trim()
  if (!candidate) return null

  try {
    const parsed = new URL(candidate)
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}

function normalizeHost(hostname) {
  return (hostname || '').trim().toLowerCase().replace(/^www\./, '')
}

function hostMatchesAllowedDomains(hostname, allowedDomains) {
  const normalizedHost = normalizeHost(hostname)
  if (!normalizedHost) return false

  return (allowedDomains || []).some((domain) => {
    const normalizedDomain = normalizeHost(domain)
    if (!normalizedDomain) return false
    return (
      normalizedHost === normalizedDomain ||
      normalizedHost.endsWith(`.${normalizedDomain}`)
    )
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getSettings() {
  debugLog('getSettings:start')
  const stored = await chrome.storage.local.get(SETTINGS_DEFAULTS)
  const settings = {
    floatingShortcutEnabled: Boolean(stored.floatingShortcutEnabled),
  }
  debugLog('getSettings:result', settings)
  return settings
}

async function broadcastFloatingShortcut(enabled) {
  debugLog('broadcastFloatingShortcut:start', { enabled })
  const tabs = await chrome.tabs.query({})
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab?.id || !isHttpPage(tab.url)) return
      try {
        await ensureContentScript(tab.id, tab.url || '')
        await sendMessageToTab(tab.id, {
          type: 'EXTENSION_SET_FLOATING_SHORTCUT',
          enabled,
        })
      } catch {
        // Ignore tabs where content script cannot be reached.
      }
    }),
  )
  debugLog('broadcastFloatingShortcut:done')
}

function isHttpPage(url) {
  try {
    const parsed = new URL(url || '')
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function sendMessageToTab(tabId, message, timeoutMs = 10_000) {
  return await new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('Tab message timed out.'))
    }, timeoutMs)

    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (settled) return
      settled = true
      clearTimeout(timer)

      const runtimeError = chrome.runtime.lastError
      if (runtimeError) {
        reject(new Error(runtimeError.message))
        return
      }

      resolve(response)
    })
  })
}

function isMissingReceiverError(error) {
  const message = error instanceof Error ? error.message : String(error || '')
  return (
    message.includes('Receiving end does not exist') ||
    message.includes('Could not establish connection')
  )
}

function isBridgeUnavailableError(error) {
  const message = error instanceof Error ? error.message : String(error || '')
  return (
    message.includes('Bridge action timed out') ||
    message.includes('Tab message timed out') ||
    message.includes('No response from extension')
  )
}

async function ensureContentScript(tabId, tabUrl) {
  debugLog('ensureContentScript:start', { tabId, tabUrl })
  if (!isHttpPage(tabUrl)) {
    throw new Error('Capture works only on normal http(s) pages.')
  }

  try {
    await sendMessageToTab(tabId, { type: 'EXTENSION_PING' }, 2_500)
    debugLog('ensureContentScript:already-present', { tabId })
    return
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error
    }
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  })
  debugLog('ensureContentScript:injected', { tabId })

  await sendMessageToTab(tabId, { type: 'EXTENSION_PING' }, 2_500)
  debugLog('ensureContentScript:ping-ok-after-inject', { tabId })
}

async function getStoredBaseUrl() {
  return DEFAULT_MUSHI_BASE_URL
}

function matchesBaseUrl(tabUrl, baseUrl) {
  if (!tabUrl || !baseUrl) return false

  try {
    const tabParsed = new URL(tabUrl)
    const baseParsed = new URL(baseUrl)

    if (tabParsed.origin !== baseParsed.origin) return false

    const basePath = baseParsed.pathname.replace(/\/+$/, '')
    if (!basePath || basePath === '/') return true

    return tabParsed.pathname.startsWith(basePath)
  } catch {
    return false
  }
}

async function getCandidateBaseUrls() {
  return unique([DEFAULT_MUSHI_BASE_URL, ...FALLBACK_BASE_URLS])
}

async function findMushiTabs() {
  const baseUrls = await getCandidateBaseUrls()
  const tabs = await chrome.tabs.query({})

  const matches = tabs.filter((tab) =>
    baseUrls.some((base) => matchesBaseUrl(tab.url, base)) || isLocalhostTab(tab.url),
  )

  return matches
}

async function findMushiTab() {
  const matches = await findMushiTabs()

  if (!matches.length) return null

  const active = matches.find((tab) => tab.active)
  return active || matches[0]
}

async function ensureMushiTab(openIfMissing = true, activateOnCreate = false) {
  const existing = await findMushiTab()
  if (existing) return existing
  if (!openIfMissing) return null

  const baseUrl = await getStoredBaseUrl()
  return await chrome.tabs.create({ url: baseUrl, active: activateOnCreate })
}

async function requestBridge(tabId, action, payload, timeoutMs = 12_000) {
  const tab = await chrome.tabs.get(tabId)
  await ensureContentScript(tabId, tab.url || '')

  return await sendMessageToTab(
    tabId,
    {
      type: 'MUSHI_BRIDGE_REQUEST',
      action,
      payload,
    },
    timeoutMs,
  )
}

async function getMushiContext(forceRefresh = false) {
  const now = Date.now()
  if (
    !forceRefresh &&
    cachedContext &&
    now - cachedContext.timestamp < CONTEXT_CACHE_MS
  ) {
    return cachedContext
  }

  // Serialize concurrent calls so only one reload attempt happens at a time.
  if (getMushiContextLock) {
    const lockResult = await getMushiContextLock
    if (lockResult) return lockResult
    // Lock holder failed — fall through and try ourselves.
  }

  let releaseLock
  getMushiContextLock = new Promise((resolve) => { releaseLock = resolve })

  try {
    const result = await getMushiContextInner(forceRefresh)
    releaseLock(result)
    return result
  } catch (error) {
    releaseLock(null)
    throw error
  } finally {
    getMushiContextLock = null
  }
}

async function getMushiContextInner(forceRefresh) {
  const tab = await ensureMushiTab(true, false)
  if (!tab?.id) {
    throw new Error('Unable to open a Mushi tab.')
  }

  let response = null
  let lastError = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await requestBridge(tab.id, 'get_context', {}, 6_000)
      break
    } catch (error) {
      lastError = error
      debugLog('getMushiContext:bridge-attempt-error', { attempt, error })
      if (isBridgeUnavailableError(error)) {
        break
      }
      await sleep(500)
    }
  }

  if (!response && isBridgeUnavailableError(lastError)) {
    debugLog('getMushiContext:bridge-unavailable-reloading-tab', { tabId: tab.id })
    try {
      await chrome.tabs.reload(tab.id)
      await sleep(1_500)
      response = await requestBridge(tab.id, 'get_context', {}, 6_000)
      debugLog('getMushiContext:bridge-recovered-after-reload', { tabId: tab.id })
    } catch (reloadError) {
      lastError = reloadError
      debugLog('getMushiContext:bridge-still-unavailable-after-reload', reloadError)
    }
  }

  if (!response) {
    const candidateTabs = await findMushiTabs()
    for (const candidate of candidateTabs) {
      if (!candidate?.id || candidate.id === tab.id) continue

      try {
        debugLog('getMushiContext:trying-alternate-tab', { tabId: candidate.id, url: candidate.url })
        const alternateResponse = await requestBridge(candidate.id, 'get_context', {}, 6_000)
        if (alternateResponse?.ok) {
          response = alternateResponse
          tab.id = candidate.id
          debugLog('getMushiContext:alternate-tab-success', { tabId: candidate.id })
          break
        }
      } catch (alternateError) {
        lastError = alternateError
        debugLog('getMushiContext:alternate-tab-error', {
          tabId: candidate.id,
          error: alternateError,
        })
      }
    }
  }

  if (!response) {
    if (isBridgeUnavailableError(lastError)) {
      throw new Error(
        'Mushi tab is open but the extension bridge is unavailable. Refresh the Mushi tab. For local testing, keep your localhost Mushi tab open. If this persists on prod, deploy the latest web-app bridge changes.',
      )
    }

    const message =
      lastError instanceof Error
        ? lastError.message
        : 'Failed to contact Mushi tab.'
    throw new Error(message)
  }

  if (!response?.ok) {
    throw new Error(response?.error || 'Failed to fetch Mushi context.')
  }

  const next = {
    tabId: tab.id,
    context: response.data || {},
    timestamp: Date.now(),
  }
  cachedContext = next
  return next
}

async function ensureAuthenticatedContext() {
  let state = await getMushiContext(true)
  if (state.context?.authenticated) return state

  const tab = await ensureMushiTab(true, true)
  if (!tab?.id) {
    throw new Error('Unable to open Mushi login tab.')
  }

  const baseUrl = await getStoredBaseUrl()
  await chrome.tabs.update(tab.id, { url: baseUrl, active: true })

  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    await sleep(3_000)
    try {
      state = await getMushiContext(true)
    } catch {
      continue
    }
    if (state.context?.authenticated) return state
  }

  throw new Error('Please complete login in Mushi, then try again.')
}

function parsePageHostname(payloadPage) {
  if (payloadPage?.hostname) return payloadPage.hostname

  try {
    return new URL(payloadPage?.url || '').hostname
  } catch {
    return ''
  }
}

async function canCaptureOnPage(payloadPage) {
  debugLog('canCaptureOnPage:start', payloadPage)
  let state
  try {
    state = await getMushiContext(false)
  } catch (error) {
    debugLog('canCaptureOnPage:context-error-retrying', error)
    state = await getMushiContext(true)
  }
  const hostname = parsePageHostname(payloadPage)
  let allowedDomains = state?.context?.allowedDomains || []

  // Retry with force refresh if we got empty domains but user is authenticated
  if (!allowedDomains.length && state?.context?.authenticated) {
    debugLog('canCaptureOnPage:no-domains-retrying')
    try {
      state = await getMushiContext(true)
      allowedDomains = state?.context?.allowedDomains || []
    } catch {
      // Use whatever we had
    }
  }

  if (!allowedDomains.length) {
    debugLog('canCaptureOnPage:no-allowed-domains')
    return {
      allowed: false,
      authenticated: Boolean(state?.context?.authenticated),
      reason:
        'No product URLs are configured for the active team. Add product links in Team Management first.',
      allowedDomains,
    }
  }

  const allowed = hostMatchesAllowedDomains(hostname, allowedDomains)
  if (!allowed) {
    debugLog('canCaptureOnPage:blocked', { hostname, allowedDomains })
    return {
      allowed: false,
      authenticated: Boolean(state.context?.authenticated),
      reason: 'Capture is disabled on this domain.',
      allowedDomains,
    }
  }

  return {
    allowed: true,
    authenticated: Boolean(state.context?.authenticated),
    reason: '',
    allowedDomains,
  }
}

async function createBugFromExtension(payload) {
  const pageUrl = payload?.pageUrl || ''
  let pageHostname = ''
  try {
    pageHostname = new URL(pageUrl).hostname
  } catch {
    pageHostname = ''
  }

  let state = await getMushiContext(true)
  const allowedDomains = state.context?.allowedDomains || []

  if (!hostMatchesAllowedDomains(pageHostname, allowedDomains)) {
    return {
      ok: false,
      error: 'Capture is disabled for this domain.',
      code: 'DOMAIN_BLOCKED',
    }
  }

  if (!state.context?.authenticated) {
    state = await ensureAuthenticatedContext()
  }

  let response = await requestBridge(state.tabId, 'create_bug', payload)

  if (!response?.ok && response?.code === 'UNAUTHENTICATED') {
    state = await ensureAuthenticatedContext()
    response = await requestBridge(state.tabId, 'create_bug', payload)
  }

  if (!response?.ok) {
    return {
      ok: false,
      error: response?.error || 'Failed to create bug via Mushi bridge.',
      code: response?.code || 'CREATE_FAILED',
    }
  }

  return {
    ok: true,
    data: response.data,
  }
}

async function getActiveTabPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab?.url) {
    return null
  }

  let hostname = ''
  try {
    hostname = new URL(tab.url).hostname
  } catch {
    hostname = ''
  }

  return {
    tabId: tab.id,
    url: tab.url,
    title: tab.title || '',
    hostname,
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let responseSent = false
  const safeSendResponse = (response) => {
    if (responseSent) return
    responseSent = true
    try {
      sendResponse(response)
    } catch {
      // Message port closed (sender tab was reloaded/navigated away).
    }
  }
  const run = async () => {
    debugLog('onMessage', { type: message?.type, senderTabId: sender?.tab?.id })
    if (message?.type === 'EXTENSION_CAN_CAPTURE') {
      const result = await canCaptureOnPage(message.page || {})
      debugLog('EXTENSION_CAN_CAPTURE:result', result)
      safeSendResponse({ ok: true, ...result })
      return
    }

    if (message?.type === 'EXTENSION_CAPTURE_SCREENSHOT') {
      const windowId = sender?.tab?.windowId
      if (typeof windowId !== 'number') {
        safeSendResponse({ ok: false, error: 'Unable to detect browser window for screenshot.' })
        return
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
      safeSendResponse({
        ok: true,
        dataUrl,
        name: `screenshot-${Date.now()}.png`,
        type: 'image/png',
      })
      return
    }

    if (message?.type === 'EXTENSION_CREATE_BUG') {
      const result = await createBugFromExtension(message.payload || {})
      safeSendResponse(result)
      return
    }

    if (message?.type === 'EXTENSION_GET_ACTIVE_PAGE') {
      const page = await getActiveTabPage()
      safeSendResponse({ ok: true, page })
      return
    }

    if (message?.type === 'EXTENSION_GET_SETTINGS') {
      const settings = await getSettings()
      safeSendResponse({ ok: true, settings })
      return
    }

    if (message?.type === 'EXTENSION_SET_FLOATING_SHORTCUT') {
      const enabled = Boolean(message.enabled)
      debugLog('EXTENSION_SET_FLOATING_SHORTCUT', { enabled })
      await chrome.storage.local.set({ floatingShortcutEnabled: enabled })
      await broadcastFloatingShortcut(enabled)
      safeSendResponse({ ok: true, settings: { floatingShortcutEnabled: enabled } })
      return
    }

    if (message?.type === 'EXTENSION_OPEN_MUSHI') {
      const tab = await ensureMushiTab(true, true)
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { active: true })
      }
      safeSendResponse({ ok: true })
      return
    }

    if (message?.type === 'EXTENSION_OPEN_COMPOSER_IN_ACTIVE_TAB') {
      debugLog('EXTENSION_OPEN_COMPOSER_IN_ACTIVE_TAB:start')
      const page = await getActiveTabPage()
      if (!page?.tabId) {
        safeSendResponse({ ok: false, error: 'No active tab available.' })
        return
      }

      if (!isHttpPage(page.url)) {
        safeSendResponse({
          ok: false,
          error: 'Open capture on a normal website tab (http/https).',
        })
        return
      }

      const result = await canCaptureOnPage(page)
      if (!result.allowed) {
        debugLog('EXTENSION_OPEN_COMPOSER_IN_ACTIVE_TAB:blocked', result)
        safeSendResponse({
          ok: false,
          error: result.reason,
          allowedDomains: result.allowedDomains,
        })
        return
      }

      try {
        debugLog('EXTENSION_OPEN_COMPOSER_IN_ACTIVE_TAB:ensure-content', { tabId: page.tabId })
        await ensureContentScript(page.tabId, page.url)
        const settings = await getSettings()
        debugLog('EXTENSION_OPEN_COMPOSER_IN_ACTIVE_TAB:apply-shortcut-setting', settings)
        await sendMessageToTab(page.tabId, {
          type: 'EXTENSION_SET_FLOATING_SHORTCUT',
          enabled: settings.floatingShortcutEnabled,
        })
        debugLog('EXTENSION_OPEN_COMPOSER_IN_ACTIVE_TAB:open-composer-send')
        await sendMessageToTab(page.tabId, {
          type: 'EXTENSION_OPEN_COMPOSER',
          skipValidation: true,
          openMeta: {
            source: 'popup',
          },
        })
        debugLog('EXTENSION_OPEN_COMPOSER_IN_ACTIVE_TAB:open-composer-ack')
      } catch (error) {
        debugLog('EXTENSION_OPEN_COMPOSER_IN_ACTIVE_TAB:error', error)
        const messageText = error instanceof Error ? error.message : 'Unable to open composer.'
        safeSendResponse({
          ok: false,
          error:
            isMissingReceiverError(error)
              ? 'Please refresh this tab once and try again.'
              : messageText,
        })
        return
      }

      safeSendResponse({ ok: true })
      return
    }
  }

  run().catch((error) => {
    debugLog('onMessage:unhandled-error', error)
    const messageText = error instanceof Error ? error.message : 'Unexpected extension error.'
    safeSendResponse({ ok: false, error: messageText })
  })

  return true
})
