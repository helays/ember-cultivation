// Minimal config-table registry (M3 scope). The full version (BootScene bulk
// load + cross-table validation) lands in M4 per doc/15 §2.5; the public
// surface below is designed to stay stable so callers don't churn.
import enemiesJson from '@/data/enemies.json'
import skillsJson from '@/data/skills.json'
import encountersJson from '@/data/encounters.json'

const enemies = new Map(enemiesJson.map((e) => [e.id, e]))
const skills = new Map(skillsJson.map((s) => [s.id, s]))
const encounters = new Map(encountersJson.map((e) => [e.id, e]))

export function getEnemy(id) {
  return enemies.get(id) ?? null
}

export function getSkill(id) {
  return skills.get(id) ?? null
}

export function skillsById(ids) {
  const out = {}
  for (const id of ids) {
    const skill = skills.get(id)
    if (skill) out[id] = skill
  }
  return out
}

export function getEncounter(id) {
  return encounters.get(id) ?? null
}

/** Roll an encounter group: weighted pick, returns enemy definition ids. */
export function rollEncounter(encounterId, rng = Math.random) {
  const table = encounters.get(encounterId)
  if (!table) return []
  const total = table.groups.reduce((sum, g) => sum + g.weight, 0)
  let roll = rng() * total
  for (const group of table.groups) {
    roll -= group.weight
    if (roll <= 0) return [...group.enemies]
  }
  return [...table.groups[table.groups.length - 1].enemies]
}
