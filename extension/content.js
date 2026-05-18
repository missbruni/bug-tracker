;(() => {
const CONTENT_SCRIPT_GUARD_KEY = '__mushi_extension_content_loaded__'
if (globalThis[CONTENT_SCRIPT_GUARD_KEY]) {
  return
}
globalThis[CONTENT_SCRIPT_GUARD_KEY] = true

const EXTENSION_REQUEST_SOURCE = 'mushi-extension-content'
const EXTENSION_RESPONSE_SOURCE = 'mushi-extension-bridge'

const COMPOSER_ROOT_ID = 'mushi-extension-composer-root'
const FLOATING_SHORTCUT_ID = 'mushi-extension-floating-shortcut'
const FLOATING_SHORTCUT_POSITION_KEY = 'floatingShortcutPosition'
const FLOATING_SHORTCUT_SIZE = 46
const FLOATING_SHORTCUT_MARGIN = 16
const KEY_SHORTCUT = 'alt+shift+b'

const THEME = {
  bg: '#0a0e14',
  surface: '#1c2026',
  surfaceAlt: '#252a31',
  border: '#2f353d',
  borderAccent: 'rgba(0, 255, 204, 0.35)',
  text: '#ecf2ef',
  textMuted: '#94a29d',
  primary: '#00ffcc',
  primarySoft: 'rgba(0, 255, 204, 0.12)',
  danger: '#ff6aaf',
  dangerSoft: 'rgba(255, 0, 122, 0.12)',
}
const TYPE_SCALE = {
  title: '16px',
  body: '14px',
  meta: '13px',
  button: '13px',
  cta: '16px',
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
    scope: 'content',
    ts: new Date().toISOString(),
    args,
  }

  try {
    console.log(`[MushiExt:content] ${safeJSONStringify(payload)}`)
  } catch {
    console.log('[MushiExt:content]', ...args)
  }
}

let currentOverlay = null
let floatingShortcutEnabled = false
let floatingShortcutPosition = null
let floatingShortcutSuppressClickUntil = 0
let composerDraft = null

function createRequestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function sendRuntimeMessage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message })
        return
      }
      resolve(response || { ok: false, error: 'No response from extension.' })
    })
  })
}

function sendRuntimeMessageWithTimeout(payload, timeoutMs = 12000) {
  return new Promise((resolve) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      resolve({ ok: false, error: 'Extension request timed out. Please try again.' })
    }, timeoutMs)

    void sendRuntimeMessage(payload).then((response) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve(response)
    }).catch(() => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve({ ok: false, error: 'Unexpected extension request failure. Please try again.' })
    })
  })
}

function relayToPageBridge(action, payload) {
  return new Promise((resolve, reject) => {
    const requestId = createRequestId()
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(new Error(`Bridge action timed out: ${action}`))
    }, 12_000)

    function onMessage(event) {
      if (event.source !== window) return
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.source !== EXTENSION_RESPONSE_SOURCE) return
      if (data.direction !== 'to-content') return
      if (data.requestId !== requestId) return

      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      resolve(data)
    }

    window.addEventListener('message', onMessage)
    window.postMessage(
      {
        source: EXTENSION_REQUEST_SOURCE,
        direction: 'to-page',
        requestId,
        action,
        payload,
      },
      '*',
    )
  })
}

function formatAllowedDomains(domains) {
  if (!Array.isArray(domains) || !domains.length) return ''
  return domains.slice(0, 3).join(', ')
}

function showToast(message, tone = 'default') {
  const toast = document.createElement('div')
  toast.textContent = message
  toast.style.position = 'fixed'
  toast.style.bottom = '20px'
  toast.style.right = '20px'
  toast.style.zIndex = '2147483646'
  toast.style.maxWidth = '320px'
  toast.style.padding = '10px 14px'
  toast.style.borderRadius = '8px'
  toast.style.fontSize = '12px'
  toast.style.fontWeight = '600'
  toast.style.color = THEME.text
  toast.style.boxShadow = '0 16px 35px rgba(0, 0, 0, 0.45)'
  toast.style.border = `1px solid ${THEME.border}`
  toast.style.background =
    tone === 'error'
      ? THEME.dangerSoft
      : tone === 'success'
        ? THEME.primarySoft
        : THEME.surfaceAlt

  document.body.appendChild(toast)
  window.setTimeout(() => {
    toast.remove()
  }, 3000)
}

function inferAttachmentName(fileType, index) {
  const extension = (fileType || '').split('/')[1] || 'bin'
  return `attachment-${Date.now()}-${index}.${extension}`
}

function createFileInput(accept) {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = accept
  return input
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(`Unable to read file: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

async function collectFilesAsAttachments(files) {
  const attachments = []
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const dataUrl = await fileToDataUrl(file)
    attachments.push({
      name: file.name || inferAttachmentName(file.type, index),
      type: file.type || 'application/octet-stream',
      dataUrl,
    })
  }
  return attachments
}

function saveDraftFromComposer() {
  const root = document.getElementById(COMPOSER_ROOT_ID)
  if (!root) return
  const titleEl = root.querySelector('input[placeholder="Bug title"]')
  const descEl = root.querySelector('textarea[placeholder="Describe what happened"]')
  const sevEl = root.querySelector('select')
  const title = titleEl?.value || ''
  const description = descEl?.value || ''
  const severity = sevEl?.value || 'high'
  if (title || description) {
    composerDraft = { title, description, severity }
  }
}

function removeComposer(saveDraft = false) {
  if (saveDraft) saveDraftFromComposer()
  const existing = document.getElementById(COMPOSER_ROOT_ID)
  if (existing) existing.remove()
  currentOverlay = null
}

function getBugIconSvg(size = 20) {
  return `
    <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m8 2 1.88 1.88"></path>
      <path d="M14.12 3.88 16 2"></path>
      <path d="M9 7.13v-1a3 3 0 1 1 6 0v1"></path>
      <path d="M12 20v-8"></path>
      <path d="M6 13h.01"></path>
      <path d="M18 13h.01"></path>
      <path d="M18 16h.01"></path>
      <path d="M6 16h.01"></path>
      <path d="m18 8 1.88-1.88"></path>
      <path d="M6.12 6.12 4.24 4.24"></path>
      <rect x="8" y="8" width="8" height="12" rx="4"></rect>
    </svg>
  `
}

function clampFloatingShortcutPosition(left, top) {
  const maxLeft = Math.max(8, window.innerWidth - FLOATING_SHORTCUT_SIZE - 8)
  const maxTop = Math.max(8, window.innerHeight - FLOATING_SHORTCUT_SIZE - 8)

  return {
    left: Math.min(Math.max(left, 8), maxLeft),
    top: Math.min(Math.max(top, 8), maxTop),
  }
}

async function persistFloatingShortcutPosition(position) {
  floatingShortcutPosition = position
  try {
    await chrome.storage.local.set({ [FLOATING_SHORTCUT_POSITION_KEY]: position })
  } catch {
    // Ignore persistence failures.
  }
}

function removeFloatingShortcut() {
  const existing = document.getElementById(FLOATING_SHORTCUT_ID)
  if (existing) existing.remove()
}

function renderFloatingShortcut() {
  removeFloatingShortcut()
  if (!floatingShortcutEnabled) return

  debugLog('renderFloatingShortcut:start', {
    floatingShortcutEnabled,
    floatingShortcutPosition,
  })

  const defaultLeft = window.innerWidth - FLOATING_SHORTCUT_SIZE - FLOATING_SHORTCUT_MARGIN
  const defaultTop = window.innerHeight - FLOATING_SHORTCUT_SIZE - FLOATING_SHORTCUT_MARGIN
  const initialPosition = clampFloatingShortcutPosition(
    floatingShortcutPosition?.left ?? defaultLeft,
    floatingShortcutPosition?.top ?? defaultTop,
  )

  const button = document.createElement('button')
  button.id = FLOATING_SHORTCUT_ID
  button.type = 'button'
  button.title = 'Open Mushi bug capture'
  button.innerHTML = getBugIconSvg(20)

  button.style.position = 'fixed'
  button.style.left = `${initialPosition.left}px`
  button.style.top = `${initialPosition.top}px`
  button.style.width = `${FLOATING_SHORTCUT_SIZE}px`
  button.style.height = `${FLOATING_SHORTCUT_SIZE}px`
  button.style.borderRadius = '999px'
  button.style.border = `1px solid ${THEME.border}`
  button.style.background = THEME.bg
  button.style.color = THEME.primary
  button.style.display = 'inline-flex'
  button.style.alignItems = 'center'
  button.style.justifyContent = 'center'
  button.style.cursor = 'grab'
  button.style.zIndex = '2147483644'
  button.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.5)'
  button.style.touchAction = 'none'
  button.style.userSelect = 'none'

  let dragState = null

  const finishDrag = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return

    if (dragState.moved) {
      debugLog('floatingShortcut:drag:end', {
        from: { left: dragState.startLeft, top: dragState.startTop },
        to: { left: Number.parseFloat(button.style.left), top: Number.parseFloat(button.style.top) },
      })
      floatingShortcutSuppressClickUntil = Date.now() + 250
      const finalLeft = Number.parseFloat(button.style.left) || dragState.startLeft
      const finalTop = Number.parseFloat(button.style.top) || dragState.startTop
      const finalPosition = clampFloatingShortcutPosition(finalLeft, finalTop)
      button.style.left = `${finalPosition.left}px`
      button.style.top = `${finalPosition.top}px`
      void persistFloatingShortcutPosition(finalPosition)
    }

    if (button.hasPointerCapture(event.pointerId)) {
      button.releasePointerCapture(event.pointerId)
    }
    dragState = null
    button.style.cursor = 'grab'
  }

  button.onpointerdown = (event) => {
    if (event.button !== 0) return

    debugLog('floatingShortcut:drag:start', {
      x: event.clientX,
      y: event.clientY,
    })

    const startLeft = Number.parseFloat(button.style.left) || initialPosition.left
    const startTop = Number.parseFloat(button.style.top) || initialPosition.top
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft,
      startTop,
      moved: false,
    }

    button.setPointerCapture(event.pointerId)
    button.style.cursor = 'grabbing'
    event.preventDefault()
  }

  button.onpointermove = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return

    const deltaX = event.clientX - dragState.startX
    const deltaY = event.clientY - dragState.startY
    const nextPosition = clampFloatingShortcutPosition(
      dragState.startLeft + deltaX,
      dragState.startTop + deltaY,
    )

    button.style.left = `${nextPosition.left}px`
    button.style.top = `${nextPosition.top}px`

    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
      dragState.moved = true
    }
  }

  button.onpointerup = finishDrag
  button.onpointercancel = finishDrag

  button.style.transition = 'transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'

  button.onmouseenter = () => {
    button.style.background = '#10161f'
    button.style.borderColor = THEME.borderAccent
    button.style.transform = 'scale(1.15)'
    button.style.boxShadow = `0 12px 28px rgba(0, 0, 0, 0.5), 0 0 12px ${THEME.primarySoft}`
  }
  button.onmouseleave = () => {
    button.style.background = THEME.bg
    button.style.borderColor = THEME.border
    button.style.transform = 'scale(1)'
    button.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.5)'
  }
  button.onclick = () => {
    if (Date.now() < floatingShortcutSuppressClickUntil) {
      debugLog('floatingShortcut:click:suppressed-after-drag')
      return
    }

    const composerOpen = document.getElementById(COMPOSER_ROOT_ID)
    if (composerOpen) {
      debugLog('floatingShortcut:click:toggleOff')
      removeComposer(true)
      return
    }

    debugLog('floatingShortcut:click:openComposer')

    const rect = button.getBoundingClientRect()
    void openComposerIfAllowed({
      source: 'floating',
      anchor: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      },
    })
  }

  document.body.appendChild(button)
}

async function loadFloatingShortcutSetting() {
  debugLog('loadFloatingShortcutSetting:start')
  const response = await sendRuntimeMessage({ type: 'EXTENSION_GET_SETTINGS' })
  if (response?.ok) {
    floatingShortcutEnabled = Boolean(response.settings?.floatingShortcutEnabled)
    debugLog('loadFloatingShortcutSetting:settings', response.settings)
  }

  // Only show floating button on allowed product pages
  if (floatingShortcutEnabled) {
    const captureCheck = await sendRuntimeMessage({
      type: 'EXTENSION_CAN_CAPTURE',
      page: { hostname: window.location.hostname, url: window.location.href },
    })
    if (!captureCheck?.ok || !captureCheck.allowed) {
      debugLog('loadFloatingShortcutSetting:domain-not-allowed', {
        hostname: window.location.hostname,
        captureCheck,
      })
      floatingShortcutEnabled = false
    }
  }

  try {
    const stored = await chrome.storage.local.get({ [FLOATING_SHORTCUT_POSITION_KEY]: null })
    const rawPosition = stored[FLOATING_SHORTCUT_POSITION_KEY]
    if (
      rawPosition &&
      typeof rawPosition.left === 'number' &&
      Number.isFinite(rawPosition.left) &&
      typeof rawPosition.top === 'number' &&
      Number.isFinite(rawPosition.top)
    ) {
      floatingShortcutPosition = {
        left: rawPosition.left,
        top: rawPosition.top,
      }
    }
  } catch {
    // Ignore storage access errors.
  }

  renderFloatingShortcut()
  debugLog('loadFloatingShortcutSetting:done')
}

function ensurePressStart2PFont() {
  const FONT_LINK_ID = 'mushi-press-start-2p-font'
  if (document.getElementById(FONT_LINK_ID)) return
  const link = document.createElement('link')
  link.id = FONT_LINK_ID
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
  document.head.appendChild(link)
}

function buildComposer(openMeta = {}) {
  removeComposer()
  ensurePressStart2PFont()

  const PANEL_WIDTH = 420
  const PANEL_GAP = 0

  const root = document.createElement('div')
  root.id = COMPOSER_ROOT_ID
  root.style.position = 'fixed'
  root.style.zIndex = '2147483645'

  let btnRect = null
  const floatingBtn = document.getElementById(FLOATING_SHORTCUT_ID)
  if (floatingBtn) {
    btnRect = floatingBtn.getBoundingClientRect()
  } else if (openMeta?.anchor?.x != null && openMeta?.anchor?.y != null) {
    btnRect = {
      left: openMeta.anchor.x - FLOATING_SHORTCUT_SIZE / 2,
      top: openMeta.anchor.y - FLOATING_SHORTCUT_SIZE / 2,
      right: openMeta.anchor.x + FLOATING_SHORTCUT_SIZE / 2,
      bottom: openMeta.anchor.y + FLOATING_SHORTCUT_SIZE / 2,
      width: FLOATING_SHORTCUT_SIZE,
      height: FLOATING_SHORTCUT_SIZE,
    }
  } else {
    const fallbackLeft = window.innerWidth - FLOATING_SHORTCUT_SIZE - FLOATING_SHORTCUT_MARGIN
    const fallbackTop = window.innerHeight - FLOATING_SHORTCUT_SIZE - FLOATING_SHORTCUT_MARGIN
    btnRect = {
      left: fallbackLeft,
      top: fallbackTop,
      right: fallbackLeft + FLOATING_SHORTCUT_SIZE,
      bottom: fallbackTop + FLOATING_SHORTCUT_SIZE,
      width: FLOATING_SHORTCUT_SIZE,
      height: FLOATING_SHORTCUT_SIZE,
    }
  }

  const panelWidth = Math.min(PANEL_WIDTH, window.innerWidth - 16)
  const maxHeight = window.innerHeight - 16

  // Horizontal: place to the left of the button, or right if not enough space
  let left
  if (btnRect.left >= panelWidth + PANEL_GAP) {
    left = btnRect.left - PANEL_GAP - panelWidth
  } else if (window.innerWidth - btnRect.right >= panelWidth + PANEL_GAP) {
    left = btnRect.right + PANEL_GAP
  } else {
    left = Math.max(8, (window.innerWidth - panelWidth) / 2)
  }

  root.style.left = `${left}px`
  root.style.width = `${panelWidth}px`
  root.style.maxHeight = `${maxHeight}px`
  // Vertical position set after panel renders to use actual height
  root.dataset.btnBottom = String(btnRect.bottom)
  root.dataset.btnTop = String(btnRect.top)

  const panel = document.createElement('div')
  panel.style.width = '100%'
  panel.style.maxHeight = 'inherit'
  panel.style.overflow = 'auto'
  panel.style.borderRadius = '14px'
  panel.style.background = THEME.surface
  panel.style.border = `1px solid ${THEME.border}`
  panel.style.padding = '22px'
  panel.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.48)'
  panel.style.fontFamily = 'Inter, system-ui, sans-serif'
  panel.style.color = THEME.text

  const titleRow = document.createElement('div')
  titleRow.style.display = 'flex'
  titleRow.style.alignItems = 'center'
  titleRow.style.gap = '10px'
  titleRow.style.margin = '0 0 12px 0'

  const titleIcon = document.createElement('span')
  titleIcon.style.display = 'inline-flex'
  titleIcon.style.alignItems = 'center'
  titleIcon.style.justifyContent = 'center'
  titleIcon.style.color = THEME.primary
  titleIcon.innerHTML = getBugIconSvg(20)

  const title = document.createElement('h3')
  title.textContent = 'Log bug to Mushi'
  title.style.margin = '0'
  title.style.fontSize = TYPE_SCALE.title
  title.style.fontFamily = "'Press Start 2P', cursive"
  title.style.color = THEME.text
  title.style.flex = '1'

  const resetButton = document.createElement('button')
  resetButton.type = 'button'
  resetButton.title = 'Reset form'
  resetButton.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`
  resetButton.style.background = 'transparent'
  resetButton.style.border = 'none'
  resetButton.style.color = THEME.textMuted
  resetButton.style.cursor = 'pointer'
  resetButton.style.padding = '4px'
  resetButton.style.display = 'inline-flex'
  resetButton.style.alignItems = 'center'
  resetButton.style.borderRadius = '6px'
  resetButton.style.transition = 'color 0.15s ease'
  resetButton.onmouseenter = () => { resetButton.style.color = THEME.text }
  resetButton.onmouseleave = () => { resetButton.style.color = THEME.textMuted }

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.title = 'Close'
  closeButton.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
  closeButton.style.background = 'transparent'
  closeButton.style.border = 'none'
  closeButton.style.color = THEME.textMuted
  closeButton.style.cursor = 'pointer'
  closeButton.style.padding = '4px'
  closeButton.style.display = 'inline-flex'
  closeButton.style.alignItems = 'center'
  closeButton.style.borderRadius = '6px'
  closeButton.style.transition = 'color 0.15s ease'
  closeButton.onmouseenter = () => { closeButton.style.color = THEME.text }
  closeButton.onmouseleave = () => { closeButton.style.color = THEME.textMuted }
  closeButton.onclick = () => removeComposer(true)

  titleRow.appendChild(titleIcon)
  titleRow.appendChild(title)
  titleRow.appendChild(resetButton)
  titleRow.appendChild(closeButton)

  const subtitle = document.createElement('p')
  subtitle.textContent = `Shortcut: ${KEY_SHORTCUT.toUpperCase()}`
  subtitle.style.margin = '0 0 12px 0'
  subtitle.style.fontSize = TYPE_SCALE.meta
  subtitle.style.color = THEME.textMuted

  const titleInput = document.createElement('input')
  titleInput.placeholder = 'Bug title'
  titleInput.style.width = '100%'
  titleInput.style.marginBottom = '10px'
  titleInput.style.padding = '9px 10px'
  titleInput.style.border = `1px solid ${THEME.border}`
  titleInput.style.background = THEME.surfaceAlt
  titleInput.style.color = THEME.text
  titleInput.style.borderRadius = '8px'
  titleInput.style.fontSize = TYPE_SCALE.body
  titleInput.style.outline = 'none'
  titleInput.onfocus = () => { titleInput.style.borderColor = THEME.primary }
  titleInput.onblur = () => { titleInput.style.borderColor = THEME.border }

  const descriptionInput = document.createElement('textarea')
  descriptionInput.placeholder = 'Describe what happened'
  descriptionInput.rows = 4
  descriptionInput.style.width = '100%'
  descriptionInput.style.marginBottom = '10px'
  descriptionInput.style.padding = '9px 10px'
  descriptionInput.style.border = `1px solid ${THEME.border}`
  descriptionInput.style.background = THEME.surfaceAlt
  descriptionInput.style.color = THEME.text
  descriptionInput.style.borderRadius = '8px'
  descriptionInput.style.fontSize = TYPE_SCALE.body
  descriptionInput.style.resize = 'vertical'
  descriptionInput.style.outline = 'none'
  descriptionInput.onfocus = () => { descriptionInput.style.borderColor = THEME.primary }
  descriptionInput.onblur = () => { descriptionInput.style.borderColor = THEME.border }

  const severityRow = document.createElement('div')
  severityRow.style.display = 'flex'
  severityRow.style.alignItems = 'center'
  severityRow.style.gap = '8px'
  severityRow.style.marginBottom = '12px'

  const severityLabel = document.createElement('span')
  severityLabel.textContent = 'Severity'
  severityLabel.style.fontSize = TYPE_SCALE.meta
  severityLabel.style.fontWeight = '600'
  severityLabel.style.color = THEME.text

  const severityOptions = ['critical', 'high', 'low']
  const severityColors = { critical: THEME.danger, high: '#ffb347', low: THEME.primary }
  const severityBadges = {}
  const severitySelect = { value: 'high' }

  function updateSeverityBadges() {
    severityOptions.forEach((sev) => {
      const badge = severityBadges[sev]
      if (!badge) return
      const isActive = severitySelect.value === sev
      const color = severityColors[sev]
      badge.style.background = isActive ? color : 'transparent'
      badge.style.color = isActive ? THEME.bg : THEME.textMuted
      badge.style.borderColor = isActive ? color : THEME.border
      badge.style.fontWeight = isActive ? '700' : '500'
    })
  }

  severityOptions.forEach((sev) => {
    const badge = document.createElement('button')
    badge.type = 'button'
    badge.textContent = sev.charAt(0).toUpperCase() + sev.slice(1)
    badge.style.padding = '5px 12px'
    badge.style.border = `1px solid ${THEME.border}`
    badge.style.borderRadius = '20px'
    badge.style.fontSize = TYPE_SCALE.meta
    badge.style.cursor = 'pointer'
    badge.style.transition = 'all 0.15s ease'
    badge.style.background = 'transparent'
    badge.style.color = THEME.textMuted
    badge.onclick = () => {
      severitySelect.value = sev
      updateSeverityBadges()
    }
    severityBadges[sev] = badge
  })

  severityRow.appendChild(severityLabel)
  severityOptions.forEach((sev) => severityRow.appendChild(severityBadges[sev]))
  updateSeverityBadges()

  const attachmentsHeading = document.createElement('div')
  attachmentsHeading.textContent = 'Attachments'
  attachmentsHeading.style.fontSize = TYPE_SCALE.meta
  attachmentsHeading.style.fontWeight = '600'
  attachmentsHeading.style.marginBottom = '6px'
  attachmentsHeading.style.color = THEME.text

  const attachmentsList = document.createElement('ul')
  attachmentsList.style.margin = '0 0 12px 0'
  attachmentsList.style.paddingLeft = '18px'
  attachmentsList.style.fontSize = TYPE_SCALE.meta
  attachmentsList.style.color = THEME.textMuted

  const pasteZone = document.createElement('div')
  pasteZone.textContent = 'You can paste your images here'
  pasteZone.style.border = `2px dashed ${THEME.border}`
  pasteZone.style.borderRadius = '8px'
  pasteZone.style.padding = '10px'
  pasteZone.style.marginBottom = '12px'
  pasteZone.style.fontSize = TYPE_SCALE.meta
  pasteZone.style.color = THEME.textMuted
  pasteZone.style.textAlign = 'center'
  pasteZone.style.transition = 'border-color 0.15s ease, color 0.15s ease'

  const attachmentButtonRow = document.createElement('div')
  attachmentButtonRow.style.display = 'flex'
  attachmentButtonRow.style.flexWrap = 'nowrap'
  attachmentButtonRow.style.gap = '8px'
  attachmentButtonRow.style.marginBottom = '10px'

  const actionRow = document.createElement('div')
  actionRow.style.display = 'flex'
  actionRow.style.gap = '8px'
  actionRow.style.marginBottom = '12px'

  const screenshotButton = document.createElement('button')
  screenshotButton.textContent = 'Capture screenshot'

  const uploadButton = document.createElement('button')
  uploadButton.textContent = 'Upload images/videos'

  const cancelButton = document.createElement('button')
  cancelButton.textContent = 'Cancel'

  const submitButton = document.createElement('button')
  submitButton.textContent = 'Create bug'

  ;[screenshotButton, uploadButton, cancelButton, submitButton].forEach((button) => {
    button.style.border = `1px solid ${THEME.border}`
    button.style.borderRadius = '8px'
    button.style.padding = '8px 12px'
    button.style.fontSize = TYPE_SCALE.button
    button.style.fontWeight = '600'
    button.style.cursor = 'pointer'
    button.style.background = THEME.surfaceAlt
    button.style.color = THEME.text
  })

  cancelButton.style.flex = '1'
  submitButton.style.flex = '2'
  submitButton.style.background = THEME.primarySoft
  submitButton.style.borderColor = THEME.borderAccent
  submitButton.style.color = THEME.primary

  const statusText = document.createElement('div')
  statusText.style.fontSize = TYPE_SCALE.meta
  statusText.style.color = THEME.textMuted

  const successAlert = document.createElement('div')
  successAlert.style.display = 'none'
  successAlert.style.marginTop = '8px'
  successAlert.style.border = `1px solid ${THEME.borderAccent}`
  successAlert.style.background = THEME.primarySoft
  successAlert.style.color = THEME.text
  successAlert.style.borderRadius = '8px'
  successAlert.style.padding = '10px'
  successAlert.style.fontSize = TYPE_SCALE.meta

  const successMessage = document.createElement('div')
  successMessage.style.fontWeight = '600'

  const successLink = document.createElement('a')
  successLink.textContent = 'View bugs page'
  successLink.target = '_blank'
  successLink.rel = 'noopener noreferrer'
  successLink.style.display = 'inline-block'
  successLink.style.marginTop = '6px'
  successLink.style.color = THEME.primary
  successLink.style.textDecoration = 'underline'

  successAlert.appendChild(successMessage)
  successAlert.appendChild(successLink)

  attachmentButtonRow.appendChild(screenshotButton)
  attachmentButtonRow.appendChild(uploadButton)

  actionRow.appendChild(cancelButton)
  actionRow.appendChild(submitButton)

  panel.appendChild(titleRow)
  panel.appendChild(subtitle)
  panel.appendChild(titleInput)
  panel.appendChild(descriptionInput)
  panel.appendChild(severityRow)
  panel.appendChild(attachmentsHeading)
  panel.appendChild(attachmentsList)
  panel.appendChild(pasteZone)
  panel.appendChild(attachmentButtonRow)
  panel.appendChild(actionRow)
  panel.appendChild(statusText)
  panel.appendChild(successAlert)

  root.appendChild(panel)
  document.body.appendChild(root)

  // Position vertically: align panel bottom with button bottom, clamped to viewport
  const actualHeight = panel.offsetHeight
  const bBottom = parseFloat(root.dataset.btnBottom)
  const bTop = parseFloat(root.dataset.btnTop)
  let top = bBottom - actualHeight
  if (top < 8) top = 8
  if (top + actualHeight > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - 8 - actualHeight)
  }
  root.style.top = `${top}px`

  // --- Drag support on titleRow ---
  titleRow.style.cursor = 'grab'
  let composerDragState = null

  titleRow.onpointerdown = (event) => {
    if (event.button !== 0) return
    if (event.target.closest('button')) return
    event.preventDefault()
    titleRow.setPointerCapture(event.pointerId)
    titleRow.style.cursor = 'grabbing'
    const rootRect = root.getBoundingClientRect()
    composerDragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rootRect.left,
      originTop: rootRect.top,
    }
  }

  titleRow.onpointermove = (event) => {
    if (!composerDragState || event.pointerId !== composerDragState.pointerId) return
    const dx = event.clientX - composerDragState.startX
    const dy = event.clientY - composerDragState.startY
    const newLeft = Math.max(0, Math.min(window.innerWidth - 60, composerDragState.originLeft + dx))
    const newTop = Math.max(0, Math.min(window.innerHeight - 40, composerDragState.originTop + dy))
    root.style.left = `${newLeft}px`
    root.style.top = `${newTop}px`
  }

  const finishComposerDrag = (event) => {
    if (!composerDragState || event.pointerId !== composerDragState.pointerId) return
    titleRow.releasePointerCapture(event.pointerId)
    titleRow.style.cursor = 'grab'
    composerDragState = null
  }
  titleRow.onpointerup = finishComposerDrag
  titleRow.onpointercancel = finishComposerDrag

  const playOpenAnimation = () => {
    const hasAnimationApi = typeof panel.animate === 'function'
    if (!hasAnimationApi) {
      panel.style.opacity = '1'
      return
    }

    const panelRect = panel.getBoundingClientRect()
    const anchorCX = btnRect ? (btnRect.left + btnRect.width / 2) : null
    const anchorCY = btnRect ? (btnRect.top + btnRect.height / 2) : null

    let fromTransform = 'translate(0px, 10px) scale(0.98)'
    let fromOpacity = 0.25

    if (anchorCX != null && anchorCY != null) {
      const centerX = panelRect.left + panelRect.width / 2
      const centerY = panelRect.top + panelRect.height / 2
      const deltaX = anchorCX - centerX
      const deltaY = anchorCY - centerY

      fromTransform = `translate(${deltaX}px, ${deltaY}px) scale(0.2)`
      fromOpacity = 0.2
    }

    panel.animate(
      [
        { transform: fromTransform, opacity: fromOpacity },
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
      ],
      {
        duration: 280,
        easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
        fill: 'forwards',
      },
    )
  }

  window.requestAnimationFrame(playOpenAnimation)

  const attachments = []

  function renderAttachments() {
    attachmentsList.innerHTML = ''
    attachmentsList.style.listStyle = 'none'
    attachmentsList.style.paddingLeft = '0'
    if (!attachments.length) {
      const empty = document.createElement('li')
      empty.textContent = 'No attachments yet'
      empty.style.color = THEME.textMuted
      attachmentsList.appendChild(empty)
      return
    }

    attachments.forEach((attachment, index) => {
      const item = document.createElement('li')
      item.style.display = 'flex'
      item.style.alignItems = 'center'
      item.style.gap = '8px'
      item.style.marginBottom = '6px'

      const isImage = attachment.type?.startsWith('image/') && attachment.dataUrl
      if (isImage) {
        const thumb = document.createElement('img')
        thumb.src = attachment.dataUrl
        thumb.style.width = '40px'
        thumb.style.height = '40px'
        thumb.style.objectFit = 'cover'
        thumb.style.borderRadius = '6px'
        thumb.style.border = `1px solid ${THEME.border}`
        thumb.style.flexShrink = '0'
        item.appendChild(thumb)
      }

      const nameSpan = document.createElement('span')
      nameSpan.textContent = attachment.name || 'file'
      nameSpan.style.flex = '1'
      nameSpan.style.overflow = 'hidden'
      nameSpan.style.textOverflow = 'ellipsis'
      nameSpan.style.whiteSpace = 'nowrap'
      nameSpan.style.fontSize = TYPE_SCALE.meta
      item.appendChild(nameSpan)

      const removeButton = document.createElement('button')
      removeButton.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
      removeButton.style.border = 'none'
      removeButton.style.background = 'transparent'
      removeButton.style.color = THEME.danger
      removeButton.style.cursor = 'pointer'
      removeButton.style.padding = '2px'
      removeButton.style.display = 'inline-flex'
      removeButton.style.flexShrink = '0'
      removeButton.onclick = () => {
        attachments.splice(index, 1)
        renderAttachments()
      }

      item.appendChild(removeButton)
      attachmentsList.appendChild(item)
    })
  }

  panel.addEventListener('paste', async (event) => {
    const items = Array.from(event.clipboardData?.items || [])
    const imageFiles = items
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file) => file !== null)

    if (!imageFiles.length) return
    event.preventDefault()

    pasteZone.style.borderColor = THEME.primary
    pasteZone.style.color = THEME.primary
    statusText.textContent = 'Reading pasted image…'

    try {
      const pasted = await collectFilesAsAttachments(imageFiles)
      attachments.push(...pasted)
      renderAttachments()
      statusText.textContent = `${pasted.length} image${pasted.length > 1 ? 's' : ''} pasted.`
    } catch {
      statusText.textContent = 'Failed to read pasted image.'
    }

    setTimeout(() => {
      pasteZone.style.borderColor = THEME.border
      pasteZone.style.color = THEME.textMuted
    }, 1500)
  })

  async function addScreenshot() {
    statusText.textContent = 'Capturing screenshot…'
    const response = await sendRuntimeMessage({ type: 'EXTENSION_CAPTURE_SCREENSHOT' })
    if (!response?.ok) {
      statusText.textContent = response?.error || 'Screenshot failed.'
      return
    }

    attachments.push({
      name: response.name || `screenshot-${Date.now()}.png`,
      type: response.type || 'image/png',
      dataUrl: response.dataUrl,
    })
    renderAttachments()
    statusText.textContent = 'Screenshot attached.'
  }

  async function uploadFiles() {
    const input = createFileInput('image/*,video/*')
    input.onchange = async () => {
      const files = Array.from(input.files || [])
      if (!files.length) return

      statusText.textContent = 'Reading files…'
      try {
        const fileAttachments = await collectFilesAsAttachments(files)
        attachments.push(...fileAttachments)
        renderAttachments()
        statusText.textContent = `${fileAttachments.length} file(s) added.`
      } catch (error) {
        statusText.textContent =
          error instanceof Error ? error.message : 'Failed to read selected files.'
      }
    }
    input.click()
  }

  async function submitBug() {
    const bugTitle = titleInput.value.trim()
    if (!bugTitle) {
      statusText.textContent = 'Title is required.'
      return
    }

    successAlert.style.display = 'none'
    successMessage.textContent = ''
    successLink.removeAttribute('href')

    submitButton.disabled = true
    submitButton.textContent = 'Creating…'
    statusText.textContent = 'Submitting bug to Mushi…'

    const payload = {
      title: bugTitle,
      description: descriptionInput.value.trim(),
      severity: severitySelect.value,
      pageUrl: window.location.href,
      pageTitle: document.title,
      device: navigator.platform || 'Chrome Extension',
      attachments,
    }

    const response = await sendRuntimeMessage({
      type: 'EXTENSION_CREATE_BUG',
      payload,
    })

    submitButton.disabled = false
    submitButton.textContent = 'Create bug'

    if (!response?.ok) {
      statusText.textContent = response?.error || 'Failed to create bug.'
      return
    }

    const bugId = response?.data?.bugId || 'unknown'
    statusText.textContent = `Created ${bugId} successfully.`
    successMessage.textContent = `Bug ${bugId} created successfully.`

    const bugsUrl = response?.data?.bugUrl
    if (typeof bugsUrl === 'string' && bugsUrl.trim()) {
      successLink.href = bugsUrl
      successLink.style.display = 'inline-block'
    } else {
      successLink.style.display = 'none'
    }

    successAlert.style.display = 'block'
    composerDraft = null
  }

  screenshotButton.onclick = () => {
    void addScreenshot()
  }

  uploadButton.onclick = () => {
    void uploadFiles()
  }

  cancelButton.onclick = () => removeComposer(true)
  submitButton.onclick = () => {
    void submitBug()
  }

  resetButton.onclick = () => {
    titleInput.value = ''
    descriptionInput.value = ''
    severitySelect.value = 'high'
    updateSeverityBadges()
    attachments.length = 0
    renderAttachments()
    statusText.textContent = ''
    successAlert.style.display = 'none'
    composerDraft = null
    titleInput.focus()
  }

  root.onclick = (event) => {
    if (event.target === root) removeComposer(true)
  }

  // Restore draft if available
  if (composerDraft) {
    titleInput.value = composerDraft.title || ''
    descriptionInput.value = composerDraft.description || ''
    severitySelect.value = composerDraft.severity || 'high'
    updateSeverityBadges()
  }

  renderAttachments()
  titleInput.focus()

  currentOverlay = { root }
}

async function openComposerIfAllowed(openMeta = {}) {
  debugLog('openComposerIfAllowed:start', {
    url: window.location.href,
    title: document.title,
    hostname: window.location.hostname,
    source: openMeta?.source || 'unknown',
  })

  const pageInfo = {
    url: window.location.href,
    title: document.title,
    hostname: window.location.hostname,
  }

  const response = await sendRuntimeMessageWithTimeout({
    type: 'EXTENSION_CAN_CAPTURE',
    page: pageInfo,
  }, 12000)

  debugLog('openComposerIfAllowed:canCaptureResponse', response)

  if (!response?.ok || !response.allowed) {
    const allowedDomains = formatAllowedDomains(response?.allowedDomains)
    const suffix = allowedDomains ? ` Allowed: ${allowedDomains}` : ''
    showToast((response?.reason || 'Capture is disabled for this page.') + suffix, 'error')
    return
  }

  debugLog('openComposerIfAllowed:buildComposer')
  buildComposer(openMeta)
}

function handleShortcut(event) {
  if (event.defaultPrevented) return
  if (!(event.altKey && event.shiftKey)) return
  if (event.key.toLowerCase() !== 'b') return

  event.preventDefault()
  void openComposerIfAllowed({ source: 'shortcut' })
}

window.addEventListener('keydown', handleShortcut)
window.addEventListener('resize', () => {
  const existing = document.getElementById(FLOATING_SHORTCUT_ID)
  if (!existing || !floatingShortcutEnabled) return

  const currentLeft = Number.parseFloat(existing.style.left)
  const currentTop = Number.parseFloat(existing.style.top)
  const nextPosition = clampFloatingShortcutPosition(
    Number.isFinite(currentLeft) ? currentLeft : window.innerWidth - FLOATING_SHORTCUT_SIZE - FLOATING_SHORTCUT_MARGIN,
    Number.isFinite(currentTop) ? currentTop : window.innerHeight - FLOATING_SHORTCUT_SIZE - FLOATING_SHORTCUT_MARGIN,
  )

  existing.style.left = `${nextPosition.left}px`
  existing.style.top = `${nextPosition.top}px`
  floatingShortcutPosition = nextPosition
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    renderFloatingShortcut()
  }
})

void loadFloatingShortcutSetting()

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const run = async () => {
    debugLog('onMessage', { type: message?.type })
    if (message?.type === 'EXTENSION_PING') {
      sendResponse({ ok: true })
      return
    }

    if (message?.type === 'MUSHI_BRIDGE_REQUEST') {
      const response = await relayToPageBridge(message.action, message.payload)
      sendResponse(response)
      return
    }

    if (message?.type === 'EXTENSION_OPEN_COMPOSER') {
      debugLog('EXTENSION_OPEN_COMPOSER:received', { skipValidation: Boolean(message?.skipValidation) })
      sendResponse({ ok: true })
      if (message?.skipValidation) {
        debugLog('EXTENSION_OPEN_COMPOSER:buildComposer-direct')
        buildComposer(message?.openMeta || { source: 'popup' })
      } else {
        debugLog('EXTENSION_OPEN_COMPOSER:openComposerIfAllowed')
        void openComposerIfAllowed(message?.openMeta || { source: 'runtime' })
      }
      return
    }

    if (message?.type === 'EXTENSION_SET_FLOATING_SHORTCUT') {
      floatingShortcutEnabled = Boolean(message.enabled)
      debugLog('EXTENSION_SET_FLOATING_SHORTCUT:received', { floatingShortcutEnabled })
      renderFloatingShortcut()
      sendResponse({ ok: true })
      return
    }
  }

  run().catch((error) => {
    debugLog('onMessage:error', error)
    const messageText = error instanceof Error ? error.message : 'Unexpected content-script error.'
    sendResponse({ ok: false, error: messageText })
  })

  return true
})

})()
