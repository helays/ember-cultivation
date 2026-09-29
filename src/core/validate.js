// Config-table validation (doc/11 §7, ten checks). Pure Node/browser module.
// Entry points: runtime/tools/validate.js (local) and the Vite build gate
// (vite.config.js, doc/13 §5.3 — production build fails hard on errors).
// Table maps are injected: browser boot passes loadTables.TABLES, Node tools
// read the JSON files themselves (keeps this module import-attribute-free).

export const ID_PREFIXES = [
  'mq-', 'sq-', 'fq-', 'dq-', 'rq-', 'eq-', 'evt-', 'npc-', 'enemy-', 'boss-',
  'item-', 'skill-', 'gongfa-', 'tal-', 'alch-', 'craft-', 'map-', 'fac-',
  'flag-', 'end-', 'cdx-', 'shop-', 'bgm-', 'sfx-', 'enc-', 'dlg-', 'affix-', 'spawn-', 'combo-', 'farm-', 'alch-', 'craft-', 'tal-', 'end-', 'npc-',
]

export const EFFECT_TYPES = [
  'exp', 'stone', 'item', 'consume', 'flag', 'faction', 'favor', 'battle',
  'move', 'dialog', 'unlockMap', 'unlockSkill', 'unlockGongfa', 'unlockCodex',
  'quest', 'time', 'hp', 'mp', 'mind', 'companion', 'lover', 'ending',
  'randomItem', 'homestead', 'shop', 'weather', 'season',
]

export const CONDITION_TYPES = [
  'hasItem', 'notHasItem', 'flag', 'questState', 'realm', 'stage', 'favor',
  'faction', 'timeOfDay', 'season', 'weather', 'map', 'mind', 'codex',
  'companion', 'newGamePlus', 'random',
]

// Enemy stat baselines by realm x tier (doc/16 §7.3). Only rows explicitly
// referenced via `baselineRow` are range-checked, so hand-tuned test enemies
// can opt out while shipped content stays policed.
export const ENEMY_BASELINES = {
  'lianqi-common': { hp: [170, 240], atk: [6, 10], def: [5, 8], spd: [7, 9] },
  'lianqi-elite': { hp: [320, 450], atk: [15, 20], def: [9, 13], spd: [9, 11] },
  'zhuji-common': { hp: [220, 320], atk: [8, 13], def: [7, 11], spd: [9, 12] },
  'zhuji-elite': { hp: [420, 600], atk: [20, 27], def: [12, 18], spd: [11, 14] },
}

function resolves(TABLES, id) {
  if (typeof id !== 'string') return false
  return Object.values(TABLES).some((list) => Array.isArray(list) && list.some((e) => e.id === id))
}

/** Duplicate-key detection: JSON.parse silently keeps the last one. */
export function findDuplicateKeys(text) {
  const duplicates = []
  const stack = []
  let i = 0
  const len = text.length
  const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r'
  while (i < len) {
    const c = text[i]
    if (c === '{') stack.push(new Set())
    else if (c === '}') stack.pop()
    if (c !== '"') { i += 1; continue }
    let j = i + 1
    let key = ''
    while (j < len && text[j] !== '"') {
      if (text[j] === '\\') { key += text[j] + (text[j + 1] ?? ''); j += 2 }
      else { key += text[j]; j += 1 }
    }
    let k = j + 1
    while (k < len && isWs(text[k])) k += 1
    if (text[k] === ':') {
      const scope = stack[stack.length - 1]
      if (scope) {
        if (scope.has(key)) duplicates.push(key)
        scope.add(key)
      }
    }
    i = j + 1
  }
  return duplicates
}

/** Walk an entry collecting every { type } in effects/conditions arrays. */
function collectTyped(entry, field) {
  const out = []
  const visit = (node) => {
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (node && typeof node === 'object') {
      if (field in node && Array.isArray(node[field])) out.push(...node[field])
      Object.values(node).forEach(visit)
    }
  }
  visit(entry)
  return out
}

function checkId(entry, where, errors) {
  if (!entry.id) { errors.push(`${where}: entry without id`); return }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.id)) {
    errors.push(`${entry.id}: id must be ASCII lower kebab-case (doc/11 §2)`)
  }
  if (!ID_PREFIXES.some((p) => entry.id.startsWith(p))) {
    errors.push(`${entry.id}: id does not start with a registered prefix (doc/11 §2)`)
  }
}

// Cross-table reference fields: [path, expected prefix or null for any].
const REF_FIELDS = [
  ['skills', 'skill-'], ['drops[].item', 'item-'], ['reward.items[].item', 'item-'],
  ['effects[].item', 'item-'], ['effects[].skill', 'skill-'], ['effects[].gongfa', 'gongfa-'],
  ['effects[].npc', 'npc-'], ['effects[].map', 'map-'], ['effects[].quest', 'quest-'],
  ['effects[].enemy', 'enemy-'], ['effects[].boss', 'boss-'], ['effects[].ending', 'end-'],
  // Quest ids legitimately carry mq-/sq-/fq-/dq-/rq-/eq- prefixes (doc/11 §2).
  ['prereq.quests[]', null], ['effects[].quest', null], ['conditions[].quest', null],
  ['conditions[].item', 'item-'],
  ['conditions[].npc', 'npc-'], ['conditions[].map', 'map-'],
  ['unlockSkills', 'skill-'], ['dialogRoot', 'dlg-'], ['home', 'map-'],
  ['encounterTable', 'enc-'], ['giver', 'npc-'],
]

function resolvePath(entry, path) {
  const parts = path.split('.')
  let nodes = [entry]
  for (const part of parts) {
    const arrMatch = part.match(/^(\w+)\[\]$/)
    const next = []
    for (const node of nodes) {
      if (arrMatch) {
        const list = node?.[arrMatch[1]]
        if (Array.isArray(list)) next.push(...list)
      } else if (node && typeof node === 'object' && part in node) {
        next.push(node[part])
      }
    }
    nodes = next
  }
  return nodes.filter((n) => typeof n === 'string' && n.length > 0)
}

/** Full-table validation; returns { ok, errors, warnings, stats }. */
export function validateTables(TABLES) {
  const errors = []
  const warnings = []
  const seenIds = new Map()
  const flagsWritten = new Set()
  const flagsRead = new Set()

  for (const [name, tableList] of Object.entries(TABLES)) {
    if (!Array.isArray(tableList)) continue // config objects (homestead) are not entry tables
    for (const entry of tableList) {
      // 1) id rules and global uniqueness
      checkId(entry, name, errors)
      if (entry.id) {
        if (seenIds.has(entry.id)) errors.push(`${entry.id}: duplicate id (also in ${seenIds.get(entry.id)})`)
        else seenIds.set(entry.id, name)
      }

      // 2) cross-table references
      for (const [path, prefix] of REF_FIELDS) {
        for (const ref of resolvePath(entry, path)) {
          if (prefix === 'flag-') { flagsRead.add(ref); continue }
          if (!resolves(TABLES, ref)) {
            errors.push(`${entry.id}: ${path} "${ref}" does not exist in any table`)
            continue
          }
          if (prefix && !ref.startsWith(prefix)) {
            warnings.push(`${entry.id}: ref "${ref}" (${path}) has unexpected prefix (want ${prefix}*)`)
          }
        }
      }

      // 3) effects / conditions whitelists
      for (const eff of collectTyped(entry, 'effects')) {
        if (!EFFECT_TYPES.includes(eff.type)) errors.push(`${entry.id}: effects type "${eff.type}" not in whitelist (doc/11 §3.2)`)
        if (eff.type === 'flag' && eff.key) flagsWritten.add(eff.key)
      }
      for (const cond of collectTyped(entry, 'conditions')) {
        if (!CONDITION_TYPES.includes(cond.type)) errors.push(`${entry.id}: conditions type "${cond.type}" not in whitelist (doc/11 §3.3)`)
        if (cond.type === 'flag' && cond.key) flagsRead.add(cond.key)
      }

      // 4) quest flags declared + valid state
      if (entry.id?.startsWith('mq-') || entry.id?.startsWith('sq-')) {
        if (!['locked', 'available', 'active', 'completed', 'failed', 'abandoned'].includes(entry.state)) {
          errors.push(`${entry.id}: initial state "${entry.state}" invalid (doc/11 §3.4)`)
        }
        for (const f of entry.flags ?? []) flagsRead.add(f)
      }

      // 10) enemy baseline opt-in
      if (entry.id?.startsWith('enemy-') && entry.baselineRow) {
        const base = ENEMY_BASELINES[entry.baselineRow]
        if (!base) errors.push(`${entry.id}: unknown baselineRow "${entry.baselineRow}"`)
        else {
          for (const stat of Object.keys(base)) {
            const v = entry.stats?.[stat]
            if (typeof v !== 'number') continue
            const [lo, hi] = base[stat]
            if (v < lo || v > hi) errors.push(`${entry.id}: ${stat}=${v} outside ${entry.baselineRow} baseline [${lo}, ${hi}] (doc/16 §7.3)`)
          }
        }
      }
    }
  }

  // 5) quest prereq acyclicity
  const quests = TABLES.quests ?? []
  const byId = new Map(quests.map((q) => [q.id, q]))
  const visiting = new Set()
  const done = new Set()
  const visit = (id, chain) => {
    if (done.has(id)) return
    if (visiting.has(id)) {
      errors.push(`quest prereq cycle: ${[...chain, id].join(' -> ')}`)
      return
    }
    visiting.add(id)
    for (const pre of byId.get(id)?.prereq?.quests ?? []) visit(pre, [...chain, id])
    visiting.delete(id)
    done.add(id)
  }
  for (const q of quests) visit(q.id, [])

  // 6) 支线 level vs reward tier (heuristic bands)
  for (const q of quests) {
    if (!q.id?.startsWith('sq-')) continue
    const lvl = q.level ?? 1
    const exp = q.reward?.exp ?? 0
    const stones = q.reward?.stones ?? 0
    if (lvl <= 2 && (exp > 400 || stones > 200)) warnings.push(`${q.id}: level ${lvl} rewards look over-tier (exp ${exp}, stones ${stones})`)
    if (lvl >= 4 && exp < 100) warnings.push(`${q.id}: level ${lvl} rewards look under-tier (exp ${exp})`)
  }

  // 7) flag registration
  for (const f of flagsRead) {
    if (!f.startsWith('flag-')) continue
    if (!flagsWritten.has(f)) warnings.push(`flag "${f}" is read but never written by any table effect`)
  }

  // 8) orphan quests
  const referenced = new Set()
  for (const q of quests) for (const pre of q.prereq?.quests ?? []) referenced.add(pre)
  // Orphan check applies to MAIN quests only — side quests stand alone by design.
  const orphans = quests.filter((q) => q.id?.startsWith('mq-') && !(q.prereq?.quests?.length) && !referenced.has(q.id))
  if (orphans.length > 1) warnings.push(`orphan main quests: ${orphans.map((q) => q.id).join(', ')}`)

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      tables: Object.keys(TABLES).length,
      entries: Object.values(TABLES).reduce((s, t) => s + (t?.length ?? 0), 0),
    },
  }
}
