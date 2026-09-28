<script setup>
import { onMounted, ref } from 'vue'
import { bus, EVT } from '@/core/bus.js'
import { readSlot, defaultPayload } from '@/core/saveManager.js'
import { useUiStore } from '../stores/uiStore.js'
import { useSaveStore } from '../stores/saveStore.js'
import { useWorldStore } from '../stores/worldStore.js'

const ui = useUiStore()
const save = useSaveStore()
const world = useWorldStore()

const view = ref('root') // root | load
const lastSlot = ref(localStorage.getItem('ec:last-slot:v1') ?? 'slot-1')
const lastSlotExists = ref(false)
const busy = ref(false)

onMounted(async () => {
  await save.refreshSlots()
  const found = save.slots.find((s) => s.slot === lastSlot.value)
  lastSlotExists.value = !!found?.exists
})

function enterWorld(mode, slot) {
  ui.phase = 'world'
  bus.emit(EVT.GAME_START, { mode, slot, state: world.sessionState() })
}

async function startFromSlot(slot, mode) {
  busy.value = true
  try {
    const result = await readSlot(slot)
    if (!result) return
    save.applyPayload(result.payload)
    localStorage.setItem('ec:last-slot:v1', slot)
    enterWorld(mode, slot)
  } catch (err) {
    ui.pushToast({ text: '这枚卡带读不出来，试试别的槽位。', level: 'error' })
  } finally {
    busy.value = false
  }
}

function startNew() {
  save.applyPayload(defaultPayload())
  enterWorld('new', null)
}

function openSettings() {
  ui.pushToast({ text: '设置将在后续里程碑开放。', level: 'info' })
}

function fmtPlayTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h} 时 ${m} 分` : `${m} 分`
}
</script>

<template>
  <div class="menu-wrap">
    <div class="menu-panel">
      <h1 class="title">末法仙途</h1>
      <p class="subtitle">灵气枯竭之年，道在何方。</p>

      <template v-if="view === 'root'">
        <div class="menu-list">
          <button :disabled="!lastSlotExists || busy" @click="startFromSlot(lastSlot, 'continue')">
            继续道途<span v-if="lastSlotExists" class="hint">卡带 {{ lastSlot.slice(-1) }}</span>
          </button>
          <button :disabled="busy" @click="startNew">新的道途</button>
          <button :disabled="busy" @click="view = 'load'">读档</button>
          <button @click="openSettings">设置</button>
        </div>
      </template>

      <template v-else>
        <p class="slot-tip">三枚卡带，一枚藏在匣子里。</p>
        <div class="slot-list">
          <button
            v-for="s in save.slots.filter((x) => !x.auto)"
            :key="s.slot"
            :disabled="!s.exists || busy"
            class="slot-row"
            @click="startFromSlot(s.slot, 'load')"
          >
            <span class="slot-no">卡带 {{ s.slot.slice(-1) }}</span>
            <span v-if="s.exists" class="slot-label">
              {{ s.saveName }} · {{ s.dayLabel }} · 游玩 {{ fmtPlayTime(s.playTime) }}
            </span>
            <span v-else class="slot-label empty">空</span>
          </button>
        </div>
        <button class="back" @click="view = 'root'">返回</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.menu-wrap {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(13, 31, 39, 0.55);
  /* The overlay host is click-through; modal surfaces opt back in. */
  pointer-events: auto;
}
.menu-panel {
  min-width: 320px;
  padding: 28px 36px;
  background: #1d3b45;
  border: 2px solid #8c6a3f;
  box-shadow: 0 0 0 2px #0d1f27, 0 8px 24px rgba(0, 0, 0, 0.5);
  color: #e8e6dc;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}
.title {
  margin: 0 0 4px;
  font-size: 28px;
  letter-spacing: 8px;
  color: #e0c070;
  text-align: center;
}
.subtitle {
  margin: 0 0 20px;
  font-size: 12px;
  color: #6b7570;
  text-align: center;
  letter-spacing: 2px;
}
.menu-list {
  display: grid;
  gap: 10px;
}
button {
  padding: 10px 14px;
  font-size: 15px;
  color: #e8e6dc;
  background: #38565c;
  border: 1px solid #8c6a3f;
  cursor: pointer;
  text-align: left;
}
button:hover:not(:disabled) {
  background: #2a3a5c;
  border-color: #b08a52;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
.hint {
  float: right;
  font-size: 12px;
  color: #4fd1c5;
}
.slot-tip {
  margin: 0 0 10px;
  font-size: 12px;
  color: #6b7570;
}
.slot-list {
  display: grid;
  gap: 8px;
}
.slot-row {
  display: flex;
  gap: 12px;
  align-items: baseline;
}
.slot-no {
  color: #e0c070;
  min-width: 56px;
}
.slot-label {
  font-size: 12px;
  color: #b5bdb8;
}
.slot-label.empty {
  color: #6b7570;
}
.back {
  margin-top: 14px;
  width: 100%;
  text-align: center;
}
</style>
