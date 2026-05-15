export type AiProviderType = 'azure_openai' | 'openai' | 'custom'

export interface AiProviderConfig {
  provider: AiProviderType
  apiKey: string
  /** Azure OpenAI endpoint, e.g. https://my-resource.openai.azure.com */
  endpoint?: string
  /** Azure OpenAI deployment name */
  deploymentName?: string
  /** Model name for OpenAI / Custom providers */
  model?: string
  /** Base URL for Custom provider */
  baseUrl?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const AI_CONFIG_KEY = 'ai_provider_config'

// ─── Config persistence ─────────────────────────────────────

export function getAiConfig(): AiProviderConfig | null {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY)
    return raw ? (JSON.parse(raw) as AiProviderConfig) : null
  } catch {
    return null
  }
}

export function setAiConfig(config: AiProviderConfig): void {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config))
}

export function removeAiConfig(): void {
  localStorage.removeItem(AI_CONFIG_KEY)
}

export function hasAiConfig(): boolean {
  const cfg = getAiConfig()
  if (!cfg || !cfg.apiKey.trim()) return false
  if (cfg.provider === 'azure_openai' && !cfg.endpoint?.trim()) return false
  if (cfg.provider === 'custom' && !cfg.baseUrl?.trim()) return false
  return true
}

// ─── Chat completion ────────────────────────────────────────

const AZURE_API_VERSION = '2024-10-21'

function buildUrl(cfg: AiProviderConfig): string {
  switch (cfg.provider) {
    case 'azure_openai': {
      const base = cfg.endpoint!.replace(/\/+$/, '')
      // If the endpoint already includes the full path (e.g. .../chat/completions), use as-is
      if (base.includes('/chat/completions')) {
        return base.includes('api-version') ? base : `${base}?api-version=${AZURE_API_VERSION}`
      }
      // If endpoint includes /deployments/... (standard or APIM-style), append chat/completions
      if (base.includes('/deployments/')) {
        return `${base}/chat/completions?api-version=${AZURE_API_VERSION}`
      }
      // If a deployment name is provided, build the standard Azure path
      if (cfg.deploymentName?.trim()) {
        return `${base}/openai/deployments/${cfg.deploymentName.trim()}/chat/completions?api-version=${AZURE_API_VERSION}`
      }
      // Fallback: append chat/completions directly (for proxy endpoints)
      return `${base}/chat/completions?api-version=${AZURE_API_VERSION}`
    }
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions'
    case 'custom': {
      const base = cfg.baseUrl!.replace(/\/+$/, '')
      return `${base}/v1/chat/completions`
    }
  }
}

function buildHeaders(cfg: AiProviderConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.provider === 'azure_openai') {
    headers['api-key'] = cfg.apiKey
  } else {
    headers['Authorization'] = `Bearer ${cfg.apiKey}`
  }
  return headers
}

function buildBody(cfg: AiProviderConfig, messages: ChatMessage[]): Record<string, unknown> {
  const body: Record<string, unknown> = { messages, temperature: 0.3 }
  if (cfg.provider === 'openai') {
    body.model = cfg.model || 'gpt-4o'
  } else if (cfg.provider === 'custom' && cfg.model) {
    body.model = cfg.model
  }
  return body
}

export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const cfg = getAiConfig()
  if (!cfg) throw new Error('AI provider not configured. Open Settings to add your API key.')

  const targetUrl = buildUrl(cfg)
  const authHeaders = buildHeaders(cfg)

  // Route through local proxy to avoid CORS issues
  const res = await fetch('/api/ai-proxy', {
    method: 'POST',
    headers: {
      ...authHeaders,
      'x-target-url': targetUrl,
    },
    body: JSON.stringify(buildBody(cfg, messages)),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`AI request failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}
