// Config-table registry (doc/13 §5): single init, Map indexes, the only
// module that holds table state. Tables are INJECTED by initRegistry():
//   - Browser: src/core/loadTables.js imports the JSONs via Vite and BootScene
//     calls init() (doc/12 §5.2 boot flow).
//   - Node (build gate, runtime/tools): callers read the files themselves and
//     pass plain objects — keeps this module free of import-attribute issues.
import { logger } from './logger.js'

let indexes = null

export function initRegistry(tables) {
  indexes = {}
  for (const [name, list] of Object.entries(tables)) {
    // Config objects (homestead) are not entry lists — keep them out of the
    // id indexes; Homestead.vue reads them through their own module import.
    if (!Array.isArray(list)) continue
    indexes[name] = new Map(list.map((e) => [e.id, e]))
  }
  logger.debug('registry', `indexed ${Object.keys(indexes).length} tables`)
}

export function isReady() {
  return !!indexes
}

function table(name) {
  if (!indexes) throw new Error('registry not initialized — call initRegistry() at boot (doc/13 §5)')
  return indexes[name] ?? new Map()
}

// Typed getters
export const getEnemy = (id) => table('enemies').get(id) ?? null
export const getSkill = (id) => table('skills').get(id) ?? null
export const getItem = (id) => table('items').get(id) ?? null
export const getGongfa = (id) => table('gongfa').get(id) ?? null
export const getNpc = (id) => table('npcs').get(id) ?? null
export const getDialogue = (id) => table('dialogues').get(id) ?? null
export const getQuest = (id) => table('quests').get(id) ?? null
export const getEvent = (id) => table('events').get(id) ?? null
export const getEncounter = (id) => table('encounters').get(id) ?? null
export const getAffix = (id) => table('affixes').get(id) ?? null
export const getEnding = (id) => table('endings').get(id) ?? null

/** Roll an affix for a map enemy (doc/15 §2.6): chance-based, may be null. */
export function rollAffix(rng = Math.random) {
  if (rng() > 0.25) return null
  const all = [...table('affixes').values()]
  if (!all.length) return null
  return all[Math.floor(rng() * all.length)]
}

/** All entries of a table (for map/NPC placement and panels). */
export function listTable(name) {
  return [...(table(name).values())]
}

/** Generic lookup by id, for validation and tools. */
export function getById(id) {
  if (typeof id !== 'string' || !indexes) return null
  for (const map of Object.values(indexes)) {
    if (map.has(id)) return map.get(id)
  }
  return null
}

export function skillsById(ids) {
  const out = {}
  for (const id of ids ?? []) {
    const skill = table('skills').get(id)
    if (skill) out[id] = skill
  }
  return out
}

/** Roll an encounter group: weighted pick, returns enemy definition ids. */
export function rollEncounter(encounterId, rng = Math.random) {
  const def = table('encounters').get(encounterId)
  if (!def) return []
  const total = def.groups.reduce((sum, g) => sum + g.weight, 0)
  let roll = rng() * total
  for (const group of def.groups) {
    roll -= group.weight
    if (roll <= 0) return [...group.enemies]
  }
  return [...def.groups[def.groups.length - 1].enemies]
}
