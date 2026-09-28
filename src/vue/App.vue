<script setup>
import { onMounted, onUnmounted } from 'vue'
import { bus, EVT } from '@/core/bus.js'
import { useUiStore } from './stores/uiStore.js'
import MainMenu from './components/MainMenu.vue'
import SavePanel from './components/SavePanel.vue'

const ui = useUiStore()

function onToast(payload) {
  ui.pushToast(payload)
}

// menu:toggle is the single open/close channel for panels; SavePanel emits it
// on close, Phaser emits it from in-world save points (E key).
function onMenuToggle({ menu }) {
  if (menu === 'save') ui.toggleMenu('save')
}

function onKeydown(event) {
  if (event.key !== 'Escape') return
  if (ui.phase !== 'world') return
  bus.emit(EVT.MENU_TOGGLE, { menu: 'save' })
}

onMounted(() => {
  bus.on(EVT.TOAST, onToast)
  bus.on(EVT.MENU_TOGGLE, onMenuToggle)
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  bus.off(EVT.TOAST, onToast)
  bus.off(EVT.MENU_TOGGLE, onMenuToggle)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <!-- Overlay host: click-through while nothing blocks; panels below take over
       pointer events when uiStore.blocking is set (doc/13 §3.2). -->
  <div class="ui-overlay" :class="{ blocking: ui.blocking }">
    <MainMenu v-if="ui.phase === 'menu'" />
    <SavePanel v-if="ui.openMenu === 'save'" />
    <div class="toasts">
      <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.level">{{ t.text }}</div>
    </div>
  </div>
</template>

<style scoped>
.ui-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  font-family: var(--font-ui);
}
.ui-overlay.blocking {
  pointer-events: auto;
}
.toasts {
  position: fixed;
  left: 50%;
  bottom: 48px;
  transform: translateX(-50%);
  display: grid;
  gap: 6px;
  justify-items: center;
}
.toast {
  padding: 6px 16px;
  font-size: 13px;
  color: #e8e6dc;
  background: rgba(29, 59, 69, 0.92);
  border: 1px solid #8c6a3f;
  letter-spacing: 1px;
}
.toast.warn {
  border-color: #e0c070;
  color: #e0c070;
}
.toast.error {
  border-color: #8f2b2b;
  color: #d97b7b;
}
</style>
