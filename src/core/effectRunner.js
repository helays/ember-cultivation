// Effects whitelist executor (doc/11 §3.2 — the ONLY runtime consumer of the
// 27 registered effect types; anything else throws). Pure module: it mutates
// a plain `ctx` game-state object, never Pinia or Phaser directly.
//
// ctx shape (built by the Vue layer, applied back to stores):
// {
//   player: { exp, stones, hp, maxHp, mp, maxMp, mind, realmIndex, stageIndex,
//             skills[], gongfa, codex{}, spiritualRoot },
//   world: { location, unlockedLocations[], time{...}, weather, season }
//   inventory: { items[{id, qty}], equipment{}, hotbar[] }
//   quests: { states{}, active[], counters{} }
//   worldFlags: {}
//   relationships: {}, factions: {}
//   companions: [], lover: null
// }
import { getById, getItem } from './registry.js'
import { logger } from './logger.js'

export function runEffects(effects, ctx) {
  const applied = []
  for (const eff of effects ?? []) {
    try {
      applied.push(applyEffect(eff, ctx))
    } catch (err) {
      logger.error('effectRunner', `effect ${eff?.type} failed`, err)
      throw err
    }
  }
  return applied
}

function applyEffect(eff, ctx) {
  const p = ctx.player
  switch (eff.type) {
    case 'exp':
      p.exp += eff.value
      return { ...eff, summary: `修为 ${eff.value >= 0 ? '+' : ''}${eff.value}` }

    case 'stone':
      p.stones = Math.max(0, p.stones + eff.value)
      return { ...eff, summary: `灵石 ${eff.value >= 0 ? '+' : ''}${eff.value}` }

    case 'item':
      addItem(ctx.inventory, eff.item, eff.qty ?? 1)
      return { ...eff, summary: `获得 ${getItem(eff.item)?.name ?? eff.item} ×${eff.qty ?? 1}` }

    case 'consume': {
      const removed = removeItem(ctx.inventory, eff.item, eff.qty ?? 1)
      if (!removed) return { ...eff, skipped: true, summary: `物品不足：${eff.item}` }
      return { ...eff, summary: `消耗 ${getItem(eff.item)?.name ?? eff.item} ×${eff.qty ?? 1}` }
    }

    case 'flag':
      ctx.worldFlags[eff.key] = eff.value
      return { ...eff, summary: `标记 ${eff.key} = ${eff.value}` }

    case 'faction':
      ctx.factions[eff.faction] = clamp((ctx.factions[eff.faction] ?? 0) + eff.value, -100, 100)
      return { ...eff, summary: `${eff.faction} 声望 ${eff.value >= 0 ? '+' : ''}${eff.value}` }

    case 'favor':
      ctx.relationships[eff.npc] = clamp((ctx.relationships[eff.npc] ?? 0) + eff.value, -100, 100)
      return { ...eff, summary: `${eff.npc} 好感 ${eff.value >= 0 ? '+' : ''}${eff.value}` }

    case 'battle':
      // Battle triggering is a scene concern: flagged for the caller.
      return { ...eff, summary: `触发战斗 ${eff.enemy ?? eff.boss}` }

    case 'move':
      ctx.world.location = eff.map
      ctx.player.position = null // scene places at spawn
      return { ...eff, summary: `传送至 ${eff.map}` }

    case 'dialog':
      return { ...eff, summary: '播放对话' }

    case 'unlockMap':
      if (!ctx.world.unlockedLocations.includes(eff.map)) ctx.world.unlockedLocations.push(eff.map)
      return { ...eff, summary: `解锁 ${eff.map}` }

    case 'unlockSkill':
      if (!p.skills.some((s) => s.id === eff.skill)) p.skills.push({ id: eff.skill, level: 1, cd: 0 })
      return { ...eff, summary: `学会技能 ${eff.skill}` }

    case 'unlockGongfa':
      p.gongfa = { id: eff.gongfa, level: 1, tier: 1 }
      return { ...eff, summary: `习得功法 ${eff.gongfa}` }

    case 'unlockCodex':
      if (!p.codex[eff.category]?.includes(eff.id)) p.codex[eff.category].push(eff.id)
      return { ...eff, summary: `图鉴解锁 ${eff.id}` }

    case 'quest':
      setQuestState(ctx.quests, eff.quest, eff.state)
      return { ...eff, summary: `任务 ${eff.quest} → ${eff.state}` }

    case 'time':
      // Scene-level: flagged for the caller (TimeSystem owns the clock).
      return { ...eff, summary: `时间 +${eff.hours} 时辰` }

    case 'hp':
      p.hp = clamp(p.hp + eff.value, 0, p.maxHp)
      return { ...eff, summary: `生命 ${eff.value >= 0 ? '+' : ''}${eff.value}` }

    case 'mp':
      p.mp = clamp(p.mp + eff.value, 0, p.maxMp)
      return { ...eff, summary: `灵力 ${eff.value >= 0 ? '+' : ''}${eff.value}` }

    case 'mind':
      p.mind = clamp(p.mind + eff.value, 0, 100)
      return { ...eff, summary: `心境 ${eff.value >= 0 ? '+' : ''}${eff.value}` }

    case 'companion':
      if (eff.action === 'join') {
        if (!ctx.companions.some((c) => c.npc === eff.npc)) ctx.companions.push({ npc: eff.npc, inParty: true })
      } else {
        ctx.companions = ctx.companions.filter((c) => c.npc !== eff.npc)
      }
      return { ...eff, summary: `同伴 ${eff.npc} ${eff.action}` }

    case 'lover':
      ctx.lover = eff.npc
      return { ...eff, summary: `道侣 ${eff.npc}` }

    case 'ending':
      if (!p.codex.endings.includes(eff.ending)) p.codex.endings.push(eff.ending)
      ctx.worldFlags['flag-ending-reached'] = eff.ending
      return { ...eff, summary: `抵达结局：${eff.ending}` }

    case 'randomItem': {
      const pool = (eff.pool ?? []).filter((id) => getItem(id))
      if (!pool.length) return { ...eff, skipped: true, summary: '随机物品池为空' }
      const pick = pool[Math.floor(Math.random() * pool.length)]
      addItem(ctx.inventory, pick, eff.qty ?? 1)
      return { ...eff, summary: `随机获得 ${getItem(pick)?.name ?? pick}` }
    }

    case 'homestead':
      // Homestead panel lands in M5; keep the state slot honest.
      ctx.homestead = ctx.homestead ?? {}
      ctx.homestead[eff.field] = eff.value
      return { ...eff, summary: `洞府 ${eff.field} = ${eff.value}` }

    case 'shop':
      return { ...eff, summary: `打开商店 ${eff.shopId}` }

    case 'weather':
      ctx.world.weather = eff.weather
      return { ...eff, summary: `天气 → ${eff.weather}` }

    case 'season':
      ctx.world.season = eff.season
      return { ...eff, summary: `季节 → ${eff.season}` }

    default:
      throw new Error(`effect type "${eff.type}" not in whitelist (doc/11 §3.2)`)
  }
}

function addItem(inventory, itemId, qty) {
  const def = getItem(itemId)
  const stackable = def?.stackable ?? false
  if (stackable) {
    const slot = inventory.items.find((s) => s.id === itemId)
    if (slot) slot.qty = Math.min(99, slot.qty + qty)
    else inventory.items.push({ id: itemId, qty: Math.min(99, qty) })
  } else {
    for (let i = 0; i < qty; i += 1) inventory.items.push({ id: itemId, qty: 1 })
  }
}

function removeItem(inventory, itemId, qty) {
  const slot = inventory.items.find((s) => s.id === itemId)
  if (!slot || slot.qty < qty) return false
  slot.qty -= qty
  if (slot.qty <= 0) inventory.items = inventory.items.filter((s) => s !== slot)
  return true
}

function setQuestState(quests, questId, state) {
  quests.states[questId] = state
  if (state === 'active' && !quests.active.some((q) => q.id === questId)) {
    const def = getById(questId)
    quests.active.push({ id: questId, step: 0, startedDay: 0 })
    if (def?.type === 'sq' || def?.type === 'mq') quests.states[questId] = state
  }
  if (state !== 'active') quests.active = quests.active.filter((q) => q.id !== questId)
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}
