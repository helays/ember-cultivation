// Game context bridge: the single translation layer between Pinia stores and
// the pure core rules modules (effectRunner / conditionChecker operate on a
// plain ctx object, never on stores — doc/12 §10.3 boundary).
import { usePlayerStore } from './stores/playerStore.js'
import { useWorldStore } from './stores/worldStore.js'
import { useInventoryStore } from './stores/inventoryStore.js'
import { useQuestStore } from './stores/questStore.js'
import { runEffects } from '@/core/effectRunner.js'

const clone = (obj) => JSON.parse(JSON.stringify(obj))

/** Snapshot the full game state into a plain ctx object. */
export function buildContext() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const inventory = useInventoryStore()
  const quest = useQuestStore()
  return {
    player: {
      ...clone(player.$state),
      // playerStore holds name/realm/exp/... directly; keep the flat shape
      realm: player.realm,
      stage: player.stage,
    },
    world: clone(world.$state),
    inventory: clone(inventory.$state),
    quests: clone(quest.questProgress),
    worldFlags: clone(quest.worldFlags),
    relationships: clone(quest.relationships),
    factions: clone(quest.factions),
    companions: clone(player.companions),
    lover: player.lover,
    newGamePlus: player.newGamePlus,
    rngSeed: player.rngSeed,
  }
}

/** Write a (mutated) ctx back into the stores. */
export function applyContext(ctx) {
  const player = usePlayerStore()
  const world = useWorldStore()
  const inventory = useInventoryStore()
  const quest = useQuestStore()

  const p = ctx.player
  player.fromSave({
    ...p,
    // toSave/fromSave expect the flat player block; position/time live in world
    location: ctx.world.location,
    position: ctx.world.position,
    time: ctx.world.time,
  })
  player.skills = clone(p.skills)
  player.codex = clone(p.codex)
  player.stones = p.stones
  player.gongfa = clone(p.gongfa)
  player.daoPoints = p.daoPoints
  player.companions = clone(ctx.companions)
  player.lover = ctx.lover
  player.newGamePlus = ctx.newGamePlus
  player.rngSeed = ctx.rngSeed

  world.location = ctx.world.location
  world.unlockedLocations = clone(ctx.world.unlockedLocations)
  world.weather = ctx.world.weather
  if (ctx.world.time) world.time = clone(ctx.world.time)
  if (p.position) world.position = clone(p.position)

  inventory.items = clone(ctx.inventory.items)
  inventory.equipment = clone(ctx.inventory.equipment)
  inventory.hotbar = clone(ctx.inventory.hotbar)

  quest.questProgress = clone(ctx.quests)
  quest.worldFlags = clone(ctx.worldFlags)
  quest.relationships = clone(ctx.relationships)
  quest.factions = clone(ctx.factions)
}

/** Run effects against the live game state (snapshot → mutate → write back). */
export function applyEffects(effects) {
  const ctx = buildContext()
  const applied = runEffects(effects, ctx)
  applyContext(ctx)
  return applied
}
