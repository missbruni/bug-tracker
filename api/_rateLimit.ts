interface SlidingWindowOptions {
  namespace: string
  key: string
  limit: number
  windowMs: number
  nowMs?: number
}

interface SlidingWindowResult {
  allowed: boolean
  retryAfterSeconds: number
}

interface FailureCooldownOptions {
  namespace: string
  key: string
  maxFailures: number
  failureWindowMs: number
  cooldownMs: number
  nowMs?: number
}

interface FailureCooldownStatus {
  blocked: boolean
  retryAfterSeconds: number
}

interface FailureCooldownResult extends FailureCooldownStatus {
  triggered: boolean
}

interface FailureEntry {
  failures: number
  firstFailureAt: number
  blockedUntil: number
}

type GlobalRateLimitState = typeof globalThis & {
  __mushiSlidingWindowStore?: Map<string, number[]>
  __mushiFailureStore?: Map<string, FailureEntry>
}

function getSlidingWindowStore(): Map<string, number[]> {
  const globalState = globalThis as GlobalRateLimitState
  if (!globalState.__mushiSlidingWindowStore) {
    globalState.__mushiSlidingWindowStore = new Map<string, number[]>()
  }
  return globalState.__mushiSlidingWindowStore
}

function getFailureStore(): Map<string, FailureEntry> {
  const globalState = globalThis as GlobalRateLimitState
  if (!globalState.__mushiFailureStore) {
    globalState.__mushiFailureStore = new Map<string, FailureEntry>()
  }
  return globalState.__mushiFailureStore
}

function buildStoreKey(namespace: string, key: string): string {
  return `${namespace}:${key}`
}

export function consumeSlidingWindowLimit({
  namespace,
  key,
  limit,
  windowMs,
  nowMs = Date.now(),
}: SlidingWindowOptions): SlidingWindowResult {
  const store = getSlidingWindowStore()
  const storeKey = buildStoreKey(namespace, key)
  const timestamps = (store.get(storeKey) ?? []).filter((timestamp) => nowMs - timestamp < windowMs)

  if (timestamps.length >= limit) {
    const oldestHit = timestamps[0] ?? nowMs
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestHit + windowMs - nowMs) / 1000))
    store.set(storeKey, timestamps)
    return { allowed: false, retryAfterSeconds }
  }

  timestamps.push(nowMs)
  store.set(storeKey, timestamps)
  return { allowed: true, retryAfterSeconds: 0 }
}

export function getFailureCooldownStatus(
  namespace: string,
  key: string,
  nowMs = Date.now(),
): FailureCooldownStatus {
  const store = getFailureStore()
  const storeKey = buildStoreKey(namespace, key)
  const entry = store.get(storeKey)

  if (!entry) {
    return { blocked: false, retryAfterSeconds: 0 }
  }

  if (entry.blockedUntil > nowMs) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.blockedUntil - nowMs) / 1000))
    return { blocked: true, retryAfterSeconds }
  }

  return { blocked: false, retryAfterSeconds: 0 }
}

export function registerFailureAttempt({
  namespace,
  key,
  maxFailures,
  failureWindowMs,
  cooldownMs,
  nowMs = Date.now(),
}: FailureCooldownOptions): FailureCooldownResult {
  const store = getFailureStore()
  const storeKey = buildStoreKey(namespace, key)

  const existing = store.get(storeKey)
  if (!existing || nowMs - existing.firstFailureAt >= failureWindowMs) {
    const nextEntry: FailureEntry = {
      failures: 1,
      firstFailureAt: nowMs,
      blockedUntil: 0,
    }
    store.set(storeKey, nextEntry)

    return {
      blocked: false,
      retryAfterSeconds: 0,
      triggered: false,
    }
  }

  const failures = existing.failures + 1
  if (failures >= maxFailures) {
    const blockedUntil = nowMs + cooldownMs
    store.set(storeKey, {
      failures: 0,
      firstFailureAt: nowMs,
      blockedUntil,
    })

    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil(cooldownMs / 1000)),
      triggered: true,
    }
  }

  store.set(storeKey, {
    failures,
    firstFailureAt: existing.firstFailureAt,
    blockedUntil: 0,
  })

  return {
    blocked: false,
    retryAfterSeconds: 0,
    triggered: false,
  }
}

export function clearFailureState(namespace: string, key: string): void {
  getFailureStore().delete(buildStoreKey(namespace, key))
}
