export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return

  const config = useRuntimeConfig()
  const swUrl = `${config.app.baseURL}sw.js`
  const scopeUrl = new URL(config.app.baseURL, window.location.origin).href
  const canRegister
    = window.isSecureContext
      || window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1'

  if (!canRegister) return

  window.addEventListener('load', () => {
    void (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()
        const hasScope = registrations.some(registration => registration.scope === scopeUrl)
        if (!hasScope) {
          await navigator.serviceWorker.register(swUrl, { scope: config.app.baseURL })
        }
      } catch {
        // 安装能力失败时不打断游戏流程，保持静默降级。
      }
    })()
  }, { once: true })
})
