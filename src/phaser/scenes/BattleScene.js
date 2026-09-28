import Phaser from 'phaser'
import { bus, EVT } from '@/core/bus.js'
import { logger } from '@/core/logger.js'
import { BattleState } from '../battle/BattleState.js'
import { turnOrder } from '../battle/TurnManager.js'
import { chooseAction } from '../battle/EnemyAI.js'
import { rollEncounter, getEnemy, getAffix, rollAffix, skillsById } from '@/core/registry.js'
import playerSheetUrl from '@/assets/sprites/player/sprite-player-walk-4dir.png?url'
import sfxSlashUrl from '@/assets/audio/sfx/sfx-attack-slash.ogg?url'
import sfxHitUrl from '@/assets/audio/sfx/sfx-attack-hit.ogg?url'
import sfxCritUrl from '@/assets/audio/sfx/sfx-crit.ogg?url'
import sfxEnemyDieUrl from '@/assets/audio/sfx/sfx-enemy-die.ogg?url'
import sfxPlayerHurtUrl from '@/assets/audio/sfx/sfx-player-hurt.ogg?url'

const ENEMY_SLOTS = [
  { x: 480, y: 120 },
  { x: 545, y: 185 },
  { x: 440, y: 230 },
  { x: 545, y: 90 },
  { x: 415, y: 165 },
]
const PLAYER_SLOT = { x: 150, y: 290 }
const ENEMY_DELAY_MS = 550
const BETWEEN_ACTORS_MS = 220

// Turn-based battle (doc/02 §3): the scene owns presentation and sequencing;
// rules live in the pure battle/ modules and state flows to Vue only via bus.
export class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene')
  }

  init(data) {
    this.battleInput = data
    this.awaiting = null
  }

  preload() {
    this.load.spritesheet('player-walk', playerSheetUrl, { frameWidth: 32, frameHeight: 48 })
    this.load.audio('sfx-attack-slash', sfxSlashUrl)
    this.load.audio('sfx-attack-hit', sfxHitUrl)
    this.load.audio('sfx-crit', sfxCritUrl)
    this.load.audio('sfx-enemy-die', sfxEnemyDieUrl)
    this.load.audio('sfx-player-hurt', sfxPlayerHurtUrl)
  }

  create() {
    this.cameras.main.setBackgroundColor('rgba(13,31,39,0.94)')
    this.add.text(16, 12, '—— 妖气弥漫 ——', {
      fontFamily: 'var(--font-ui)', fontSize: '12px', color: '#8f2b2b', resolution: 1,
    })
    this.displays = new Map()

    const { allies, enemyIds } = this.battleInput
    // NG+ scaling (doc/12 §8.1): each cycle multiplies enemy stats.
    const ngMul = 1 + (this.battleInput.newGamePlus ?? 0) * 0.6
    const enemyDefs = enemyIds.map((id, i) => {
      const def = getEnemy(id)
      if (!def) throw new Error(`unknown enemy: ${id}`)
      // `defRef` (NOT `def`) — `def` is the numeric defense stat from stats.
      // Stats tables carry current values only; maxHp/maxMp are derived.
      const affix = rollAffix()
      const scaled = { ...def.stats }
      for (const [stat, mul] of Object.entries(affix?.stats ?? {})) {
        scaled[stat] = Math.round((scaled[stat] ?? 0) * mul * ngMul)
      }
      if (!affix) {
        for (const key of Object.keys(scaled)) {
          if (['hp', 'atk', 'def', 'spd'].includes(key)) scaled[key] = Math.round(scaled[key] * ngMul)
        }
      }
      scaled.hp = Math.max(1, scaled.hp)
      return {
        id: `${id}#${i}`,
        baseId: id,
        kind: def.kind,
        name: affix ? `${affix.name}·${def.name}` : def.name,
        ...scaled,
        maxHp: scaled.hp,
        maxMp: scaled.mp,
        ai: def.ai,
        weakness: def.weakness,
        resist: def.resist,
        skills: def.skills,
        defRef: def,
      }
    })
    this.enemyDefs = enemyDefs

    const knownSkills = skillsById([
      ...allies.flatMap((a) => a.skills ?? []),
      ...enemyDefs.flatMap((e) => e.skills ?? []),
    ])
    this.state = new BattleState({
      allies,
      enemies: enemyDefs,
      skillsById: knownSkills,
      skillLevels: allies[0]?.skillLevels ?? {},
    })

    this.renderCombatants()
    bus.on(EVT.BATTLE_COMMAND, this.onCommand)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup())
    // Generation token: a scene stop/restart must kill any stale runBattle
    // loop, otherwise it keeps awaiting a dead clock or emits a second
    // battle:end that corrupts the next battle.
    this.runId = (this.runId ?? 0) + 1
    this.runBattle(this.runId)
  }

  alive(runId) {
    return runId === this.runId
  }

  renderCombatants() {
    const state = this.state
    for (const c of state.combatants) {
      const slot = c.side === 'ally' ? PLAYER_SLOT : ENEMY_SLOTS[state.combatants.filter((x) => x.side === 'enemy' && x.hp > 0).indexOf(c) % ENEMY_SLOTS.length]
      if (c.side === 'ally') {
        const sprite = this.add.sprite(slot.x, slot.y, 'player-walk', 8).setScale(2).setOrigin(0.5, 1)
        this.displays.set(c.id, { go: sprite, kind: 'sprite' })
      } else {
        // No enemy art yet: visible placeholder block (doc/14 §4.4 convention)
        const rect = this.add.rectangle(slot.x, slot.y, 44, 44, 0x1d3b45)
          .setStrokeStyle(2, 0x8f2b2b)
          .setOrigin(0.5, 1)
        this.displays.set(c.id, { go: rect, kind: 'rect' })
      }
      const name = this.add.text(slot.x - 40, slot.y - 108, c.name, {
        fontFamily: 'var(--font-ui)', fontSize: '12px', color: '#e8e6dc', resolution: 1,
      })
      const barBg = this.add.rectangle(slot.x - 40, slot.y - 92, 80, 5, 0x0d1f27).setOrigin(0)
      const bar = this.add.rectangle(slot.x - 40, slot.y - 92, 80, 5, 0x8f2b2b).setOrigin(0)
      this.displays.get(c.id).name = name
      this.displays.get(c.id).bar = bar
      this.displays.get(c.id).barWidth = 80
      this.refreshBars(c)
    }
  }

  refreshBars(c) {
    const d = this.displays.get(c.id)
    d.bar.width = Math.max(0, (c.hp / c.maxHp) * d.barWidth)
    d.name.setColor(c.hp > 0 ? '#e8e6dc' : '#6b7570')
  }

  unitsSnapshot() {
    return this.state.combatants.map((c) => ({
      id: c.id,
      name: c.name,
      side: c.side,
      hp: c.hp,
      maxHp: c.maxHp,
      mp: c.mp,
      maxMp: c.maxMp,
    }))
  }

  emitTurn(active) {
    bus.emit(EVT.BATTLE_TURN, {
      order: this.state.combatants.filter((c) => c.hp > 0).map((c) => c.id),
      log: [...this.state.log],
      active,
      round: this.state.round,
      units: this.unitsSnapshot(),
    })
  }

  async runBattle(runId) {
    const stale = () => !this.alive(runId)
    await this.delay(400)
    if (stale()) return
    while (!this.state.result) {
      this.state.round += 1
      const order = turnOrder(this.state.combatants).map((c) => c.id)
      for (const actorId of order) {
        if (this.state.result) break
        const actor = this.state.byId(actorId)
        if (!actor || actor.hp <= 0) continue
        this.state.beginTurn(actorId)
        this.emitTurn(actorId)

        let command
        if (actor.side === 'ally') {
          command = await this.waitCommand(actor)
        } else {
          await this.delay(ENEMY_DELAY_MS)
          if (stale()) return
          command = chooseAction(this.state, actor)
        }
        if (this.state.result) break

        const events = this.state.applyCommand(actorId, command.command, command)
        await this.playEvents(events)
        if (stale()) return
        this.emitTurn(null)
        await this.delay(BETWEEN_ACTORS_MS)
        if (stale()) return
      }
    }
    if (stale()) return
    this.finish()
  }

  waitCommand(actor) {
    return new Promise((resolve) => {
      this.awaiting = { actorId: actor.id, resolve }
    })
  }

  onCommand = (payload) => {
    if (this.awaiting && payload.actorId === this.awaiting.actorId) {
      const resolve = this.awaiting.resolve
      this.awaiting = null
      resolve(payload)
    }
  }

  /** Presentation pass over one command's events (doc/14 §7.3 simplified battle). */
  async playEvents(events) {
    for (const ev of events) {
      const actorD = this.displays.get(ev.actorId)
      if (ev.type === 'damage' || ev.type === 'heal' || ev.type === 'miss') {
        const target = this.state.byId(ev.targetId)
        const targetD = this.displays.get(ev.targetId)
        // Lunge: forward 36px, 120ms out / 160ms back.
        if (actorD && ev.type !== 'miss') {
          const dir = targetD.go.x >= actorD.go.x ? 1 : -1
          await this.tweenBy(actorD.go, { x: dir * 36 }, 120)
          this.tweenBy(actorD.go, { x: -dir * 36 }, 160)
        }
        if (ev.type === 'miss') {
          this.floatText(targetD.go.x, targetD.go.y - 60, '闪避', '#6b7570', 12)
          await this.delay(320)
        } else if (ev.type === 'heal') {
          this.floatText(targetD.go.x, targetD.go.y - 60, `+${ev.amount}`, '#4fd1c5', 12)
        } else {
          this.sound.play(ev.crit ? 'sfx-crit' : 'sfx-attack-hit')
          this.floatText(
            targetD.go.x, targetD.go.y - 60,
            String(ev.amount),
            ev.crit ? '#e0c070' : '#e8e6dc',
            ev.crit ? 16 : 12,
          )
          this.flash(targetD)
          if (ev.crit) this.cameras.main.shake(120, 0.004)
          if (target.side === 'ally') this.sound.play('sfx-player-hurt')
          if (target.hp <= 0) {
            this.sound.play('sfx-enemy-die')
            this.tintDead(targetD)
          }
        }
        this.refreshBars(target)
        await this.delay(420)
      } else if (ev.type === 'defend') {
        this.floatText(actorD.go.x, actorD.go.y - 60, '防御', '#4fd1c5', 12)
        await this.delay(300)
      } else if (ev.type === 'flee' || ev.type === 'flee-fail') {
        this.floatText(actorD.go.x, actorD.go.y - 60, ev.type === 'flee' ? '脱身！' : '未能脱身', '#e0c070', 12)
        await this.delay(320)
      }
    }
  }

  tweenBy(go, offset, duration) {
    return new Promise((resolve) => {
      this.tweens.add({
        targets: go,
        ...Object.fromEntries(Object.entries(offset).map(([k, v]) => [k, go[k] + v])),
        duration,
        ease: 'Cubic.easeOut',
        onComplete: resolve,
      })
    })
  }

  flash(display) {
    const go = display.go
    if (typeof go.setTintFill === 'function') {
      go.setTintFill(0xe8e6dc)
      this.time.delayedCall(80, () => go.clearTint())
    } else {
      // Rectangle placeholder blocks have no tint; swap the fill color briefly.
      const prev = go.fillColor
      go.setFillStyle(0xe8e6dc)
      this.time.delayedCall(80, () => go.setFillStyle(prev))
    }
  }

  tintDead(display) {
    if (typeof display.go.setTint === 'function') {
      display.go.setTint(0x38565c)
    } else {
      display.go.setFillStyle(0x38565c)
    }
    display.go.setAlpha(0.55)
  }

  floatText(x, y, text, color, size) {
    const label = this.add.text(x, y, text, {
      fontFamily: 'var(--font-ui)', fontSize: `${size}px`, color, resolution: 1,
    }).setOrigin(0.5).setDepth(20)
    this.tweens.add({
      targets: label,
      y: y - 24,
      alpha: 0,
      duration: 640,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    })
  }

  buildRewards() {
    const rewards = { exp: 0, stones: 0, items: [], kills: [] }
    for (const enemy of this.state.combatants.filter((c) => c.side === 'enemy')) {
      const def = enemy.defRef ?? getEnemy(enemy.baseId)
      if (!def) continue
      rewards.exp += def.expReward ?? 0
      const [lo, hi] = def.stoneReward ?? [0, 0]
      rewards.stones += lo + Math.floor(Math.random() * (hi - lo + 1))
      rewards.kills.push(enemy.baseId)
      for (const drop of def.drops ?? []) {
        if (Math.random() < drop.chance) {
          const [qLo, qHi] = drop.qty ?? [1, 1]
          const qty = qLo + Math.floor(Math.random() * (qHi - qLo + 1))
          rewards.items.push({ item: drop.item, qty })
        }
      }
    }
    return rewards
  }

  finish() {
    const result = this.state.result
    const payload = {
      result,
      rewards: result === 'win' ? this.buildRewards() : { exp: 0, stones: 0, items: [], kills: [] },
      // Post-battle hp/mp for store sync.
      allies: this.state.combatants.filter((c) => c.side === 'ally').map((c) => ({ id: c.id, hp: c.hp, mp: c.mp })),
    }
    logger.info('BattleScene', `battle ended: ${result}`)
    bus.emit(EVT.BATTLE_END, payload)
  }

  delay(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve))
  }

  cleanup() {
    bus.off(EVT.BATTLE_COMMAND, this.onCommand)
    if (this.awaiting) this.awaiting.resolve({ command: 'defend' })
  }
}
