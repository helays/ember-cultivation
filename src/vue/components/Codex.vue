<script setup>
import { computed } from 'vue'
import { bus, EVT } from '@/core/bus.js'
import { usePlayerStore } from '../stores/playerStore.js'
import { getEnemy } from '@/core/registry.js'

// Codex (doc/02 §9.1): five categories with the 25/50/100% damage bonuses.
const player = usePlayerStore()

const CATEGORIES = [
  { key: 'yaoguai', name: '妖鬼' },
  { key: 'fabao', name: '法宝' },
  { key: 'gongfa', name: '功法残篇' },
  { key: 'liaozhai', name: '聊斋' },
  { key: 'endings', name: '结局' },
]

function entries(key) {
  return player.codex[key] ?? []
}

function bonus(count) {
  if (count >= 100) return '+10%'
  if (count >= 50) return '+10%'
  if (count >= 25) return '+5%'
  return ''
}

const enemyNames = computed(() => entries('yaoguai').map((id) => getEnemy(id)?.name ?? id))

function close() {
  bus.emit(EVT.MENU_TOGGLE, { menu: 'codex' })
}
</script>

<template>
  <div class="panel-wrap" @click.self="close">
    <div class="panel">
      <div class="head">
        <span>山海图鉴</span>
        <button class="plain" @click="close">✕</button>
      </div>

      <div v-for="cat in CATEGORIES" :key="cat.key" class="category">
        <div class="cat-head">
          <span class="name">{{ cat.name }}</span>
          <span class="count">{{ entries(cat.key).length }} 条</span>
          <span class="bonus">{{ bonus(entries(cat.key).length) }}</span>
        </div>
        <div v-if="cat.key === 'yaoguai' && enemyNames.length" class="items">
          <span v-for="n in enemyNames" :key="n" class="entry">{{ n }}</span>
        </div>
        <p v-else class="dim">（尚未收录）</p>
      </div>
      <p class="tip">图鉴完成度 25 / 50 / 100 条时，对妖鬼伤害 +5% / +10% / +10%（doc/02 §9.1）。</p>
    </div>
  </div>
</template>

<style scoped src="./panel.css"></style>
<style scoped>
.category {
  margin-bottom: 12px;
  border-bottom: 1px solid #5c4327;
  padding-bottom: 10px;
}
.cat-head {
  display: flex;
  gap: 12px;
  align-items: baseline;
  margin-bottom: 6px;
}
.cat-head .name {
  font-size: 16px;
  color: #e0c070;
}
.count {
  font-size: 12px;
  color: #8a938f;
}
.bonus {
  font-size: 12px;
  color: #4fd1c5;
}
.items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.entry {
  font-size: 12px;
  padding: 3px 8px;
  border: 1px solid #8c6a3f;
}
.dim {
  font-size: 12px;
  color: #6b7570;
  margin: 0;
}
.tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: #8a938f;
}
</style>
