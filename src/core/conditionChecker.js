// Conditions whitelist evaluator (doc/11 §3.3 — all 17 registered types;
// anything else throws). Reads the same plain ctx object as effectRunner.
import { logger } from './logger.js'

export function checkConditions(conditions, ctx) {
  for (const cond of conditions ?? []) {
    try {
      if (!checkCondition(cond, ctx)) return false
    } catch (err) {
      logger.error('conditionChecker', `condition ${cond?.type} failed`, err)
      throw err
    }
  }
  return true
}

function checkCondition(cond, ctx) {
  const p = ctx.player
  switch (cond.type) {
    case 'hasItem': {
      const slot = ctx.inventory.items.find((s) => s.id === cond.item)
      return !!slot && slot.qty >= (cond.qty ?? 1)
    }
    case 'notHasItem': {
      const slot = ctx.inventory.items.find((s) => s.id === cond.item)
      return !slot || slot.qty < (cond.qty ?? 1)
    }
    case 'flag':
      return ctx.worldFlags[cond.key] === cond.value
    case 'questState':
      return ctx.quests.states[cond.quest] === cond.state
    case 'realm':
      return p.realmIndex >= (cond.min ?? 0) && p.realmIndex <= (cond.max ?? 10)
    case 'stage':
      return p.stageIndex >= (cond.min ?? 1)
    case 'favor':
      return (ctx.relationships[cond.npc] ?? 0) >= cond.min
    case 'faction':
      return (ctx.factions[cond.faction] ?? 0) >= cond.min
    case 'timeOfDay': {
      const idx = ctx.world.time?.shichenIndex ?? 6
      const isNight = [10, 11, 0, 1, 2].includes(idx)
      return cond.day ? !isNight : isNight
    }
    case 'season':
      return ctx.world.season === cond.season
    case 'weather':
      return ctx.world.weather === cond.weather
    case 'map':
      return ctx.world.location === cond.map
    case 'mind':
      return p.mind >= cond.min
    case 'codex': {
      const list = p.codex[cond.category] ?? []
      return list.length >= (cond.min ?? 0)
    }
    case 'companion':
      return ctx.companions.some((c) => c.npc === cond.npc)
    case 'newGamePlus':
      return (ctx.newGamePlus ?? 0) >= cond.min
    case 'random':
      return Math.random() < cond.chance
    default:
      throw new Error(`condition type "${cond.type}" not in whitelist (doc/11 §3.3)`)
  }
}
