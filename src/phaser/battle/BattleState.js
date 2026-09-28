// In-battle mutable state (doc/15 §2.4): combatants, rounds, cooldowns,
// per-turn flags and win/lose detection. Pure module — no Phaser/Vue.
import { computeDamage, AOE_DECAY, fleeChance, COEF } from './DamageCalc.js'

const BASIC_ATTACK = { id: 'basic-attack', name: '普攻', power: 1.0, element: 'none', type: 'damage', mpCost: 0, cooldown: 0 }

export class BattleState {
  /** allies/enemies: combatant descriptors from registry/save payload. */
  constructor({ allies, enemies, skillsById, skillLevels = {}, rng = Math.random }) {
    this.rng = rng
    this.skillsById = skillsById
    this.skillLevels = skillLevels
    this.round = 0
    this.result = null
    this.log = []
    this.combatants = [
      ...allies.map((a) => ({ side: 'ally', defending: false, ...clone(a) })),
      ...enemies.map((e) => ({ side: 'enemy', defending: false, ...clone(e) })),
    ]
    this.cooldowns = new Map() // `${actorId}:${skillId}` -> remaining rounds
  }

  byId(id) {
    return this.combatants.find((c) => c.id === id)
  }

  alive(side) {
    return this.combatants.filter((c) => c.side === side && c.hp > 0)
  }

  /** Start-of-turn upkeep: clear defense stance, tick cooldowns. */
  beginTurn(actorId) {
    const actor = this.byId(actorId)
    if (!actor) return
    actor.defending = false
    for (const [key, left] of this.cooldowns) {
      if (key.startsWith(`${actorId}:`) && left > 0) this.cooldowns.set(key, left - 1)
    }
  }

  skillReady(actorId, skill) {
    return (this.cooldowns.get(`${actorId}:${skill.id}`) ?? 0) <= 0
  }

  startCooldown(actorId, skill) {
    if (skill.cooldown > 0) this.cooldowns.set(`${actorId}:${skill.id}`, skill.cooldown + 1)
  }

  /** Resolve one command; returns animation events for the scene to play. */
  applyCommand(actorId, command, { targetId = null, skillId = null } = {}) {
    const actor = this.byId(actorId)
    if (!actor || actor.hp <= 0 || this.result) return []
    const events = []

    if (command === 'defend') {
      actor.defending = true
      actor.mp = Math.min(actor.maxMp, actor.mp + COEF.DEFEND_MP)
      events.push({ type: 'defend', actorId })
      this.log.push(`${actor.name} 蓄势防御。`)
    } else if (command === 'flee') {
      const fastestEnemy = Math.max(...this.alive('enemy').map((e) => e.spd), 0)
      if (this.alive('enemy').some((e) => e.ai === 'boss')) {
        events.push({ type: 'flee-fail', actorId })
        this.log.push('妖气锁住了退路，无法逃离！')
      } else if (this.rng() < fleeChance(actor.spd, fastestEnemy)) {
        this.result = 'flee'
        events.push({ type: 'flee', actorId })
        this.log.push('成功脱离了战斗。')
      } else {
        events.push({ type: 'flee-fail', actorId })
        this.log.push('没能逃掉！')
      }
    } else if (command === 'attack' || command === 'skill') {
      const baseSkill = command === 'attack'
        ? BASIC_ATTACK
        : this.skillsById[skillId]
      if (!baseSkill) return events
      // Level scaling (doc/16 §6.5 example: level N power = base × (1 + 0.08×(N−1))).
      const level = command === 'skill' ? (this.skillLevels[skillId] ?? 1) : 1
      const skill = { ...baseSkill, power: (baseSkill.power ?? 1.0) * (1 + 0.08 * (level - 1)) }
      if (command === 'skill') {
        if ((actor.mp ?? 0) < (skill.mpCost ?? 0)) {
          events.push({ type: 'no-mp', actorId })
          this.log.push('灵力不足！')
          return events
        }
        if (!this.skillReady(actorId, skill)) {
          events.push({ type: 'on-cd', actorId })
          return events
        }
      }

      const targets = this.resolveTargets(actor, skill, targetId)
      if (targets.length === 0) return events

      if (command === 'skill') {
        actor.mp -= skill.mpCost ?? 0
      }

      if (skill.type === 'heal') {
        for (const target of targets) {
          const amount = Math.round(actor.atk * skill.power)
          target.hp = Math.min(target.maxHp, target.hp + amount)
          events.push({ type: 'heal', actorId, targetId: target.id, amount })
          this.log.push(`${target.name} 恢复了 ${amount} 点生命。`)
        }
      } else {
        targets.forEach((target, rank) => {
          const decay = targets.length > 1 ? AOE_DECAY[Math.min(rank, AOE_DECAY.length - 1)] : 1.0
          const result = computeDamage({
            attacker: actor,
            skill: { ...skill, power: skill.power * decay },
            defender: target,
            rng: this.rng,
          })
          if (result.missed) {
            events.push({ type: 'miss', actorId, targetId: target.id })
            this.log.push(`${actor.name} 的攻击落空了。`)
            return
          }
          target.hp = Math.max(0, target.hp - result.damage)
          events.push({
            type: 'damage',
            actorId,
            targetId: target.id,
            amount: result.damage,
            crit: result.crit,
            element: skill.element,
          })
          this.log.push(
            `${actor.name} 对 ${target.name} 造成 ${result.damage} 点伤害${result.crit ? '（会心一击！）' : ''}`,
          )
          if (target.hp <= 0) this.log.push(`${target.name} 化作点点灵光消散了。`)
        })
      }

      if (command === 'skill') this.startCooldown(actorId, skill)
    }

    this.checkEnd()
    return events
  }

  /** target: self / single / all-enemy / all-ally (doc/11 §5.3). */
  resolveTargets(actor, skill, targetId) {
    if (skill.target === 'self') return [actor]
    if (skill.target === 'all-enemy') {
      // AoE ranks targets by current HP desc (doc/16 §6.4)
      return [...this.alive(actor.side === 'ally' ? 'enemy' : 'ally')].sort((a, b) => b.hp - a.hp)
    }
    if (skill.target === 'all-ally') return [...this.alive(actor.side)]
    const target = this.byId(targetId)
    if (!target || target.hp <= 0) {
      const living = this.alive(actor.side === 'ally' ? 'enemy' : 'ally')
      return living.length ? [living[0]] : []
    }
    return [target]
  }

  checkEnd() {
    if (this.result) return this.result
    if (this.alive('enemy').length === 0) this.result = 'win'
    else if (this.alive('ally').length === 0) this.result = 'lose'
    return this.result
  }
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}
