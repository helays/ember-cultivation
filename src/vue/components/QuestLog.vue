<script setup>
import { computed } from 'vue'
import { bus, EVT } from '@/core/bus.js'
import { useQuestStore } from '../stores/questStore.js'
import { getQuest, getNpc } from '@/core/registry.js'

// Quest log (doc/02 state machine doc/11 §3.4): active + completed quests.
const quest = useQuestStore()

const active = computed(() =>
  quest.questProgress.active
    .map((a) => ({ ...a, def: getQuest(a.id) }))
    .filter((a) => a.def),
)
const completed = computed(() =>
  Object.entries(quest.questProgress.states)
    .filter(([, state]) => state === 'completed')
    .map(([id]) => getQuest(id))
    .filter(Boolean),
)

function close() {
  bus.emit(EVT.MENU_TOGGLE, { menu: 'quests' })
}
function giverName(id) {
  return getNpc(id)?.name ?? ''
}
</script>

<template>
  <div class="panel-wrap" @click.self="close">
    <div class="panel">
      <div class="head">
        <span>道途记事</span>
        <button class="plain" @click="close">✕</button>
      </div>

      <h3 class="section">进行中</h3>
      <div v-if="active.length" class="list">
        <div v-for="a in active" :key="a.id" class="quest">
          <div class="name">{{ a.def.name }}</div>
          <p class="summary">{{ a.def.summary }}</p>
          <p class="meta">委托人：{{ giverName(a.def.giver) }}</p>
        </div>
      </div>
      <p v-else class="empty">眼下没有未了之事。</p>

      <h3 class="section">已了结</h3>
      <div v-if="completed.length" class="list done">
        <div v-for="q in completed" :key="q.id" class="name dim">{{ q.name }}</div>
      </div>
      <p v-else class="empty dim">（暂无）</p>
    </div>
  </div>
</template>

<style scoped src="./panel.css"></style>
<style scoped>
.section {
  margin: 10px 0 8px;
  font-size: 12px;
  color: #e0c070;
}
.list {
  display: grid;
  gap: 10px;
}
.quest .name {
  font-size: 16px;
}
.summary {
  margin: 4px 0;
  font-size: 12px;
  color: #b5bdb8;
  line-height: 1.7;
}
.meta {
  margin: 0;
  font-size: 12px;
  color: #8a938f;
}
.empty {
  font-size: 12px;
  color: #8a938f;
}
.dim {
  color: #8a938f;
}
.done {
  gap: 4px;
}
</style>
