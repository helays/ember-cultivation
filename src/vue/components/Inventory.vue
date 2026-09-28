<script setup>
import { computed } from 'vue'
import { bus, EVT } from '@/core/bus.js'
import { useUiStore } from '../stores/uiStore.js'
import { useInventoryStore } from '../stores/inventoryStore.js'
import { usePlayerStore } from '../stores/playerStore.js'
import { getItem } from '@/core/registry.js'
import { applyEffects } from '../gameContext.js'

// Inventory panel (doc/02 §5): grid, equip, use, hotbar binding.
const ui = useUiStore()
const inv = useInventoryStore()
const player = usePlayerStore()

const itemDefs = computed(() => inv.items.map((s) => ({ slot: s, def: getItem(s.id) })))
const equippedDefs = computed(() =>
  Object.entries(inv.equipment).map(([slotName, id]) => ({ slotName, id, def: id ? getItem(id) : null })),
)

function close() {
  bus.emit(EVT.MENU_TOGGLE, { menu: 'inventory' })
}

function onItem(entry, event) {
  const { slot, def } = entry
  if (!def) return
  if (event?.shiftKey) {
    // Bind to the first empty hotbar slot (or slot 1 when all full).
    const index = inv.hotbar.findIndex((id) => !id)
    inv.hotbar[index === -1 ? 0 : index] = slot.id
    ui.pushToast({ text: `已将${def.name}放入快捷栏。`, level: 'info' })
    return
  }
  if (def.slot) {
    inv.equip(slot.id)
    ui.pushToast({ text: `装备了${def.name}。`, level: 'info' })
    return
  }
  if (def.useEffects?.length) {
    const applied = applyEffects(def.useEffects)
    if (applied.some((a) => a.skipped)) return
    inv.remove(slot.id, 1)
    ui.pushToast({ text: `使用了${def.name}。`, level: 'info' })
  }
}

</script>

<template>
  <div class="panel-wrap" @click.self="close">
    <div class="panel">
      <div class="head">
        <span>乾坤囊（{{ inv.slotCount }}/{{ inv.capacity }}）</span>
        <button class="plain" @click="close">✕</button>
      </div>

      <div class="equip-row">
        <div v-for="e in equippedDefs" :key="e.slotName" class="equip" @click="inv.unequip(e.slotName)">
          <span class="slot-name">{{ e.slotName }}</span>
          <span>{{ e.def?.name ?? '（空）' }}</span>
        </div>
      </div>

      <div class="grid">
        <button v-for="entry in itemDefs" :key="entry.slot.id" class="cell" @click="onItem(entry, $event)">
          <span class="qty" v-if="entry.slot.qty > 1">{{ entry.slot.qty }}</span>
          <span class="label">{{ entry.def?.name ?? entry.slot.id }}</span>
        </button>
        <div v-for="n in Math.max(0, inv.capacity - inv.slotCount)" :key="'e' + n" class="cell empty" />
      </div>

      <div class="hotbar">
        <span>快捷栏</span>
        <div v-for="(id, i) in inv.hotbar" :key="i" class="cell small">
          {{ id ? (getItem(id)?.name ?? id) : '—' }}
        </div>
      </div>

      <p class="tip">点击物品使用/装备；Shift+点击绑定快捷栏。</p>
    </div>
  </div>
</template>

<style scoped src="./panel.css"></style>
<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  margin-bottom: 10px;
}
.cell {
  position: relative;
  min-height: 44px;
  padding: 4px;
  border: 4px solid transparent;
  border-image: url('@/assets/ui/buttons/ui-btn-primary-normal.png') 6 fill;
  image-rendering: pixelated;
  color: #e8e6dc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 12px;
}
.cell:hover {
  border-image: url('@/assets/ui/buttons/ui-btn-primary-hover.png') 6 fill;
}
.cell.empty {
  border-image: none;
  border: 1px dashed #5c4327;
  cursor: default;
}
.qty {
  position: absolute;
  right: 3px;
  bottom: 2px;
  font-size: 12px;
  color: #e0c070;
}
.equip-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.equip {
  flex: 1;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 6px 8px;
  border: 1px solid #8c6a3f;
  color: #b5bdb8;
  cursor: pointer;
}
.slot-name {
  color: #e0c070;
}
.hotbar {
  display: flex;
  gap: 8px;
  align-items: center;
  color: #8a938f;
  font-size: 12px;
}
.hotbar .cell.small {
  min-height: 30px;
  flex: 1;
}
.tip {
  margin: 10px 0 0;
  font-size: 12px;
  color: #8a938f;
}
</style>
