import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Phaser from 'phaser'
import App from './vue/App.vue'
import { createPhaserConfig } from './phaser/config.js'
import { logger } from './core/logger.js'

// Two runtimes share the page but never share modules: Vue owns #ui-root,
// Phaser owns #game-root. All cross-layer traffic goes through core/bus.js.
const app = createApp(App)
app.use(createPinia())
app.mount('#ui-root')

const game = new Phaser.Game(createPhaserConfig('game-root'))

// The game instance must stay out of Vue reactivity; dev-only handle so the
// console can reach it while tuning scenes.
if (import.meta.env.DEV) window.__game = game

logger.info('main', 'vue + phaser started')
