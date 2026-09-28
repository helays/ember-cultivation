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
