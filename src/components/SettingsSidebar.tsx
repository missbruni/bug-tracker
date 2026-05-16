import { useState, useEffect } from 'react'
import { X, Settings, Eye, EyeOff, ExternalLink, Check, Sparkles } from 'lucide-react'
import { getDevinApiKey, setDevinApiKey, removeDevinApiKey, isValidDevinKey } from '../lib/devin'
import { getAiConfig, setAiConfig, removeAiConfig, type AiProviderType, type AiProviderConfig } from '../lib/aiProvider'

const AI_PROVIDERS: { value: AiProviderType; label: string }[] = [
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'custom', label: 'Custom' },
]

interface SettingsSidebarProps {
  open: boolean
  onClose: () => void
}

export default function SettingsSidebar({ open, onClose }: SettingsSidebarProps) {
  const [devinKey, setDevinKey] = useState(() => getDevinApiKey())
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [keyError, setKeyError] = useState('')

  // AI Assistant config state
  const [aiProvider, setAiProvider] = useState<AiProviderType>('azure_openai')
  const [aiKey, setAiKey] = useState('')
  const [aiEndpoint, setAiEndpoint] = useState('')
  const [aiDeployment, setAiDeployment] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [aiBaseUrl, setAiBaseUrl] = useState('')
  const [showAiKey, setShowAiKey] = useState(false)
  const [aiSaved, setAiSaved] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    if (open) {
      setDevinKey(getDevinApiKey())
      const cfg = getAiConfig()
      if (cfg) {
        setAiProvider(cfg.provider)
        setAiKey(cfg.apiKey)
        setAiEndpoint(cfg.endpoint || '')
        setAiDeployment(cfg.deploymentName || '')
        setAiModel(cfg.model || '')
        setAiBaseUrl(cfg.baseUrl || '')
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  const save = () => {
    if (!devinKey.trim()) return
    if (!isValidDevinKey(devinKey)) {
      setKeyError('Key must start with apk_user. Check your Devin dashboard for a valid API key.')
      return
    }
    setKeyError('')
    setDevinApiKey(devinKey)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 1200)
  }

  const clear = () => {
    setDevinKey('')
    removeDevinApiKey()
    setSaved(false)
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/20 dark:bg-black/40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 z-[60] h-full w-[420px] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 border-l border-slate-200 dark:border-gray-800 shadow-xl transform transition-transform duration-200 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Settings size={16} />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-6 overflow-y-auto h-[calc(100%-57px)]">
          {/* Devin Section */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-gray-400 mb-3">
              Devin Integration
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-500 mb-3 leading-relaxed">
              Add your Devin API key (PAT) to enable the <strong>Publish + Devin</strong> feature.
              This key is stored locally in your browser and never sent to our servers.
            </p>

            <label className="block text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1.5">
              Devin API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={devinKey}
                onChange={(e) => { setDevinKey(e.target.value); setSaved(false); setKeyError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') save() }}
                placeholder="apk_user_xxxxxxxx"
                className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-2 pr-9 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-600 font-mono"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 cursor-pointer"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {keyError && (
              <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{keyError}</p>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={save}
                disabled={!devinKey.trim()}
                className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold text-white transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-default ${
                  saved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {saved ? (
                  <>
                    <Check size={14} className="animate-scaleIn" />
                    Saved
                  </>
                ) : 'Save'}
              </button>
              {getDevinApiKey() && (
                <button
                  onClick={clear}
                  className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/40 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>

            <a
              href="https://docs.devin.ai/api-reference/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-xs text-blue-500 dark:text-blue-400 hover:underline"
            >
              <ExternalLink size={10} />
              How to get your Devin API key
            </a>
          </div>

          {/* AI Assistant Section */}
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-gray-400 mb-3">
              <Sparkles size={12} />
              AI Assistant
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-500 mb-3 leading-relaxed">
              Configure your AI provider to enable the <strong>AI Assistant</strong> — a chat where you can log bugs and set up testing sessions.
              Keys are stored locally in your browser.
            </p>

            <label className="block text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1.5">
              Provider
            </label>
            <select
              value={aiProvider}
              onChange={(e) => { setAiProvider(e.target.value as AiProviderType); setAiSaved(false); setAiError('') }}
              className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 mb-3"
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            {aiProvider === 'azure_openai' && (
              <>
                <label className="block text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1.5">Endpoint URL</label>
                <input
                  type="text"
                  value={aiEndpoint}
                  onChange={(e) => { setAiEndpoint(e.target.value); setAiSaved(false); setAiError('') }}
                  placeholder="https://my-resource.openai.azure.com"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-600 font-mono mb-1.5"
                />
                <p className="text-[10px] text-slate-400 dark:text-gray-600 mb-3 leading-relaxed">
                  Paste your full endpoint URL. Can include the deployment path, e.g. <code className="bg-slate-100 dark:bg-gray-800 px-0.5 rounded">.../openai/deployments/gpt-4o</code>
                </p>
                <label className="block text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1.5">Deployment Name <span className="font-normal text-slate-400 dark:text-gray-600">(optional)</span></label>
                <input
                  type="text"
                  value={aiDeployment}
                  onChange={(e) => { setAiDeployment(e.target.value); setAiSaved(false); setAiError('') }}
                  placeholder="gpt-4o"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-600 font-mono mb-1.5"
                />
                <p className="text-[10px] text-slate-400 dark:text-gray-600 mb-3 leading-relaxed">
                  Only needed if your endpoint URL doesn&apos;t already include it.
                </p>
              </>
            )}

            {aiProvider === 'custom' && (
              <>
                <label className="block text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1.5">Base URL</label>
                <input
                  type="text"
                  value={aiBaseUrl}
                  onChange={(e) => { setAiBaseUrl(e.target.value); setAiSaved(false); setAiError('') }}
                  placeholder="https://api.example.com"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-600 font-mono mb-3"
                />
                <label className="block text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1.5">Model Name</label>
                <input
                  type="text"
                  value={aiModel}
                  onChange={(e) => { setAiModel(e.target.value); setAiSaved(false); setAiError('') }}
                  placeholder="gpt-4o"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-600 font-mono mb-3"
                />
              </>
            )}

            {aiProvider === 'openai' && (
              <>
                <label className="block text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1.5">Model</label>
                <input
                  type="text"
                  value={aiModel}
                  onChange={(e) => { setAiModel(e.target.value); setAiSaved(false); setAiError('') }}
                  placeholder="gpt-4o (default)"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-600 font-mono mb-3"
                />
              </>
            )}

            <label className="block text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1.5">API Key</label>
            <div className="relative">
              <input
                type={showAiKey ? 'text' : 'password'}
                value={aiKey}
                onChange={(e) => { setAiKey(e.target.value); setAiSaved(false); setAiError('') }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const cfg: AiProviderConfig = { provider: aiProvider, apiKey: aiKey, endpoint: aiEndpoint, deploymentName: aiDeployment, model: aiModel, baseUrl: aiBaseUrl }
                    if (!aiKey.trim()) { setAiError('API key is required.'); return }
                    if (aiProvider === 'azure_openai' && !aiEndpoint.trim()) { setAiError('Endpoint URL is required for Azure OpenAI.'); return }
                    if (aiProvider === 'custom' && !aiBaseUrl.trim()) { setAiError('Base URL is required for Custom provider.'); return }
                    setAiError('')
                    setAiConfig(cfg)
                    setAiSaved(true)
                    setTimeout(() => { setAiSaved(false); onClose() }, 1200)
                  }
                }}
                placeholder="sk-... or your provider key"
                className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-2 pr-9 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-600 font-mono"
              />
              <button
                onClick={() => setShowAiKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 cursor-pointer"
                title={showAiKey ? 'Hide key' : 'Show key'}
              >
                {showAiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {aiError && (
              <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{aiError}</p>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => {
                  if (!aiKey.trim()) { setAiError('API key is required.'); return }
                  if (aiProvider === 'azure_openai' && !aiEndpoint.trim()) { setAiError('Endpoint URL is required for Azure OpenAI.'); return }
                  if (aiProvider === 'custom' && !aiBaseUrl.trim()) { setAiError('Base URL is required for Custom provider.'); return }
                  setAiError('')
                  setAiConfig({ provider: aiProvider, apiKey: aiKey, endpoint: aiEndpoint, deploymentName: aiDeployment, model: aiModel, baseUrl: aiBaseUrl })
                  setAiSaved(true)
                  setTimeout(() => { setAiSaved(false); onClose() }, 1200)
                }}
                disabled={!aiKey.trim()}
                className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold text-white transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-default ${
                  aiSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {aiSaved ? (
                  <>
                    <Check size={14} className="animate-scaleIn" />
                    Saved
                  </>
                ) : 'Save'}
              </button>
              {getAiConfig() && (
                <button
                  onClick={() => {
                    setAiKey(''); setAiEndpoint(''); setAiDeployment(''); setAiModel(''); setAiBaseUrl('')
                    removeAiConfig()
                    setAiSaved(false)
                  }}
                  className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/40 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
