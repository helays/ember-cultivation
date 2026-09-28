<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { bus, EVT } from '@/core/bus.js'
import { useUiStore } from '../stores/uiStore.js'
import { usePlayerStore } from '../stores/playerStore.js'
import { getSkill } from '@/core/registry.js'

// Battle HUD + command panel (doc/02 §3.3). Seven commands are registered;
// 法宝/符箓/换人 stay disabled until their systems land (M4+).
const ui = useUiStore()
const player = usePlayerStore()

const visible = ref(false)
const awaiting = ref(false)
const round = ref(0)
const activeId = ref(null)
const log = ref([])
const enemies = ref([])
const targetId = ref(null)
const selectedSkillId = ref(null)
const resultText = ref('')

const battle = reactive({ mp: player.mp, maxMp: player.maxMp, hp: player.hp, maxHp: player.maxHp })

const activeIsPlayer = computed(() => activeId.value === 'player')

const usableSkills = computed(() => (player.skills ?? [])
  .map((s) => ({ ...s, def: getSkill(s.id) }))
  .filter((s) => s.def))

function pushLog(lines) {
  log.value = [...lines].slice(-6)
}

function onStart() {
  visible.value = true
  awaiting.value = false
  resultText.value = ''
  targetId.value = null
  selectedSkillId.value = null
  log.value = []
  enemies.value = []
}

function onTurn({ log: lines, active, round: rd, units }) {
  round.value = rd
  activeId.value = active
  pushLog(lines)
  awaiting.value = active === 'player'
  if (units) {
    enemies.value = units.filter((u) => u.side === 'enemy')
    const me = units.find((u) => u.side === 'ally')
    if (me) {
      battle.hp = me.hp
      battle.maxHp = me.maxHp
      battle.mp = me.mp
      battle.maxMp = me.maxMp
    }
  }
  if (active !== 'player') targetId.value = null
}

function sendCommand(command, extra = {}) {
  if (!awaiting.value) return
  const target = targetId.value ?? firstAliveEnemy()
  bus.emit(EVT.BATTLE_COMMAND, {
    actorId: 'player',
    command,
    targetId: target,
    skillId: extra.skillId ?? null,
  })
  awaiting.value = false
}

function firstAliveEnemy() {
  return enemies.value.find((e) => e.hp > 0)?.id ?? null
}

function onEnd({ result, rewards, allies: finalAllies }) {
  awaiting.value = false
  player.applyBattleResult({ result, rewards, allies: finalAllies })
  if (result === 'win') {
    resultText.value = `战斗胜利！修为 +${rewards.exp}，灵石 +${rewards.stones}`
  } else if (result === 'lose') {
    resultText.value = '你不支倒地……在客栈的柜台旁醒来。'
  } else {
    resultText.value = '你成功脱离了战斗。'
  }
  setTimeout(() => {
    visible.value = false
    ui.pushToast({ text: resultText.value, level: result === 'lose' ? 'warn' : 'info' })
  }, 900)
}

function disabledCommand() {
  ui.pushToast({ text: '该指令将在后续里程碑开放。', level: 'info' })
}

onMounted(() => {
  bus.on(EVT.BATTLE_START, onStart)
  bus.on(EVT.BATTLE_TURN, onTurn)
  bus.on(EVT.BATTLE_END, onEnd)
})

onUnmounted(() => {
  bus.off(EVT.BATTLE_START, onStart)
  bus.off(EVT.BATTLE_TURN, onTurn)
  bus.off(EVT.BATTLE_END, onEnd)
})
</script>

<template>
  <div v-if="visible" class="battle-ui">
    <div class="enemy-row">
      <div v-for="e in enemies" :key="e.id" class="enemy-card" :class="{ dead: e.hp <= 0, targeted: targetId === e.id }" @click="e.hp > 0 && (targetId = e.id)">
        <span class="name">{{ e.name }}</span>
        <span class="bar"><i :style="{ width: Math.max(0, (e.hp / e.maxHp) * 100) + '%' }" /></span>
      </div>
    </div>

    <div class="log">
      <p v-for="(line, i) in log" :key="i">{{ line }}</p>
    </div>

    <div class="bottom">
      <div class="status">
        <span>{{ player.name }} · {{ player.realm }}{{ player.stage }} · 第 {{ round }} 回合</span>
        <span class="bar hp"><i :style="{ width: Math.max(0, (battle.hp / battle.maxHp) * 100) + '%' }" /></span>
        <span class="bar mp"><i :style="{ width: Math.max(0, (battle.mp / battle.maxMp) * 100) + '%' }" /></span>
      </div>
      <div class="commands">
        <button :disabled="!activeIsPlayer || !awaiting" @click="sendCommand('attack')">普攻</button>
        <button
          v-for="s in usableSkills"
          :key="s.id"
          :disabled="!activeIsPlayer || !awaiting || battle.mp < (s.def.mpCost ?? 0)"
          :class="{ selected: selectedSkillId === s.id }"
          @click="selectedSkillId = s.id; sendCommand('skill', { skillId: s.id })"
        >{{ s.def.name }}</button>
        <button :disabled="!activeIsPlayer || !awaiting" @click="disabledCommand()">法宝</button>
        <button :disabled="!activeIsPlayer || !awaiting" @click="disabledCommand()">符箓</button>
        <button :disabled="!activeIsPlayer || !awaiting" @click="sendCommand('defend')">防御</button>
        <button :disabled="!activeIsPlayer || !awaiting" @click="sendCommand('flee')">逃跑</button>
        <button :disabled="!activeIsPlayer || !awaiting" @click="disabledCommand()">换人</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.battle-ui {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px 16px;
  pointer-events: none;
  font-family: var(--font-ui);
}
.enemy-row {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
.enemy-card {
  pointer-events: auto;
  min-width: 96px;
  padding: 6px 8px;
  border: 6px solid transparent;
  border-image: url('@/assets/ui/buttons/ui-btn-primary-normal.png') 6 fill;
  image-rendering: pixelated;
  color: #e8e6dc;
  cursor: pointer;
  display: grid;
  gap: 4px;
}
.enemy-card.targeted {
  border-image: url('@/assets/ui/buttons/ui-btn-primary-active.png') 6 fill;
}
.enemy-card.dead {
  opacity: 0.4;
}
.enemy-card .name {
  font-size: 12px;
}
.bar {
  display: block;
  height: 6px;
  background: #0d1f27;
  border: 1px solid #5c4327;
}
.bar i {
  display: block;
  height: 100%;
  background: #8f2b2b;
}
.bar.mp i {
  background: #4fd1c5;
}
.log {
  align-self: center;
  min-width: 380px;
  max-width: 80%;
  padding: 6px 12px;
  background: rgba(13, 31, 39, 0.72);
  border: 1px solid #5c4327;
  color: #b5bdb8;
  font-size: 12px;
  line-height: 1.7;
}
.log p {
  margin: 0;
}
.bottom {
  display: grid;
  gap: 8px;
}
.status {
  display: flex;
  gap: 12px;
  align-items: center;
  color: #e8e6dc;
  font-size: 12px;
}
.status .bar {
  width: 120px;
}
.commands {
  pointer-events: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.commands button {
  padding: 8px 12px;
  font-family: inherit;
  font-size: 12px;
  border: 6px solid transparent;
  border-image: url('@/assets/ui/buttons/ui-btn-primary-normal.png') 6 fill;
  image-rendering: pixelated;
  color: #e8e6dc;
  cursor: pointer;
}
.commands button:hover:not(:disabled) {
  border-image: url('@/assets/ui/buttons/ui-btn-primary-hover.png') 6 fill;
}
.commands button:disabled {
  opacity: 0.45;
  cursor: default;
}
.commands button.selected {
  border-image: url('@/assets/ui/buttons/ui-btn-primary-active.png') 6 fill;
}
</style>
