// Enemy behavior selection (doc/02 §3.5) for the six registered AI kinds.
// Returns a command descriptor the BattleState understands.
import { fleeChance } from './DamageCalc.js'

function strongestDamageSkill(state, actor) {
  const usable = (actor.skills ?? [])
    .map((id) => state.skillsById[id])
    .filter((s) => s && s.type !== 'heal' && (actor.mp ?? 0) >= (s.mpCost ?? 0) && state.skillReady(actor.id, s))
  if (!usable.length) return null
  return usable.sort((a, b) => (b.power ?? 0) - (a.power ?? 0))[0]
}

function healSkill(state, actor) {
  return (actor.skills ?? [])
    .map((id) => state.skillsById[id])
    .find((s) => s && s.type === 'heal' && state.skillReady(actor.id, s))
}

function lowestHpAllyOf(state, side) {
  return [...state.alive(side)].sort((a, b) => a.hp - b.hp)[0]
}

export function chooseAction(state, actor) {
  const foes = state.alive(actor.side === 'enemy' ? 'ally' : 'enemy')
  const friends = state.alive(actor.side)
  if (!foes.length) return { command: 'defend' }
  const weakestFoe = lowestHpAllyOf(state, actor.side === 'enemy' ? 'ally' : 'enemy')

  switch (actor.ai) {
    case 'attacker': {
      // Prioritize the lowest-HP target; burst skill under 30% HP.
      const burst = actor.hp / actor.maxHp < 0.3 ? strongestDamageSkill(state, actor) : null
      if (burst) return { command: 'skill', skillId: burst.id, targetId: weakestFoe.id }
      return { command: 'attack', targetId: weakestFoe.id }
    }
    case 'defender': {
      // Guards for the first two rounds, then counters.
      if (state.round <= 2) return { command: 'defend' }
      const skill = strongestDamageSkill(state, actor)
      if (skill) return { command: 'skill', skillId: skill.id, targetId: weakestFoe.id }
      return { command: 'attack', targetId: weakestFoe.id }
    }
    case 'support': {
      // Heal wounded friends first; flee when singled out and badly hurt.
      if (actor.hp / actor.maxHp < 0.25 && thisCanFlee(state, actor)) {
        return { command: 'flee' }
      }
      const wounded = [...friends].find((f) => f.hp / f.maxHp < 0.6)
      const heal = healSkill(state, actor)
      if (wounded && heal) return { command: 'skill', skillId: heal.id, targetId: wounded.id }
      const skill = strongestDamageSkill(state, actor)
      if (skill && Math.random() < 0.5) return { command: 'skill', skillId: skill.id, targetId: weakestFoe.id }
      return { command: 'attack', targetId: weakestFoe.id }
    }
    case 'random': {
      // Weighted pick, predictable enough for early-game (doc/02 §3.5).
      const roll = Math.random()
      if (roll < 0.55) return { command: 'attack', targetId: weakestFoe.id }
      if (roll < 0.8) {
        const skill = strongestDamageSkill(state, actor)
        if (skill) return { command: 'skill', skillId: skill.id, targetId: weakestFoe.id }
      }
      if (roll < 0.95) return { command: 'defend' }
      return { command: 'attack', targetId: foes[Math.floor(Math.random() * foes.length)].id }
    }
    case 'boss':
      // Multi-phase scripts land with the first real boss (M5); base behavior
      // mirrors attacker with the burst threshold relaxed.
      if (actor.hp / actor.maxHp < 0.5) {
        const burst = strongestDamageSkill(state, actor)
        if (burst) return { command: 'skill', skillId: burst.id, targetId: weakestFoe.id }
      }
      return { command: 'attack', targetId: weakestFoe.id }
    case 'inner-demon':
      // Mirror of the player (doc/02 §3.5); mind-pressure hooks land in M5.
      return { command: 'attack', targetId: weakestFoe.id }
    default:
      return { command: 'attack', targetId: weakestFoe.id }
  }
}

function thisCanFlee(state, actor) {
  const foes = state.alive(actor.side === 'enemy' ? 'ally' : 'enemy')
  const fastest = Math.max(...foes.map((f) => f.spd), 0)
  return fleeChance(actor.spd, fastest) >= 0.5
}
