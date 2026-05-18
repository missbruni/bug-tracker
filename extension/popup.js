const statusNode = document.getElementById('status')
const openMushiButton = document.getElementById('openMushi')
const openComposerButton = document.getElementById('openComposer')
const floatingShortcutToggle = document.getElementById('floatingShortcutToggle')
const DEBUG_LOGS = true

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
    scope: 'popup',
    ts: new Date().toISOString(),
    args,
  }

  try {
    console.log(`[MushiExt:popup] ${safeJSONStringify(payload)}`)
  } catch {
    console.log('[MushiExt:popup]', ...args)
  }
}

function setStatus(message, tone = 'default') {
  statusNode.textContent = message
  statusNode.classList.remove('info', 'success', 'error')
  const className = tone === 'error' ? 'error' : tone === 'success' ? 'success' : 'info'
  statusNode.classList.add(className)
}

function sendMessage(payload) {
  debugLog('sendMessage:start', payload?.type, payload)
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        debugLog('sendMessage:runtimeError', payload?.type, chrome.runtime.lastError.message)
        resolve({ ok: false, error: chrome.runtime.lastError.message })
        return
      }
      debugLog('sendMessage:response', payload?.type, response)
      resolve(response || { ok: false, error: 'No response from extension.' })
    })
  })
}

function sendMessageWithTimeout(payload, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve({ ok: false, error: 'Request timed out. Please try again.' })
    }, timeoutMs)

    void sendMessage(payload).then((response) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(response)
    }).catch(() => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ ok: false, error: 'Unexpected popup request failure. Please try again.' })
    })
  })
}

function setBusy(button, busy, busyLabel) {
  if (!button) return
  if (busy) {
    button.dataset.originalLabel = button.textContent || ''
    button.textContent = busyLabel
    button.disabled = true
    return
  }

  if (button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel
  }
  button.disabled = false
}

async function loadSettings() {
  debugLog('loadSettings:start')
  const response = await sendMessage({ type: 'EXTENSION_GET_SETTINGS' })
  if (!response?.ok) {
    debugLog('loadSettings:error', response)
    setStatus(response?.error || 'Failed to load extension settings.', 'error')
    return
  }

  if (floatingShortcutToggle) {
    floatingShortcutToggle.checked = Boolean(response.settings?.floatingShortcutEnabled)
    debugLog('loadSettings:applied', { floatingShortcutEnabled: floatingShortcutToggle.checked })
  }
}

if (floatingShortcutToggle) {
  floatingShortcutToggle.addEventListener('change', async () => {
    const enabled = Boolean(floatingShortcutToggle.checked)
    debugLog('floatingShortcutToggle:change', { enabled })
    const response = await sendMessage({
      type: 'EXTENSION_SET_FLOATING_SHORTCUT',
      enabled,
    })

    if (!response?.ok) {
      debugLog('floatingShortcutToggle:error', response)
      floatingShortcutToggle.checked = !enabled
      setStatus(response?.error || 'Failed to update shortcut button.', 'error')
      return
    }

    debugLog('floatingShortcutToggle:success', response)
    setStatus(enabled ? 'Shortcut button enabled.' : 'Shortcut button hidden.', 'success')
  })
}

openMushiButton.addEventListener('click', async () => {
  const response = await sendMessage({ type: 'EXTENSION_OPEN_MUSHI' })
  if (!response?.ok) {
    setStatus(response?.error || 'Failed to open Mushi.', 'error')
    return
  }

  setStatus('Opened Mushi tab.', 'success')
})

openComposerButton.addEventListener('click', async () => {
  debugLog('openComposerButton:click')
  setBusy(openComposerButton, true, 'Opening…')
  setStatus('Opening capture composer…', 'default')

  try {
    const response = await sendMessageWithTimeout(
      { type: 'EXTENSION_OPEN_COMPOSER_IN_ACTIVE_TAB' },
      20000,
    )

    debugLog('openComposerButton:response', response)

    if (!response?.ok) {
      const suffix = Array.isArray(response.allowedDomains) && response.allowedDomains.length
        ? ` Allowed: ${response.allowedDomains.slice(0, 3).join(', ')}`
        : ''
      setStatus((response?.error || 'Unable to open capture composer.') + suffix, 'error')
      return
    }

    setStatus('Capture composer opened.', 'success')
    window.close()
  } finally {
    debugLog('openComposerButton:finally')
    setBusy(openComposerButton, false)
  }
})

void loadSettings()
