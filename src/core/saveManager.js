import { openDB } from 'idb'
import { logger } from './logger.js'

// IndexedDB persistence per doc/12 §1: db `ember-save` v1, stores
// saves / backup / meta. This module owns serialization concerns only —
// payload assembly lives in the Pinia stores (doc/12 §10.3).

const DB_NAME = 'ember-save'
const DB_VERSION = 1
const VISIBLE_SLOTS = ['slot-1', 'slot-2', 'slot-3']
const AUTO_SLOT = 'slot-auto'
const LOCK_NAME = 'ec-save-write'
const SAVE_VERSION = '1.2'
const TAB_ID = 'tab-' + Math.random().toString(16).slice(2, 8)

let db = null
// Session-memory fallback when IndexedDB is disabled (doc/12 §1.4 InvalidStateError)
let memory = null

const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('ec-save')
  : null

async function getDb() {
  if (db || memory) return db
  try {
    db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('saves')) {
          database.createObjectStore('saves', { keyPath: 'slot' })
        }
        if (!database.objectStoreNames.contains('backup')) {
          database.createObjectStore('backup', { keyPath: 'key' })
        }
        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta', { keyPath: 'key' })
        }
      },
    })
  } catch (err) {
    logger.warn('saveManager', 'IndexedDB unavailable, using session memory (progress lost on exit)', err)
    memory = new Map()
  }
  return db
}

async function getRecord(store, key) {
  const database = await getDb()
  if (!database) return memory.get(`${store}:${key}`) ?? null
  return (await database.get(store, key)) ?? null
}

async function putRecord(store, value) {
  const database = await getDb()
  if (!database) {
    memory.set(`${store}:${value.slot ?? value.key}`, value)
    return
  }
  await database.put(store, value)
}

async function deleteRecord(store, key) {
  const database = await getDb()
  if (!database) {
    memory.delete(`${store}:${key}`)
    return
  }
  await database.delete(store, key)
}

async function listKeys(store) {
  const database = await getDb()
  if (!database) {
    return [...memory.keys()].filter((k) => k.startsWith(`${store}:`)).map((k) => k.slice(store.length + 1))
  }
  return database.getAllKeys(store)
}

// FNV-1a 32-bit, 8 hex chars (doc/12 §3.3). Integrity hint only, never a gate.
function fnv1a(str) {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function checksumOf(payload) {
  const { slotMeta, ...rest } = payload
  return fnv1a(JSON.stringify(rest))
}

// Vue registers the payload composer here (wired in src/main.js, the only
// module allowed to import both sides). Phaser scenes call composeSave()
// when handling save:request without ever touching Pinia.
let payloadComposer = null

export function setPayloadComposer(fn) {
  payloadComposer = fn
}

export function composeSave() {
  return payloadComposer ? payloadComposer() : null
}

/** Fresh save skeleton in the doc/12 §3.1 shape (version 1.2).
 *  Realm stats are placeholders until M3/M4 calibrate them against doc/16. */
export function defaultPayload() {
  const now = Math.floor(Date.now() / 1000)
  return {
    version: SAVE_VERSION,
    saveName: '凡人初期',
    timestamp: now,
    playTime: 0,
    slotMeta: {
      createdAt: now,
      stability: 70,
      writerTabId: TAB_ID,
      rev: 0,
      checksum: '',
      tampered: false,
    },
    player: {
      name: '无名',
      realm: '凡人',
      realmIndex: 0,
      stage: '初期',
      stageIndex: 1,
      exp: 0,
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
      location: 'map-qingyun',
      position: { x: 976, y: 792, facing: 'down' },
      time: {
        year: 1,
        month: 1,
        day: 1,
        hour: '午',
        shichenIndex: 6,
        dayIndex: 0,
        season: 'spring',
        moonPhase: 'new',
        weather: 'clear',
        weatherRollDay: 0,
      },
    },
    inventory: { capacity: 24, items: [] },
    equipment: { weapon: null, armor: null, accessory: null },
    hotbar: [null, null, null, null],
    skills: [],
    gongfa: { id: null, level: 1, tier: 1 },
    relationships: {},
    factions: {
      'fac-kunlun': 0,
      'fac-maoshan': 0,
      'fac-jiejiao': 0,
      'fac-yao': 0,
      'fac-court': 0,
      'fac-sanxiu': 0,
    },
    questProgress: { active: [], states: {}, counters: {} },
    worldFlags: {},
    unlockedLocations: ['map-qingyun'],
    codex: { yaoguai: [], fabao: [], gongfa: [], liaozhai: [], endings: [] },
    companions: [],
    lover: null,
    homestead: {
      level: 1,
      spiritDensity: 1.0,
      fieldSlots: 0,
      fields: [],
      facilities: { alchemy: 0, crafting: 0, talisman: 0, storage: 0 },
    },
    newGamePlus: 0,
    ngPlusInherit: {
      expMul: 1.0,
      mindRegenMul: 1.0,
      dropMul: 1.0,
      encounterRateMul: 1.0,
      endingsUnlocked: [],
    },
    rngSeed: (Date.now() % 100000000) | 0,
  }
}

/** Rolling backup rotation: bk-2 <- bk-1 <- bk-0 <- previous payload (doc/12 §1.1). */
async function rotateBackup(previous) {
  if (!previous?.payload) return
  const bk0 = await getRecord('backup', 'bk-0')
  const bk1 = await getRecord('backup', 'bk-1')
  if (bk1) await putRecord('backup', { ...bk1, key: 'bk-2' })
  if (bk0) await putRecord('backup', { ...bk0, key: 'bk-1' })
  await putRecord('backup', { key: 'bk-0', at: Date.now(), slot: previous.slot, payload: previous.payload })
}

export async function writeSlot(slot, data, opts = {}) {
  const started = performance.now()
  if (![...VISIBLE_SLOTS, AUTO_SLOT].includes(slot)) {
    throw new Error(`unknown slot: ${slot}`)
  }
  // Detach from Vue reactivity so the stored object is plain JSON.
  const payload = JSON.parse(JSON.stringify(data))
  payload.version = SAVE_VERSION
  payload.timestamp = Math.floor(Date.now() / 1000)

  const previous = await getRecord('saves', slot)
  const rev = (previous?.rev ?? 0) + 1
  const prevMeta = previous?.payload?.slotMeta
  const gain = previous ? 5 : 15 // overwrite +5, fresh save +15 (doc/12 §2.5)
  payload.slotMeta = {
    createdAt: prevMeta?.createdAt ?? payload.timestamp,
    stability: Math.min(100, Math.max(0, (prevMeta?.stability ?? 70) + gain)),
    writerTabId: TAB_ID,
    rev,
    checksum: checksumOf(payload),
    tampered: false,
  }

  const run = async () => {
    await rotateBackup(previous)
    // WAL marker (doc/12 §1.4): write-before flag, removed after the write lands.
    await putRecord('saves', { slot: `${slot}/pending`, at: Date.now() })
    await putRecord('saves', {
      slot,
      rev,
      writerTabId: TAB_ID,
      updatedAt: payload.timestamp,
      payload,
    })
    await deleteRecord('saves', `${slot}/pending`)
    await putRecord('meta', { key: 'lastWriteAt', value: Date.now() })
  }

  let ok = true
  let error = null
  try {
    if (navigator.locks?.request) {
      await navigator.locks.request(LOCK_NAME, run)
    } else {
      await run()
    }
  } catch (err) {
    ok = false
    error = err
    logger.error('saveManager', `writeSlot(${slot}) failed`, err)
  }

  if (ok) {
    await putRecord('backup', { key: 'bk-last-good', at: Date.now(), slot, payload })
    channel?.postMessage({ type: 'written', slot, rev, writerTabId: TAB_ID })
  }
  return { ok, rev, error, durationMs: Math.round(performance.now() - started) }
}

export async function readSlot(slot) {
  const record = await getRecord('saves', slot)
  if (!record) return null
  const payload = migrate(record.payload)
  const result = validate(payload)
  if (result.level === 'error') {
    const err = new Error(`slot ${slot} failed validation: ${result.issues.join('; ')}`)
    err.code = 'BAD_SAVE'
    throw err
  }
  if (payload.slotMeta.tampered) {
    logger.warn('saveManager', `slot ${slot} checksum mismatch — payload may have been edited`)
  }
  return { payload, rev: record.rev, updatedAt: record.updatedAt, validation: result }
}

export async function listSlots() {
  const summaries = []
  for (const slot of [...VISIBLE_SLOTS, AUTO_SLOT]) {
    const record = await getRecord('saves', slot)
    const p = record?.payload
    summaries.push({
      slot,
      exists: !!record,
      auto: slot === AUTO_SLOT,
      rev: record?.rev ?? 0,
      updatedAt: record?.updatedAt ?? null,
      saveName: p?.saveName ?? '',
      realm: p?.player?.realm ?? '',
      stage: p?.player?.stage ?? '',
      playTime: p?.playTime ?? 0,
      dayLabel: p ? `第${p.player.time.year}年${p.player.time.month}月${p.player.time.day}日` : '',
      stability: p?.slotMeta?.stability ?? 70,
    })
  }
  return summaries
}

export async function deleteSlot(slot) {
  const record = await getRecord('saves', slot)
  if (record) await rotateBackup(record)
  await deleteRecord('saves', slot)
}

/** Pure migration chain (doc/12 §4.2). M1: current version only. */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return raw
  // 1.0 -> 1.1 -> 1.2 steps land here as the structure evolves (M4).
  return raw
}

const REQUIRED_TOP = [
  'version', 'saveName', 'timestamp', 'playTime', 'slotMeta', 'player',
  'inventory', 'equipment', 'hotbar', 'skills', 'gongfa', 'relationships',
  'factions', 'questProgress', 'worldFlags', 'unlockedLocations', 'codex',
  'companions', 'lover', 'homestead', 'newGamePlus', 'ngPlusInherit', 'rngSeed',
]

/** Coarse bad-save grading (doc/12 §9.2). Full ten-point check lands in M4. */
export function validate(data) {
  const issues = []
  if (!data || typeof data !== 'object') {
    return { level: 'error', issues: ['payload is not an object'] }
  }
  for (const field of REQUIRED_TOP) {
    if (!(field in data)) issues.push(`missing top-level field: ${field}`)
  }
  if (data.player) {
    if (!data.player.position) issues.push('missing player.position')
    if (!data.player.time) issues.push('missing player.time')
    if (typeof data.player.realmIndex !== 'number') issues.push('missing player.realmIndex')
  }
  if (data.slotMeta && data.slotMeta.checksum) {
    if (checksumOf(data) !== data.slotMeta.checksum) data.slotMeta.tampered = true
  }
  const hard = issues.some((i) => i.startsWith('missing top-level') || i.startsWith('payload'))
  return { level: hard ? 'error' : issues.length ? 'warn' : 'ok', issues }
}

/** Backup recovery (doc/12 §9.3). Skeleton for M1: exposes whether a last-good backup exists. */
export async function recover() {
  const lastGood = await getRecord('backup', 'bk-last-good')
  return { hasBackup: !!lastGood, slot: lastGood?.slot ?? null }
}

/** Boot-time WAL cleanup: interrupted writes leave `<slot>/pending` markers (doc/12 §1.4). */
export async function clearPendingMarkers() {
  const keys = await listKeys('saves')
  const pending = keys.filter((k) => String(k).endsWith('/pending'))
  for (const key of pending) await deleteRecord('saves', key)
  return pending.length
}
