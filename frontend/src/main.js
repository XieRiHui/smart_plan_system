import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { API_BASE_URL } from './api'

const loadAmapSdk = () => {
  if (window.AMap) return Promise.resolve()
  if (window.__amapSdkLoading) return window.__amapSdkLoading

  window.__amapSdkLoading = (async () => {
    const res = await fetch(`${API_BASE_URL}/weather/config/amap`, { cache: 'no-store' })
    if (!res.ok) throw new Error('amap config request failed')
    const cfg = await res.json()
    const jsKey = cfg?.js_key
    const securityJsCode = cfg?.security_js_code
    if (!jsKey || !securityJsCode) throw new Error('amap config missing')

    window._AMapSecurityConfig = { securityJsCode }

    await new Promise((resolve, reject) => {
      const existing = document.getElementById('amap-js-sdk')
      if (existing) {
        if (window.AMap) {
          resolve()
          return
        }
        existing.addEventListener('load', resolve, { once: true })
        existing.addEventListener('error', reject, { once: true })
        return
      }

      const script = document.createElement('script')
      script.id = 'amap-js-sdk'
      script.type = 'text/javascript'
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(jsKey)}`
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('amap sdk load failed'))
      document.head.appendChild(script)
    })
  })()

  return window.__amapSdkLoading
}

loadAmapSdk().catch(() => {})

createApp(App).use(router).mount('#app')
