<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { bus, EVT } from '@/core/bus.js'
import { useUiStore } from '../stores/uiStore.js'
import { buildContext, applyEffects } from '../gameContext.js'
import { checkConditions } from '@/core/conditionChecker.js'
import { getNpc, getDialogue, listTable } from '@/core/registry.js'

// Dialog box (doc/02 §2.3): the Phaser side only sends {npcId}; root node
// resolution (conditions against live game state) happens here, choice
// effects apply through effectRunner, and node progression is Vue-owned.
const ui = useUiStore()
const node = ref(null)
const npcId = ref(null)

/** First node for the npc whose own conditions pass; falls back to the first. */
function resolveRoot(id) {
  const all = listTable('dialogues').filter((d) => d.npc === id)
  if (!all.length) return null
  const ctx = buildContext()
  // Conditional nodes that pass win (turn-in etc.); else first unconditional.
  const conditional = all.find((d) => (d.conditions ?? []).length > 0 && checkConditions(d.conditions, ctx))
  if (conditional) return conditional
  return all.find((d) => !(d.conditions ?? []).length) ?? all[0]
}

function open(payload) {
  const id = payload.npcId
  const start = payload.nodeId ? getDialogue(payload.nodeId) : resolveRoot(id)
  if (!start) return
  npcId.value = id
  node.value = { ...start, nodeId: start.id }
  ui.openDialog()
}

function visibleChoices(n) {
  const ctx = buildContext()
  return (n.choices ?? []).filter((c) => !c.conditions || checkConditions(c.conditions, ctx))
}

function pick(choice, index) {
  if (choice.effects?.length) {
    const applied = applyEffects(choice.effects)
    for (const a of applied) {
      if (a.summary && !a.skipped) ui.pushToast({ text: a.summary, level: 'info' })
    }
  }
  bus.emit(EVT.DIALOG_CHOICE, {
    nodeId: node.value?.nodeId,
    choiceIndex: index,
    next: choice.next ?? null,
  })
  if (choice.next) {
    const next = getDialogue(choice.next)
    if (next) node.value = { ...next, nodeId: next.id }
    else close()
  } else {
    close()
  }
}

function close() {
  const id = npcId.value
  node.value = null
  npcId.value = null
  ui.closeDialog()
  bus.emit(EVT.DIALOG_CLOSE, { npcId: id })
}

function npcName() {
  return npcId.value && npcId.value !== 'narrator' ? getNpc(npcId.value)?.name ?? '' : ''
}

function onKeydown(e) {
  if (!node.value) return
  const idx = Number(e.key) - 1
  const choices = visibleChoices(node.value)
  if (idx >= 0 && idx < choices.length) pick(choices[idx], idx)
}

onMounted(() => {
  bus.on(EVT.DIALOG_OPEN, open)
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  bus.off(EVT.DIALOG_OPEN, open)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div v-if="node" class="dialog-wrap">
    <div class="dialog">
      <div class="who">{{ npcName() || '……' }}</div>
      <p class="text">{{ node.text }}</p>
      <div class="choices">
        <button v-for="(c, i) in visibleChoices(node)" :key="i" @click="pick(c, i)">
          {{ i + 1 }}. {{ c.text }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-wrap {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 24px;
  pointer-events: none;
}
.dialog {
  width: 600px;
  max-width: 94vw;
  padding: 12px 16px 14px;
  border: 12px solid transparent;
  border-image: url('@/assets/ui/frames/ui-frame-dialog-9slice.png') 16 fill;
  image-rendering: pixelated;
  pointer-events: auto;
  color: #e8e6dc;
  font-family: var(--font-ui);
}
.who {
  font-size: 12px;
  color: #e0c070;
  margin-bottom: 6px;
}
.text {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.8;
}
.choices {
  display: grid;
  gap: 6px;
}
.choices button {
  text-align: left;
  padding: 6px 10px;
  font-family: inherit;
  font-size: 12px;
  border: 4px solid transparent;
  border-image: url('@/assets/ui/buttons/ui-btn-primary-normal.png') 6 fill;
  image-rendering: pixelated;
  color: #e8e6dc;
  cursor: pointer;
}
.choices button:hover {
  border-image: url('@/assets/ui/buttons/ui-btn-primary-hover.png') 6 fill;
}
</style>
