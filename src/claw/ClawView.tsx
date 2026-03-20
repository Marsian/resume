import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // If the user forgets scheme (e.g. "localhost:8000"), default to http.
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`

  try {
    const u = new URL(withScheme)
    return u.toString()
  } catch {
    return null
  }
}

function pickDashboardUrl(openclawBaseUrl: string) {
  // Keep it simple: assume the dashboard is served at the root of OpenClaw.
  // If your OpenClaw uses a sub-path, just paste that full URL in the input.
  return openclawBaseUrl.replace(/\/$/, '')
}

export default function ClawView() {
  const navigate = useNavigate()

  const [inputUrl, setInputUrl] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('claw.openclawUrl') ?? ''
  })

  // What we actually load into the iframe (after clicking "连接").
  const [activeUrl, setActiveUrl] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('claw.openclawUrl.active') ?? ''
  })

  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'loaded' | 'failed'>('idle')
  const dashboardUrl = useMemo(() => (activeUrl ? pickDashboardUrl(activeUrl) : ''), [activeUrl])

  function handleConnect() {
    const normalized = normalizeUrl(inputUrl)
    if (!normalized) {
      setLoadState('failed')
      return
    }

    window.localStorage.setItem('claw.openclawUrl', inputUrl.trim())
    window.localStorage.setItem('claw.openclawUrl.active', normalized)
    setActiveUrl(normalized)
    setLoadState('loading')
  }

  function handleClear() {
    setActiveUrl('')
    setLoadState('idle')
  }

return (
    <div className="min-h-screen bg-white text-black dark:bg-dark-bg-primary dark:text-dark-text-primary transition-colors">
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur border-b border-black/5 dark:bg-dark-bg-secondary dark:border-dark-border-primary">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 pl-[88px] pr-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-md border border-gray-300 bg-white/70 px-3 py-2 text-sm shadow-sm backdrop-blur hover:bg-white dark:border-dark-border-primary dark:bg-dark-bg-tertiary dark:hover:bg-dark-bg-secondary"
            >
              返回
            </button>
            <div className="flex flex-col leading-tight">
              <div className="text-base font-semibold">claw</div>
              <div className="text-xs text-gray-600 dark:text-dark-text-secondary">Openclaw Dashboard (remote)</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeUrl ? (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md border border-gray-300 bg-white/70 px-3 py-2 text-sm shadow-sm backdrop-blur hover:bg-white dark:border-dark-border-primary dark:bg-dark-bg-tertiary dark:hover:bg-dark-bg-secondary"
              >
                断开
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl pl-[88px] pr-4 py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          <section className="rounded-xl border border-black/10 bg-white/70 p-4 backdrop-blur dark:border-dark-border-primary dark:bg-dark-bg-secondary">
            <div className="text-sm font-semibold">连接远端 openclaw</div>
            <div className="mt-3 text-xs text-gray-600 dark:text-dark-text-secondary">
              填入 Openclaw 实例的地址，然后加载到下方 iframe。若你的 Openclaw 不是部署在根路径，请把完整子路径也一起粘贴进来。
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium" htmlFor="openclaw-url">
                Openclaw URL
              </label>
              <input
                id="openclaw-url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="例如 http://localhost:8000"
                className="mt-2 w-full rounded-md border border-gray-300 bg-white/90 px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-dark-border-primary dark:bg-dark-bg-tertiary"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleConnect}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/20 dark:bg-white dark:text-black dark:hover:bg-white/90"
              >
                连接
              </button>

              {loadState !== 'idle' ? (
                <div className="text-xs text-gray-600 dark:text-dark-text-secondary">
                  {loadState === 'loading' ? '加载中…' : loadState === 'loaded' ? '已加载' : '地址无效或无法加载'}
                </div>
              ) : (
                <div className="text-xs text-gray-600 dark:text-dark-text-secondary">尚未连接</div>
              )}
            </div>

            <div className="mt-4">
              <div className="text-xs text-gray-600 dark:text-dark-text-secondary">
                提示：iframe 跨域时是否能正常显示，取决于 Openclaw 端的 `X-Frame-Options` / `Content-Security-Policy`。
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-black/10 bg-white/70 p-4 backdrop-blur dark:border-dark-border-primary dark:bg-dark-bg-secondary">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">dashboard</div>
              {activeUrl ? (
                <a
                  href={dashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline dark:text-blue-300"
                >
                  在新标签打开
                </a>
              ) : (
                <div className="text-xs text-gray-600 dark:text-dark-text-secondary">先在左侧点击"连接"</div>
              )}
            </div>

            <div className="mt-3">
              {dashboardUrl ? (
                <iframe
                  title="openclaw-dashboard"
                  src={dashboardUrl}
                  className="h-[70vh] w-full rounded-lg border border-black/10 bg-white dark:border-dark-border-primary"
                  onLoad={() => setLoadState('loaded')}
                />
              ) : (
                <div className="flex h-[70vh] items-center justify-center rounded-lg border border-dashed border-black/10 bg-white/50 text-sm text-gray-600 dark:border-dark-border-primary dark:bg-dark-bg-tertiary dark:text-dark-text-secondary">
                  这里将显示远端 Openclaw 的网页控制台。
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

