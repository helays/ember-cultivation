// Event bridge (doc/02 §8.3): resolves event:probe reports from the world
// scene through the five steps — once → condition → chance → write flag →
// cooldown. Cooldowns live here (session-scope); once/flags live in worldFlags.
import { bus, EVT } from '@/core/bus.js'
import { getEvent } from '@/core/registry.js'
import { checkConditions } from '@/core/conditionChecker.js'
import { buildContext, applyEffects } from './gameContext.js'
import { useUiStore } from './stores/uiStore.js'
import { useQuestStore } from './stores/questStore.js'

const cooldowns = new Map()

function onceFired(event, worldFlags) {
  // "once" is satisfied when any of the event's flag effects has landed.
  return (event.effects ?? []).some(
    (e) => e.type === 'flag' && worldFlags[e.key] !== undefined,
  )
}

export function initEventBridge() {
  bus.on(EVT.EVENT_PROBE, ({ eventId }) => {
    const def = getEvent(eventId)
    if (!def) return
    const ui = useUiStore()
    const quest = useQuestStore()

    const trigger = def.trigger ?? {}
    const now = Date.now()
    if (now < (cooldowns.get(eventId) ?? 0)) return
    if (trigger.once && onceFired(def, quest.worldFlags)) return

    const ctx = buildContext()
    if (!checkConditions(def.conditions ?? [], ctx)) return
    if (trigger.chance !== undefined && Math.random() >= trigger.chance) return

    const applied = applyEffects(def.effects ?? [])
    for (const a of applied) {
      if (a.summary && !a.skipped) ui.pushToast({ text: a.summary, level: 'info' })
    }
    if (def.name) ui.pushToast({ text: `【${def.name}】`, level: 'info' })
    if (trigger.cooldown) cooldowns.set(eventId, now + trigger.cooldown * 1000)
  })
}
