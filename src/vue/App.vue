<script setup>
import { onMounted, onUnmounted } from 'vue'
import { bus, EVT } from '@/core/bus.js'
import { useUiStore } from './stores/uiStore.js'
import MainMenu from './components/MainMenu.vue'
import SavePanel from './components/SavePanel.vue'
import BattleCommand from './components/BattleCommand.vue'
import Inventory from './components/Inventory.vue'
import SkillPanel from './components/SkillPanel.vue'
import QuestLog from './components/QuestLog.vue'
import Codex from './components/Codex.vue'
import Homestead from './components/Homestead.vue'
import TouchControls from './components/TouchControls.vue'
import DialogBox from './components/DialogBox.vue'
import { initEventBridge } from './eventBridge.js'

const ui = useUiStore()

function onToast(payload) {
  ui.pushToast(payload)
}

// menu:toggle is the single open/close channel for panels; components emit it
// on close, keys below emit it to open.
function onMenuToggle({ menu }) {
  ui.toggleMenu(menu)
}

// Panel hotkeys (world phase only, no blocking UI on top).
const MENU_KEYS = {
  KeyI: 'inventory',
  KeyK: 'skills',
  KeyJ: 'quests',
  KeyL: 'codex',
  KeyH: 'homestead',
  Escape: 'save',
}

function onKeydown(event) {
  if (ui.phase !== 'world') return
  if (ui.dialogOpen) return
  const menu = MENU_KEYS[event.code]
  if (!menu) return
  bus.emit(EVT.MENU_TOGGLE, { menu })
}

onMounted(() => {
  bus.on(EVT.TOAST, onToast)
  bus.on(EVT.MENU_TOGGLE, onMenuToggle)
  window.addEventListener('keydown', onKeydown)
  initEventBridge()
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
    <Inventory v-if="ui.openMenu === 'inventory'" />
    <SkillPanel v-if="ui.openMenu === 'skills'" />
    <QuestLog v-if="ui.openMenu === 'quests'" />
    <Codex v-if="ui.openMenu === 'codex'" />
    <Homestead v-if="ui.openMenu === 'homestead'" />
    <BattleCommand />
    <DialogBox />
    <TouchControls />
    <div class="toasts">
      <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.level">{{ t.text }}</div>
    </div>
    <div v-if="ui.phase === 'world'" class="hint">I 背包 · K 修行 · J 任务 · L 图鉴 · E 交互 · Esc 存档</div>
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
  font-size: 12px;
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
.hint {
  position: fixed;
  right: 12px;
  bottom: 8px;
  font-size: 12px;
  color: rgba(107, 117, 112, 0.85);
}
</style>
