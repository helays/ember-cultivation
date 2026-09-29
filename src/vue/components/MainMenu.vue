<script setup>
import { onMounted, ref } from 'vue'
import { bus, EVT } from '@/core/bus.js'
import { readSlot, defaultPayload, isMemoryMode } from '@/core/saveManager.js'
import { useUiStore } from '../stores/uiStore.js'
import { useSaveStore } from '../stores/saveStore.js'
import { useWorldStore } from '../stores/worldStore.js'
import { usePlayerStore } from '../stores/playerStore.js'
import { getEnding } from '@/core/registry.js'

const ui = useUiStore()
const save = useSaveStore()
const world = useWorldStore()

const view = ref('root') // root | load
const lastSlot = ref(localStorage.getItem('ec:last-slot:v1') ?? 'slot-1')
const lastSlotExists = ref(false)
const busy = ref(false)
const storageWarn = ref(false)
onMounted(() => { storageWarn.value = isMemoryMode() })

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
  ui.pushToast({ text: '像素字体：Fusion Pixel（TakWolf，OFL 1.1）· 音画素材均为项目自有（见 doc/14 附录 A）', level: 'info' })
}

/** NG+ availability: a finished save with any unlocked ending (doc/12 §8). */
function ngPlusSource() {
  return save.slots.find((s) => s.exists && s.slot !== 'slot-auto' && s.hasEnding) ?? null
}

async function startNgPlus() {
  const source = ngPlusSource()
  if (!source) return
  busy.value = true
  try {
    const result = await readSlot(source.slot)
    if (!result) return
    const payload = result.payload
    save.applyPayload(payload)
    const player = usePlayerStore()
    // Fresh run, older world (doc/12 §8.2/§8.3): keep codex endings, quarter
    // the relationships, apply up to 3 ending inherit bonuses.
    const keptEndings = [...player.codex.endings]
    const inherit = {}
    let applied = 0
    for (const id of keptEndings) {
      const bonus = getEnding(id)?.inherit
      if (!bonus || applied >= 3) continue
      applied += 1
      for (const [k, v] of Object.entries(bonus)) inherit[k] = (inherit[k] ?? 1) + v
    }
    player.applyNgPlus(keptEndings, inherit)
    ui.pushToast({ text: `二周目：继承结局回响 ${applied} 条。`, level: 'info' })
    enterWorld('new', null)
  } catch {
    ui.pushToast({ text: '读取上一周目的卡带失败了。', level: 'error' })
  } finally {
    busy.value = false
  }
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
      <p v-if="storageWarn" class="storage-warn">当前浏览器禁用了本地存储，进度退出即丢失，请随时导出。</p>
      <h1 class="title">末法仙途</h1>
      <p class="subtitle">灵气枯竭之年，道在何方。</p>

      <template v-if="view === 'root'">
        <div class="menu-list">
          <button :disabled="!lastSlotExists || busy" @click="startFromSlot(lastSlot, 'continue')">
            继续道途<span v-if="lastSlotExists" class="hint">卡带 {{ lastSlot.slice(-1) }}</span>
          </button>
          <button :disabled="busy" @click="startNew">新的道途</button>
          <button v-if="ngPlusSource()" :disabled="busy" @click="startNgPlus">
            再入轮回（二周目）
          </button>
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
  /* 9-slice panel art replaces the flat placeholder block (doc/15 §2.3) */
  border: 16px solid transparent;
  border-image: url('@/assets/ui/frames/ui-frame-panel-9slice.png') 16 fill;
  image-rendering: pixelated;
  color: #e8e6dc;
}
.storage-warn {
  margin: 0 0 10px;
  font-size: 12px;
  color: #d97b7b;
  border: 1px solid #8f2b2b;
  padding: 6px 10px;
  text-align: center;
}
.title {
  margin: 0 0 4px;
  font-size: 24px;
  letter-spacing: 8px;
  color: #e0c070;
  text-align: center;
}
.subtitle {
  margin: 0 0 20px;
  font-size: 12px;
  color: #8a938f;
  text-align: center;
  letter-spacing: 2px;
}
.menu-list {
  display: grid;
  gap: 10px;
}
button {
  padding: 8px 12px;
  font-size: 16px;
  font-family: inherit;
  color: #e8e6dc;
  border: 6px solid transparent;
  border-image: url('@/assets/ui/buttons/ui-btn-primary-normal.png') 6 fill;
  image-rendering: pixelated;
  cursor: pointer;
  text-align: left;
}
button:hover:not(:disabled) {
  border-image: url('@/assets/ui/buttons/ui-btn-primary-hover.png') 6 fill;
}
button:active:not(:disabled) {
  border-image: url('@/assets/ui/buttons/ui-btn-primary-active.png') 6 fill;
}
button:disabled {
  border-image: url('@/assets/ui/buttons/ui-btn-primary-disabled.png') 6 fill;
  opacity: 0.9;
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
  color: #8a938f;
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
  min-width: 64px;
}
.slot-label {
  font-size: 12px;
  color: #b5bdb8;
}
.slot-label.empty {
  color: #8a938f;
}
.back {
  margin-top: 14px;
  width: 100%;
  text-align: center;
}
</style>
