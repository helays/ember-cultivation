import { defineStore } from 'pinia'
import { getItem } from '@/core/registry.js'
import { useInventoryStore } from './inventoryStore.js'

// Realm ladder per doc/01 §5: index 0-10, each realm has 4 stages.
export const REALM_NAMES = ['凡人', '炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫', '仙人']
export const STAGE_NAMES = ['初期', '中期', '后期', '圆满']

// Realm exp baselines and stage coefficients (doc/16 §2: 小阶阈值 = 境界基准 ×
// 小阶系数 1.0/1.2/1.5/2.0；基准 凡人100 炼气400 筑基1600 …).
export const REALM_EXP_BASE = [100, 400, 1600, 6000, 24000, 90000, 340000, 1200000, 4500000, 16000000, 16000000]
export const STAGE_COEF = [1.0, 1.2, 1.5, 2.0]

/** Current minor-stage exp threshold (doc/16 §2 基准口径). */
export function expThreshold(realmIndex, stageIndex) {
  const base = REALM_EXP_BASE[realmIndex] ?? 100
  return Math.round(base * (STAGE_COEF[stageIndex - 1] ?? 1.0))
}

/** Breakthrough base rate by realm (doc/16 §5: 85% 炼气 → 32% 化神). */
function breakthroughBase(realmIndex) {
  return Math.max(0.05, 0.85 * Math.pow(0.78, realmIndex))
}

// Character state only; world state (position/time) lives in worldStore.
// Persistence shape follows doc/12 §3.4 (player block minus location/position/time).
export const usePlayerStore = defineStore('player', {
  state: () => ({
    name: '无名',
    realmIndex: 0,
    stageIndex: 1,
    exp: 0,
    stones: 50,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    mind: 70,
    attrs: { attack: 8, defense: 6, speed: 10 },
    wuxing: 5,
    gengu: 5,
    shenshi: 5,
    spiritualRoot: ['火'],
    skills: [],
    gongfa: { id: 'gongfa-kunlun-zhengfa', level: 1, tier: 1 },
    daoPoints: 0,
    codex: { yaoguai: [], fabao: [], gongfa: [], liaozhai: [], endings: [] },
    companions: [],
    lover: null,
    newGamePlus: 0,
    ngPlusInherit: { expMul: 1.0, mindRegenMul: 1.0, dropMul: 1.0, encounterRateMul: 1.0, endingsUnlocked: [] },
    rngSeed: 20240517,
    homestead: { level: 1, spiritDensity: 1.0, fieldSlots: 0, fields: [], facilities: { alchemy: 0, crafting: 0, talisman: 0, storage: 0 } },
  }),
  getters: {
    realm: (state) => REALM_NAMES[state.realmIndex] ?? REALM_NAMES[0],
    stage: (state) => STAGE_NAMES[state.stageIndex - 1] ?? STAGE_NAMES[0],
    threshold: (state) => expThreshold(state.realmIndex, state.stageIndex),
    expFull: (state) => state.exp >= expThreshold(state.realmIndex, state.stageIndex),
    // Equipment bonus folded into effective combat attrs.
    attackWithGear() {
      const inv = useInventoryStore()
      return this.attrs.attack + gearBonus(inv, 'attack')
    },
    defenseWithGear() {
      const inv = useInventoryStore()
      return this.attrs.defense + gearBonus(inv, 'defense')
    },
  },
  actions: {
    toSave() {
      return {
        name: this.name,
        realm: this.realm,
        realmIndex: this.realmIndex,
        stage: this.stage,
        stageIndex: this.stageIndex,
        exp: this.exp,
        stones: this.stones,
        hp: this.hp,
        maxHp: this.maxHp,
        mp: this.mp,
        maxMp: this.maxMp,
        mind: this.mind,
        attrs: { ...this.attrs },
        wuxing: this.wuxing,
        gengu: this.gengu,
        shenshi: this.shenshi,
        spiritualRoot: [...this.spiritualRoot],
      }
    },
    fromSave(player) {
      this.name = player.name
      this.realmIndex = player.realmIndex
      this.stageIndex = player.stageIndex
      this.exp = player.exp
      this.stones = player.stones ?? 50
      this.hp = player.hp
      this.maxHp = player.maxHp
      this.mp = player.mp
      this.maxMp = player.maxMp
      this.mind = player.mind
      this.attrs = { ...player.attrs }
      this.wuxing = player.wuxing
      this.gengu = player.gengu
      this.shenshi = player.shenshi
      this.spiritualRoot = [...player.spiritualRoot]
    },
    /** Battle end application (doc/02 §3.6): rewards on win, penalties on lose. */
    applyBattleResult({ result, rewards, allies }) {
      const me = allies?.find((a) => a.id === 'player')
      if (me) {
        this.hp = Math.max(1, me.hp)
        this.mp = me.mp
      }
      if (result === 'win') {
        this.exp += rewards.exp ?? 0
        this.stones += rewards.stones ?? 0
        for (const kill of rewards.kills ?? []) {
          if (!this.codex.yaoguai.includes(kill)) this.codex.yaoguai.push(kill)
        }
      } else if (result === 'lose') {
        this.stones = Math.max(0, Math.floor(this.stones * 0.9))
        this.mind = Math.max(0, this.mind - 5)
        this.hp = this.maxHp
        this.mp = this.maxMp
      }
    },
    /**
     * Meditation (doc/02 §4.2): exp = 阈值 × 1.2% × 功法 × 悟性 × 灵气浓度.
     * Returns a descriptor; the scene advances one shichen and triggers the
     * 心魔 battle when told to.
     */
    meditate({ spiritDensity = 1.0 } = {}) {
      const gongfaBonus = this.gongfa?.id ? 1.2 : 1.0
      const wuxingBonus = 0.8 + (this.wuxing / 10) * 0.4 // 悟性 5 → 1.0
      const base = this.threshold * 0.012
      let gain = Math.round(base * gongfaBonus * wuxingBonus * spiritDensity)
      const roll = Math.random()
      if (roll < 0.06) {
        // 心魔侵扰 (doc/02 §4.2): forced battle, mind pressure
        this.mind = Math.max(0, this.mind - 5)
        this.exp += gain
        return { gain, event: 'inner-demon' }
      }
      if (roll < 0.14) {
        // 顿悟：+50% 收益
        gain = Math.round(gain * 1.5)
        this.exp += gain
        return { gain, event: 'insight' }
      }
      this.exp += gain
      return { gain, event: 'none' }
    },
    /**
     * Breakthrough attempt (doc/02 §4.3, doc/16 §5).
     * Returns { ok, rate, failure?, mindBlast? } — the caller runs the 心魔
     * battle when failure === 'fire-deviation'.
     */
    breakthrough({ pill = false } = {}) {
      if (!this.expFull) return { ok: false, reason: 'exp-not-full' }
      const rate = Math.min(0.95, Math.max(0.05,
        breakthroughBase(this.realmIndex)
        + (this.gengu - 5) * 0.01
        + (this.mind >= 80 ? 0.15 : (this.mind - 30) * 0.002)
        + (pill ? 0.2 : 0),
      ))
      this.exp = 0
      if (Math.random() < rate) {
        this.growOnBreakthrough()
        return { ok: true, rate }
      }
      // Failure tiers 60/25/15 (doc/02 §4.3)
      const roll = Math.random()
      if (roll < 0.6) {
        this.exp = Math.round(this.threshold * 0.9)
        return { ok: false, rate, failure: 'light' }
      }
      if (roll < 0.85) {
        this.exp = Math.round(this.threshold * 0.7)
        this.mind = Math.max(0, this.mind - 10)
        return { ok: false, rate, failure: 'heavy' }
      }
      this.mind = Math.max(0, this.mind - 30)
      return { ok: false, rate, failure: 'fire-deviation' }
    },
    /** Attribute growth: ×1.32/realm with gengu-based float (doc/16 §5). */
    growOnBreakthrough() {
      const float = (Math.random() * 0.16 - 0.08) + ((this.gengu - 10) / 20) * 0.06
      const mul = 1.32 * (1 + float)
      this.attrs.attack = Math.round(this.attrs.attack * mul)
      this.attrs.defense = Math.round(this.attrs.defense * mul)
      this.attrs.speed = Math.round(this.attrs.speed * (1 + (mul - 1) * 0.5))
      this.maxHp = Math.round(this.maxHp * mul)
      this.maxMp = Math.round(this.maxMp * mul)
      this.hp = this.maxHp
      this.mp = this.maxMp
      if (this.stageIndex < 4) this.stageIndex += 1
      else if (this.realmIndex < 10) {
        this.realmIndex += 1
        this.stageIndex = 1
      }
    },
    /** Skill upgrade with dao points (doc/02 §6): cost = upgradeCost[level-1]. */
    upgradeSkill(skillId, upgradeCost, maxLevel = 5) {
      const skill = this.skills.find((s) => s.id === skillId)
      if (!skill) return { ok: false, reason: 'not-learned' }
      if (skill.level >= maxLevel) return { ok: false, reason: 'max-level' }
      const cost = upgradeCost?.[skill.level - 1] ?? 1
      if (this.daoPoints < cost) return { ok: false, reason: 'no-points' }
      this.daoPoints -= cost
      skill.level += 1
      return { ok: true, cost }
    },
    gainExp(amount) {
      this.exp += amount
    },
    /** NG+ reset (doc/12 §8): fresh character, endings + inherit kept,
     *  relationships/factions quartered. */
    applyNgPlus(keptEndings, inherit) {
      const defaults = usePlayerStore._defaults ?? null
      void defaults
      this.realmIndex = 0
      this.stageIndex = 1
      this.exp = 0
      this.stones = Math.floor(this.stones * 0.25) + 50
      this.hp = 100
      this.maxHp = 100
      this.mp = 50
      this.maxMp = 50
      this.attrs = { attack: 8, defense: 6, speed: 10 }
      this.skills = [{ id: 'skill-huo-qiu', level: 1, cd: 0 }]
      this.codex.endings = keptEndings
      this.newGamePlus = (this.newGamePlus ?? 0) + 1
      this.ngPlusInherit = {
        expMul: inherit.expMul ?? 1.0,
        mindRegenMul: inherit.mindRegenMul ?? 1.0,
        dropMul: inherit.dropMul ?? 1.0,
        encounterRateMul: inherit.encounterRateMul ?? 1.0,
        endingsUnlocked: keptEndings,
      }
    },
  },
})

/** Sum equipAttrs of every equipped item (doc/02 §5). */
function gearBonus(inventory, attr) {
  let sum = 0
  for (const id of Object.values(inventory.equipment)) {
    if (!id) continue
    const def = getItem(id)
    sum += def?.equipAttrs?.[attr] ?? 0
  }
  return sum
}
