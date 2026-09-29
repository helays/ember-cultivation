<script setup>
import { onMounted, onUnmounted, reactive } from 'vue'
import { useUiStore } from '../stores/uiStore.js'

// Virtual joystick (doc/15 §2.7 触屏): touch-drag vector + interact button.
// Phaser reads the vector through the game registry (no store objects).
const ui = useUiStore()
const state = reactive({ active: false, cx: 0, cy: 0, dx: 0, dy: 0 })

function setVec(dx, dy) {
  const game = window.__game
  if (game) game.registry.set('touchVec', { x: dx, y: dy })
}

function onStart(e) {
  const t = e.changedTouches[0]
  state.active = true
  state.cx = t.clientX
  state.cy = t.clientY
  state.dx = 0
  state.dy = 0
}

function onMove(e) {
  if (!state.active) return
  e.preventDefault()
  const t = e.changedTouches[0]
  const maxR = 44
  let dx = t.clientX - state.cx
  let dy = t.clientY - state.cy
  const len = Math.hypot(dx, dy) || 1
  if (len > maxR) { dx = (dx / len) * maxR; dy = (dy / len) * maxR }
  state.dx = dx
  state.dy = dy
  setVec(dx / maxR, dy / maxR)
}

function onEnd() {
  state.active = false
  state.dx = 0
  state.dy = 0
  setVec(0, 0)
}

function interact() {
  const game = window.__game
  const w = game?.scene?.getScene?.('WorldScene')
  w?.tryInteract?.()
}

onMounted(() => {
  window.addEventListener('touchstart', onStart, { passive: true })
  window.addEventListener('touchmove', onMove, { passive: false })
  window.addEventListener('touchend', onEnd)
})
onUnmounted(() => {
  window.removeEventListener('touchstart', onStart)
  window.removeEventListener('touchmove', onMove)
  window.removeEventListener('touchend', onEnd)
})
</script>

<template>
  <div v-if="ui.phase === 'world' && !ui.blocking" class="touch-ui">
    <div class="stick" :class="{ active: state.active }" :style="{ left: state.active ? state.cx - 52 + 'px' : '24px', top: state.active ? state.cy - 52 + 'px' : 'auto' }">
      <i class="knob" :style="{ transform: `translate(${state.dx}px, ${state.dy}px)` }" />
    </div>
    <button class="interact" @click="interact">交<br>互</button>
  </div>
</template>

<style scoped>
.touch-ui {
  position: fixed;
  inset: 0;
  pointer-events: none;
  display: none;
}
@media (pointer: coarse) {
  .touch-ui { display: block; }
}
.stick {
  position: absolute;
  bottom: 24px;
  width: 104px;
  height: 104px;
  border: 2px solid rgba(140, 106, 63, 0.7);
  border-radius: 50%;
  background: rgba(13, 31, 39, 0.35);
}
.knob {
  position: absolute;
  left: 32px;
  top: 32px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(232, 230, 220, 0.55);
  border: 2px solid #8c6a3f;
}
.interact {
  position: absolute;
  right: 24px;
  bottom: 40px;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  pointer-events: auto;
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.3;
  color: #e0c070;
  background: rgba(29, 59, 69, 0.8);
  border: 2px solid #8c6a3f;
}
</style>
