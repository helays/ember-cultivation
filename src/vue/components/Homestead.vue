<script setup>
import { computed } from 'vue'
import { bus, EVT } from '@/core/bus.js'
import { useUiStore } from '../stores/uiStore.js'
import { usePlayerStore } from '../stores/playerStore.js'
import { useWorldStore } from '../stores/worldStore.js'
import { useInventoryStore } from '../stores/inventoryStore.js'
import { listTable, getItem } from '@/core/registry.js'
import homesteadCfg from '@/data/homestead.json'

// Homestead panel (doc/02 §9, doc/15 §2.6): spirit density, farm plots and
// the three craft stations. Only meaningful inside map-dongfu; the world
// clock (hours) drives growth checks.
const ui = useUiStore()
const player = usePlayerStore()
const world = useWorldStore()
const inv = useInventoryStore()

const HOMESTEAD = { level: 1, spiritDensity: 1.0, fieldSlots: 0, fields: [], facilities: { alchemy: 0, crafting: 0, talisman: 0, storage: 0 } }

const hs = computed(() => player.homestead ?? JSON.parse(JSON.stringify(HOMESTEAD)))
const inDongfu = computed(() => world.location === 'map-dongfu')
const spiritDensity = computed(() => {
  const byLevel = homesteadCfg.spiritDensityByLevel ?? [1.0]
  return inDongfu.value ? byLevel[Math.min(hs.value.level - 1, byLevel.length - 1)] ?? 1.4 : 1.0
})
const totalHours = computed(() => (world.time.dayIndex ?? 0) * 12 + (world.time.shichenIndex ?? 0))
const slots = computed(() => (homesteadCfg.fieldSlotsByLevel ?? [2])[Math.min(hs.value.level - 1, 5)] ?? 2)

const farms = computed(() => listTable('farming'))
// Display-driven slots: render every configured plot, materialize on use
// (stored fields start empty — avoids the chicken-and-egg init problem).
const fieldViews = computed(() => {
  const out = []
  for (let i = 1; i <= slots.value; i += 1) {
    const h = ensureHs()
    while (h.fields.length < i) h.fields.push({ slot: h.fields.length + 1, seed: null, plantedHours: null, growHours: 0, mature: false })
    out.push(h.fields.find((f) => f.slot === i))
  }
  return out
})
const alchemy = computed(() => listTable('alchemy'))
const crafting = computed(() => listTable('crafting'))
const talismans = computed(() => listTable('talismans'))
const endings = computed(() => listTable('endings'))
const unlockedEndings = computed(() => player.codex.endings ?? [])

function ensureHs() {
  if (!player.homestead) player.homestead = JSON.parse(JSON.stringify(HOMESTEAD))
  return player.homestead
}

function plant(farm) {
  const h = ensureHs()
  while (h.fields.length < slots.value) h.fields.push({ slot: h.fields.length + 1, seed: null, plantedHours: null, growHours: 0, mature: false })
  const empty = h.fields.find((f) => !f.seed)
  if (!empty) { ui.pushToast({ text: '灵田已满。', level: 'warn' }); return }
  if (!inv.remove(farm.seed, 1)) { ui.pushToast({ text: `缺少${getItem(farm.seed)?.name ?? '种子'}。`, level: 'warn' }); return }
  empty.seed = farm.id
  empty.plantedHours = totalHours.value
  empty.growHours = farm.growHours
  empty.mature = false
  ui.pushToast({ text: `种下了${farm.name}。`, level: 'info' })
}

function matureIn(field) {
  if (!field.seed) return null
  const left = field.growHours - (totalHours.value - (field.plantedHours ?? 0))
  return left > 0 ? left : 0
}

function harvest(field) {
  if (!field.seed || matureIn(field) > 0) return
  const farm = farms.value.find((f) => f.id === field.seed)
  if (!farm) return
  inv.add(farm.product, 1)
  field.seed = null
  field.plantedHours = null
  field.mature = false
  ui.pushToast({ text: `收获了${getItem(farm.product)?.name ?? farm.product}。`, level: 'info' })
}

function upgrade() {
  const h = ensureHs()
  const cost = (homesteadCfg.upgradeCost ?? [])[h.level - 1]
  if (!cost) { ui.pushToast({ text: '洞府已至大成。', level: 'warn' }); return }
  if (player.stones < cost.stones) { ui.pushToast({ text: '灵石不足。', level: 'warn' }); return }
  player.stones -= cost.stones
  h.level += 1
  ui.pushToast({ text: `洞府升至 ${h.level} 阶，灵气渐浓。`, level: 'info' })
}

function canCraft(recipe) {
  const facility = hs.value.facilities?.[recipe.station ?? stationOf(recipe)] ?? 0
  void facility
  return (recipe.inputs ?? []).every((i) => inv.count(i.item) >= i.qty)
}

function stationOf(recipe) {
  if (alchemy.value.some((r) => r.id === recipe.id)) return 'alchemy'
  if (crafting.value.some((r) => r.id === recipe.id)) return 'crafting'
  return 'talisman'
}

function facilityOk(recipe) {
  const station = stationOf(recipe)
  return (hs.value.facilities?.[station] ?? 0) >= (recipe.reqFacility ?? 1)
}

function craft(recipe) {
  if (!facilityOk(recipe)) { ui.pushToast({ text: '设施等级不足，先升级洞府。', level: 'warn' }); return }
  if (!canCraft(recipe)) { ui.pushToast({ text: '材料不足。', level: 'warn' }); return }
  for (const i of recipe.inputs) inv.remove(i.item, i.qty)
  inv.add(recipe.output.item, recipe.output.qty)
  bus.emit(EVT.EVENT_PROBE, { eventId: `craft:${recipe.id}` })
  ui.pushToast({ text: `${recipe.name}：获得${getItem(recipe.output.item)?.name ?? recipe.output.item} ×${recipe.output.qty}。`, level: 'info' })
}

function buildFacility(name) {
  const h = ensureHs()
  h.facilities = h.facilities ?? { alchemy: 0, crafting: 0, talisman: 0, storage: 0 }
  const cur = h.facilities[name] ?? 0
  if (cur >= 3) { ui.pushToast({ text: '该设施已至三阶。', level: 'warn' }); return }
  const cost = 150 * (cur + 1)
  if (player.stones < cost) { ui.pushToast({ text: '灵石不足。', level: 'warn' }); return }
  player.stones -= cost
  h.facilities[name] = cur + 1
  ui.pushToast({ text: `${name}设施升至 ${cur + 1} 阶。`, level: 'info' })
}

const FACILITY_NAMES = { alchemy: '丹房', crafting: '器坊', talisman: '符房', storage: '仓库' }

function close() {
  bus.emit(EVT.MENU_TOGGLE, { menu: 'homestead' })
}
</script>

<template>
  <div class="panel-wrap" @click.self="close">
    <div class="panel">
      <div class="head">
        <span>洞府 · {{ inDongfu ? '灵气浓度 ×' + spiritDensity.toFixed(1) : '（进入洞府后生效）' }}</span>
        <button class="plain" @click="close">✕</button>
      </div>

      <div class="section-row">
        <span>洞府 {{ hs.level }} 阶 · 灵田 {{ slots }} 格</span>
        <button class="action" @click="upgrade">升级洞府</button>
      </div>

      <h3 class="section">灵田</h3>
      <div class="fields">
        <div v-for="f in fieldViews" :key="f.slot" class="field" @click="harvest(f)">
          <template v-if="!f.seed">
            <button v-for="farm in farms" :key="farm.id" class="action tiny" @click.stop="plant(farm)">种{{ farm.name }}</button>
          </template>
          <template v-else>
            <span>{{ farms.find(x => x.id === f.seed)?.name }}</span>
            <span :class="matureIn(f) === 0 ? 'ready' : 'dim'">
              {{ matureIn(f) === 0 ? '已成熟（点击收获）' : `还需 ${matureIn(f)} 时辰` }}
            </span>
          </template>
        </div>
      </div>

      <h3 class="section">设施</h3>
      <div class="facilities">
        <button v-for="(label, name) in FACILITY_NAMES" :key="name" class="action" @click="buildFacility(name)">
          {{ label }} {{ hs.facilities?.[name] ?? 0 }} 阶（{{ 150 * ((hs.facilities?.[name] ?? 0) + 1) }} 灵石）
        </button>
      </div>

      <h3 class="section">炼制</h3>
      <div class="crafts">
        <button v-for="r in [...alchemy, ...crafting, ...talismans]" :key="r.id" class="action" :disabled="!canCraft(r) || !facilityOk(r)" @click="craft(r)">
          {{ r.name }}
        </button>
      </div>

      <h3 class="section">结局回响</h3>
      <p v-if="!unlockedEndings.length" class="dim">尚未抵达任何结局。（化神圆满后寻玄阳子论道）</p>
      <div v-else class="endings">
        <div v-for="e in endings.filter(x => unlockedEndings.includes(x.id))" :key="e.id" class="ending">
          <span class="e-name">{{ e.name }}</span>
          <span class="dim">{{ e.desc }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./panel.css"></style>
<style scoped>
.section-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #b5bdb8; }
.section { margin: 12px 0 8px; font-size: 12px; color: #e0c070; }
.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.field {
  min-height: 48px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  border: 1px solid #5c4327; padding: 6px 8px; font-size: 12px; cursor: pointer; color: #e8e6dc;
}
.field .action.tiny { padding: 4px 6px; font-size: 12px; }
.ready { color: #4fd1c5; }
.dim { color: #8a938f; font-size: 12px; }
.facilities, .crafts { display: flex; flex-wrap: wrap; gap: 8px; }
.endings { display: grid; gap: 6px; }
.ending { display: flex; gap: 10px; font-size: 12px; }
.e-name { color: #e0c070; min-width: 48px; }
</style>
