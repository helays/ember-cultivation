<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { bus, EVT } from '@/core/bus.js'
import { exportSave, importSave } from '@/core/saveManager.js'
import { useUiStore } from '../stores/uiStore.js'
import { useSaveStore } from '../stores/saveStore.js'

// Save flow (doc/12 §2.3/§2.4): pick a cartridge, confirm overwrites, then
// emit save:request — the Phaser side freezes the world, writes the slot and
// answers with save:written, which drives the three-stage animation below.
const ui = useUiStore()
const save = useSaveStore()

const confirming = ref(null) // slot id being confirmed for overwrite
const writing = ref(false)
const stageText = ref('')
const progress = ref(0)

// Copy texts are the ambience canon from doc/12 §2.6.
const STAGES = ['正在校验卡带…', '写入中…', '正在确认…']
const MIN_TOTAL_MS = 1200
const STAGE_GAP_MS = 120

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function close() {
  if (writing.value) return
  bus.emit(EVT.MENU_TOGGLE, { menu: 'save' })
}

function onSlotClick(slot) {
  if (writing.value) return
  if (slot.exists) {
    confirming.value = slot.slot
  } else {
    beginWrite(slot.slot)
  }
}

function beginWrite(slot) {
  confirming.value = null
  writing.value = true
  save.writing = true
  stageText.value = STAGES[0]
  progress.value = 0
  bus.emit(EVT.SAVE_REQUEST, { slot })
}

async function onWritten({ slot, ok }) {
  // Three-stage progress padded to the 1200ms ritual minimum (doc/12 §2.4).
  const started = performance.now()
  for (let i = 0; i < STAGES.length; i += 1) {
    stageText.value = STAGES[i]
    const target = ((i + 1) / STAGES.length) * 100
    const elapsed = performance.now() - started
    const budget = Math.max((MIN_TOTAL_MS - (STAGES.length - 1 - i) * STAGE_GAP_MS) / STAGES.length, 80)
    const steps = 12
    for (let s = 0; s < steps; s += 1) {
      await sleep(budget / steps)
      progress.value = Math.min(target, progress.value + target / steps)
    }
    progress.value = target
    if (i < STAGES.length - 1) await sleep(STAGE_GAP_MS)
  }
  stageText.value = ok ? '已刻录。卡带指示灯亮着。' : '写入没成功，卡带还是上一次的样子。'
  await sleep(750)
  writing.value = false
  save.writing = false
  await save.refreshSlots()
  bus.emit(EVT.MENU_TOGGLE, { menu: 'save' })
}

async function doExport() {
  const blob = await exportSave(confirming.value ?? 'slot-1')
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ember-save.json'
  a.click()
  URL.revokeObjectURL(url)
}

async function doImport(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const slot = confirming.value ?? 'slot-1'
  try {
    const result = await importSave(file, slot)
    if (result.ok) {
      await save.refreshSlots()
      ui.pushToast({ text: '外来的卡带插上了，内容已被读入。', level: 'info' })
    } else {
      ui.pushToast({ text: '写入没成功，卡带还是上一次的样子。', level: 'error' })
    }
  } catch (err) {
    ui.pushToast({ text: '这枚卡带被人拆开过或已损坏：' + err.message, level: 'error' })
  }
  event.target.value = ''
}

function stabilityColor(value) {
  if (value >= 70) return '#4fd1c5'
  if (value >= 30) return '#e0c070'
  return '#8f2b2b'
}

function fmtPlayTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h} 时 ${m} 分` : `${m} 分`
}

onMounted(async () => {
  bus.on(EVT.SAVE_WRITTEN, onWritten)
  await save.refreshSlots()
})

onUnmounted(() => {
  bus.off(EVT.SAVE_WRITTEN, onWritten)
})
</script>

<template>
  <div class="panel-wrap">
    <div class="panel">
      <div class="panel-head">
        <span class="io">
          <button class="plain" @click="doExport">导出</button>
          <label class="plain">导入<input type="file" accept=".json" hidden @change="doImport" /></label>
        </span>
        <span>这里可以记录你的道途。</span>
        <button class="close" :disabled="writing" @click="close">✕</button>
      </div>

      <div v-if="!writing" class="slots">
        <template v-if="!confirming">
          <button
            v-for="s in save.slots.filter((x) => !x.auto)"
            :key="s.slot"
            class="card"
            @click="onSlotClick(s)"
          >
            <span class="card-no">卡带 {{ s.slot.slice(-1) }}</span>
            <span v-if="s.exists" class="card-body">
              <span class="card-name">{{ s.saveName }}</span>
              <span class="card-meta">{{ s.dayLabel }} · 游玩 {{ fmtPlayTime(s.playTime) }}</span>
              <span class="stab">
                <i class="stab-bar" :style="{ width: s.stability + '%', background: stabilityColor(s.stability) }" />
                <em>稳定性 {{ s.stability }}</em>
              </span>
            </span>
            <span v-else class="card-body"><span class="card-name empty">空卡带</span></span>
          </button>
        </template>

        <template v-else>
          <div class="confirm">
            <p class="confirm-title">覆盖卡带 {{ confirming.slice(-1) }} ？</p>
            <p class="confirm-text">这段道途会被新的覆盖，旧的那段就找不回来了。</p>
            <div class="confirm-actions">
              <button class="danger" @click="beginWrite(confirming)">覆盖</button>
              <button @click="confirming = null">换一个槽位</button>
              <button autofocus @click="confirming = null">取消</button>
            </div>
          </div>
        </template>
      </div>

      <div v-else class="writing">
        <div class="track"><div class="fill" :style="{ width: progress + '%' }" /></div>
        <p class="stage">{{ stageText }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-wrap {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(13, 31, 39, 0.55);
  pointer-events: auto;
}
.panel {
  width: 420px;
  max-width: 92vw;
  padding: 18px 22px 22px;
  /* 9-slice panel art replaces the flat placeholder block (doc/15 §2.3) */
  border: 16px solid transparent;
  border-image: url('@/assets/ui/frames/ui-frame-panel-9slice.png') 16 fill;
  image-rendering: pixelated;
  color: #e8e6dc;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #e0c070;
  margin-bottom: 14px;
  letter-spacing: 1px;
}
.close {
  padding: 2px 8px;
  background: none;
  border: 4px solid transparent;
  border-image: url('@/assets/ui/buttons/ui-btn-primary-normal.png') 6 fill;
  color: #e8e6dc;
  cursor: pointer;
}
.slots {
  display: grid;
  gap: 10px;
}
.card {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 10px 12px;
  text-align: left;
  border: 6px solid transparent;
  border-image: url('@/assets/ui/buttons/ui-btn-primary-normal.png') 6 fill;
  image-rendering: pixelated;
  color: #e8e6dc;
  cursor: pointer;
}
.card:hover {
  border-image: url('@/assets/ui/buttons/ui-btn-primary-hover.png') 6 fill;
}
.card-no {
  color: #e0c070;
  min-width: 60px;
  font-size: 12px;
}
.card-body {
  display: grid;
  gap: 3px;
  flex: 1;
}
.card-name {
  font-size: 16px;
}
.card-name.empty {
  color: #8a938f;
}
.card-meta {
  font-size: 12px;
  color: #8a938f;
}
.stab {
  display: flex;
  align-items: center;
  gap: 8px;
}
.stab-bar {
  display: inline-block;
  height: 4px;
  border-radius: 2px;
}
.stab em {
  font-style: normal;
  font-size: 12px;
  color: #8a938f;
}
.confirm-title {
  margin: 4px 0 6px;
  font-size: 16px;
  color: #e0c070;
}
.confirm-text {
  margin: 0 0 14px;
  font-size: 12px;
  color: #b5bdb8;
}
.confirm-actions {
  display: flex;
  gap: 10px;
}
.confirm-actions button {
  flex: 1;
  padding: 8px 0;
  font-family: inherit;
  font-size: 12px;
  border: 6px solid transparent;
  border-image: url('@/assets/ui/buttons/ui-btn-primary-normal.png') 6 fill;
  image-rendering: pixelated;
  color: #e8e6dc;
  cursor: pointer;
}
.confirm-actions button.danger {
  border-image: url('@/assets/ui/buttons/ui-btn-primary-active.png') 6 fill;
  color: #d97b7b;
}
.confirm-actions button:hover {
  border-image: url('@/assets/ui/buttons/ui-btn-primary-hover.png') 6 fill;
}
.writing {
  display: grid;
  gap: 10px;
  padding: 8px 0 4px;
}
.track {
  height: 10px;
  background: #0d1f27;
  border: 1px solid #5c4327;
}
.fill {
  height: 100%;
  background: #4fd1c5;
  transition: width 90ms linear;
}
.stage {
  margin: 0;
  font-size: 12px;
  color: #e0c070;
  text-align: center;
  letter-spacing: 2px;
}
</style>
