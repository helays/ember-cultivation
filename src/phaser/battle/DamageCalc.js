// Damage pipeline, the ONLY implementation of the doc/16 §6.1 formula
// (which is verbatim doc/02 §3.4). Pure module: no Phaser, no Vue —
// runtime/tools/sim-battle.js imports it directly in Node.
//
// 基础伤害 = (攻击 × 技能倍率 − 防御 × 减伤系数)
// 最终伤害 = 基础伤害 × 元素克制 × 随机浮动 × 暴击倍率
// 最低伤害 = 攻击 × 0.1（保底）

export const COEF = {
  DEF: 0.85,          // COEF_DEF_COEF (doc/16 §6.1)
  FLOAT_MIN: 0.90,
  FLOAT_MAX: 1.10,
  FLOOR: 0.10,        // 最低伤害保底
  CRIT_RATE_BASE: 0.05,
  CRIT_RATE_CAP: 0.60,
  CRIT_MUL_BASE: 1.50,
  HIT_BASE: 0.95,
  HIT_PER_SHENSHI: 0.005,
  HIT_MIN: 0.70,
  HIT_MAX: 0.99,
  DEFEND_MUL: 0.5,    // 防御指令受伤减半 (doc/02 §3.3)
  DEFEND_MP: 5,
}

// 五行克制矩阵 (doc/09 §5.1): attacker element -> target element -> multiplier
const ELEMENT_MATRIX = {
  metal: { metal: 1.0, wood: 1.3, water: 1.0, fire: 1.0, earth: 1.0 },
  wood: { metal: 1.0, wood: 1.0, water: 1.0, fire: 1.0, earth: 1.3 },
  water: { metal: 1.0, wood: 1.0, water: 1.0, fire: 1.3, earth: 0.8 },
  fire: { metal: 1.3, wood: 1.0, water: 0.8, fire: 1.0, earth: 1.0 },
  earth: { metal: 1.0, wood: 0.8, water: 1.3, fire: 1.0, earth: 1.0 },
}

// doc/01 §5.2 spiritual roots are Chinese; map to matrix keys.
const ROOT_TO_ELEMENT = { '金': 'metal', '木': 'wood', '水': 'water', '火': 'fire', '土': 'earth' }

/** Effective element of a target for matrix lookup; null = no matrix participation. */
export function targetElement(target) {
  if (target.element) return target.element
  if (Array.isArray(target.spiritualRoot) && target.spiritualRoot.length === 1) {
    return ROOT_TO_ELEMENT[target.spiritualRoot[0]] ?? null
  }
  return null
}

/** Element multiplier: weakness/resist lists win first, matrix second (doc/16 §6.5 example). */
export function elementMultiplier(skillElement, target) {
  if (!skillElement || skillElement === 'none' || skillElement === 'dark' || skillElement === 'thunder') return 1.0
  if (Array.isArray(target.weakness) && target.weakness.includes(skillElement)) return 1.3
  if (Array.isArray(target.resist) && target.resist.includes(skillElement)) return 0.8
  const tEl = targetElement(target)
  if (!tEl) return 1.0
  return ELEMENT_MATRIX[skillElement]?.[tEl] ?? 1.0
}

/** Hit rate (doc/16 §6.3), clamped to 70%~99%. */
export function hitRate(attacker, defender) {
  const shenshi = attacker.shenshi ?? 0
  const rate = COEF.HIT_BASE + (shenshi - defender.spd) * COEF.HIT_PER_SHENSHI
  return Math.min(COEF.HIT_MAX, Math.max(COEF.HIT_MIN, rate))
}

export function critRate(attacker) {
  return Math.min(COEF.CRIT_RATE_CAP, COEF.CRIT_RATE_BASE + (attacker.critRateBonus ?? 0))
}

/**
 * One full damage roll.
 * rng: () => number in [0,1); injectable for deterministic simulation.
 */
export function computeDamage({ attacker, skill, defender, rng = Math.random }) {
  const power = skill.power ?? 1.0
  const missed = rng() > hitRate(attacker, defender)
  if (missed) {
    // Miss deals nothing and does not start cooldowns (doc/16 §6.3).
    return { missed: true, damage: 0, crit: false, elementMul: 1.0 }
  }

  const base = attacker.atk * power - (defender.def ?? 0) * COEF.DEF
  const mul = elementMultiplier(skill.element, defender)
  const float = COEF.FLOAT_MIN + rng() * (COEF.FLOAT_MAX - COEF.FLOAT_MIN)
  const crit = rng() < critRate(attacker)
  const critMul = COEF.CRIT_MUL_BASE + (attacker.critMulBonus ?? 0)

  let final = Math.max(base, 0) * mul * float * (crit ? critMul : 1.0)
  if (defender.defending) final *= COEF.DEFEND_MUL

  // Codex completion bonus vs yaoguai-kind targets (doc/02 §9.1: +5%/+10%).
  const YAO_KINDS = ['zombie', 'ghost', 'yao', 'beast']
  if (attacker.codexBonus && YAO_KINDS.includes(defender.kind)) {
    final *= 1 + attacker.codexBonus
  }
  const floor = attacker.atk * COEF.FLOOR
  const damage = Math.max(Math.round(final), Math.max(1, Math.round(floor)))
  return { missed: false, damage, crit, elementMul: mul }
}

/** AoE decay per target rank, targets pre-sorted by current HP desc (doc/16 §6.4). */
export const AOE_DECAY = [1.0, 0.8, 0.6, 0.45, 0.4]

/** Flee chance from speed difference (doc/02 §3.3 "基于速度差"). */
export function fleeChance(allySpd, fastestEnemySpd) {
  return Math.min(0.9, Math.max(0.25, 0.5 + (allySpd - fastestEnemySpd) * 0.05))
}
