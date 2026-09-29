<script setup>
import { computed } from 'vue'
import { bus, EVT } from '@/core/bus.js'
import { useUiStore } from '../stores/uiStore.js'
import { usePlayerStore, expThreshold } from '../stores/playerStore.js'
import { useInventoryStore } from '../stores/inventoryStore.js'
import { getSkill, getGongfa } from '@/core/registry.js'
import { useWorldStore } from '../stores/worldStore.js'
import homesteadCfg from '@/data/homestead.json'

// Cultivation panel (doc/02 §4): meditation, breakthrough, skill upgrades.
// Meditation/breakthrough outcomes that need the world (time advance, 心魔
// battle) are signalled over the bus for the Phaser side to execute.
const ui = useUiStore()
const player = usePlayerStore()
const inv = useInventoryStore()
const world = useWorldStore()

function spiritDensityOf() {
  if (world.location !== 'map-dongfu') return 1.0
  const byLevel = homesteadCfg.spiritDensityByLevel ?? [1.0]
  const level = player.homestead?.level ?? 1
  return byLevel[Math.min(level - 1, byLevel.length - 1)] ?? 1.4
}

const skills = computed(() =>
  (player.skills ?? []).map((s) => ({ ...s, def: getSkill(s.id) })).filter((s) => s.def),
)
const gongfaDef = computed(() => (player.gongfa?.id ? getGongfa(player.gongfa.id) : null))
const expPct = computed(() => Math.min(100, Math.round((player.exp / player.threshold) * 100)))
const hasZhujiDan = computed(() => inv.count('item-dan-zhuji') > 0)

function close() {
  bus.emit(EVT.MENU_TOGGLE, { menu: 'skills' })
}

function meditate() {
  const result = player.meditate({ spiritDensity: spiritDensityOf() })
  bus.emit(EVT.SCENE_TRANSITION, { from: 'meditate', to: `meditate:${result.event}`, fade: false })
  if (result.event === 'insight') {
    ui.pushToast({ text: `顿悟！修为 +${result.gain}。`, level: 'info' })
  } else if (result.event === 'inner-demon') {
    ui.pushToast({ text: '心魔侵扰！', level: 'warn' })
    bus.emit(EVT.BATTLE_SUMMON, { enemies: ['enemy-xin-mo'], reason: result.event })
  } else {
    ui.pushToast({ text: `吐纳一周天，修为 +${result.gain}。`, level: 'info' })
  }
}

function breakthrough() {
  const pill = hasZhujiDan.value && player.realmIndex === 1
  if (pill) inv.remove('item-dan-zhuji', 1)
  const result = player.breakthrough({ pill })
  if (result.ok) {
    ui.pushToast({ text: `突破成功！如今是${player.realm}${player.stage}。`, level: 'info' })
  } else if (result.failure === 'light') {
    ui.pushToast({ text: '突破失败，受了轻伤，修为略有折损。', level: 'warn' })
  } else if (result.failure === 'heavy') {
    ui.pushToast({ text: '突破失败，重伤！修为大损，心境受挫。', level: 'warn' })
  } else if (result.failure === 'fire-deviation') {
    ui.pushToast({ text: '走火入魔！心魔现形——', level: 'error' })
    bus.emit(EVT.BATTLE_SUMMON, { enemies: ['enemy-xin-mo'], reason: 'fire-deviation' })
  }
}

function buildAllyDesc() {
  const p = player
  return [{
    id: 'player', name: p.name, hp: p.hp, maxHp: p.maxHp, mp: p.mp, maxMp: p.maxMp,
    atk: p.attackWithGear, def: p.defenseWithGear, spd: p.attrs.speed, shenshi: p.shenshi,
    spiritualRoot: p.spiritualRoot, skills: (p.skills ?? []).map((s) => s.id),
    skillLevels: Object.fromEntries((p.skills ?? []).map((s) => [s.id, s.level ?? 1])),
  }]
}

function upgrade(skill) {
  const result = player.upgradeSkill(skill.id, skill.def.upgradeCost, skill.def.maxLevel)
  if (!result.ok) {
    const reasons = { 'not-learned': '尚未学会', 'max-level': '已至大成', 'no-points': '悟道点不足' }
    ui.pushToast({ text: reasons[result.reason] ?? '无法升级', level: 'warn' })
  } else {
    ui.pushToast({ text: `${skill.def.name}臻至${skill.level + 1}层。`, level: 'info' })
  }
}
</script>

<template>
  <div class="panel-wrap" @click.self="close">
    <div class="panel">
      <div class="head">
        <span>修行</span>
        <button class="plain" @click="close">✕</button>
      </div>

      <div class="status">
        <span class="realm">{{ player.realm }}·{{ player.stage }}</span>
        <div class="track"><i :style="{ width: expPct + '%' }" /></div>
        <span class="pct">{{ player.exp }} / {{ player.threshold }}</span>
      </div>

      <div class="actions">
        <button class="action" @click="meditate">打坐（1 时辰）</button>
        <button class="action" :disabled="!player.expFull" @click="breakthrough">
          突破{{ player.expFull ? '' : '（修为未满）' }}
        </button>
      </div>

      <div v-if="gongfaDef" class="gongfa">
        <span class="label">主修功法</span>
        <span>{{ gongfaDef.name }} · 第{{ player.gongfa.tier }}层</span>
        <span class="dim">打坐效率 ×{{ gongfaDef.cultivateBonus }}</span>
      </div>

      <div class="skills">
        <div v-for="s in skills" :key="s.id" class="skill">
          <span class="name">{{ s.def.name }} · {{ s.level }}层</span>
          <span class="dim">威力 {{ (s.def.power * (1 + 0.08 * (s.level - 1))).toFixed(2) }} · 灵力 {{ s.def.mpCost }}</span>
          <button class="action" :disabled="s.level >= s.def.maxLevel || player.daoPoints < (s.def.upgradeCost?.[s.level - 1] ?? 1)" @click="upgrade(s)">
            升级（{{ s.def.upgradeCost?.[s.level - 1] ?? 1 }} 悟道点）
          </button>
        </div>
      </div>
      <p class="tip">悟道点：{{ player.daoPoints }} · 心境：{{ player.mind }}</p>
    </div>
  </div>
</template>

<style scoped src="./panel.css"></style>
<style scoped>
.status {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}
.realm {
  color: #e0c070;
  font-size: 16px;
}
.track {
  flex: 1;
  height: 8px;
  background: #0d1f27;
  border: 1px solid #5c4327;
}
.track i {
  display: block;
  height: 100%;
  background: #c9713a;
}
.pct {
  font-size: 12px;
  color: #8a938f;
}
.actions {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.gongfa {
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-size: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #5c4327;
  margin-bottom: 10px;
}
.gongfa .label {
  color: #e0c070;
}
.skills {
  display: grid;
  gap: 8px;
}
.skill {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}
.skill .name {
  color: #e8e6dc;
}
.dim {
  color: #8a938f;
  flex: 1;
}
.tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: #8a938f;
}
</style>
