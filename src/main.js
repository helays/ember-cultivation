import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Phaser from 'phaser'
import App from './vue/App.vue'
import { createPhaserConfig } from './phaser/config.js'
import { logger } from './core/logger.js'
import { setPayloadComposer, composeSave, writeSlot } from './core/saveManager.js'
import { useSaveStore } from './vue/stores/saveStore.js'
import { useUiStore } from './vue/stores/uiStore.js'

// Two runtimes share the page but never share modules: Vue owns #ui-root,
// Phaser owns #game-root. All cross-layer traffic goes through core/bus.js.
const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.mount('#ui-root')

// Composition root wires the Vue-side payload composer into core so Phaser
// scenes can build save payloads without importing Pinia (doc/12 §10.3).
setPayloadComposer(() => useSaveStore(pinia).buildPayload())

// New-version toast (doc/15 §2.7): hint when the service worker updates.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          const el = document.createElement('div')
          el.textContent = '新版已就绪，刷新页面以更新。'
          el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:999;background:#1d3b45;border:1px solid #e0c070;color:#e0c070;padding:8px 16px;font-size:12px'
          document.body.appendChild(el)
          setTimeout(() => el.remove(), 6000)
        }
      })
    })
  }).catch(() => {})
}
// slot-auto skeleton (doc/15 §2.2): best-effort hidden auto-backup on exit.
window.addEventListener('beforeunload', () => {
  if (useUiStore(pinia).phase !== 'world') return
  const payload = composeSave()
  if (payload) writeSlot('slot-auto', payload)
})

const game = new Phaser.Game(createPhaserConfig('game-root'))
game.events.once('ready', () => window.__fitCanvas?.())
game.events.on(Phaser.Core.Events.POST_RENDER, () => window.__fitCanvas?.())

// Debug asset gallery: dev-only, dynamically imported so production builds
// never bundle it (doc/14 §4.4).
if (import.meta.env.DEV) {
  const { AssetPreviewScene } = await import('./phaser/scenes/AssetPreviewScene.js')
  game.scene.add('AssetPreviewScene', AssetPreviewScene)
}

// The game instance must stay out of Vue reactivity; dev-only handle so the
// console can reach it while tuning scenes.
if (import.meta.env.DEV) window.__game = game

logger.info('main', 'vue + phaser started')
