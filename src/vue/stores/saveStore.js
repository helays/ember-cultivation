import { defineStore } from 'pinia'
import { listSlots, defaultPayload, readSlot as smReadSlot } from '@/core/saveManager.js'
import { usePlayerStore } from './playerStore.js'
import { useWorldStore } from './worldStore.js'
import { useInventoryStore } from './inventoryStore.js'
import { useQuestStore } from './questStore.js'

// Save orchestration on the Vue side (doc/12 §10.3): assembles the FULL
// doc/12 §3.1 payload from every store, tracks slot summaries and the
// writing flag. The IndexedDB write itself runs in the Phaser side while
// the world is frozen (save:request -> writeSlot -> save:written).
export const useSaveStore = defineStore('save', {
  state: () => ({
    slots: [],
    autoBackup: null,
    writing: false,
  }),
  actions: {
    async refreshSlots() {
      this.slots = await listSlots()
      this.autoBackup = this.slots.find((s) => s.auto) ?? null
    },
    /** Compose the full doc/12 §3.1 payload from current store state. */
    buildPayload() {
      const base = defaultPayload()
      const player = usePlayerStore()
      const world = useWorldStore()
      const inventory = useInventoryStore()
      const quest = useQuestStore()

      const inventoryBlock = inventory.toSave()
      const questBlock = quest.toSave()

      return {
        ...base,
        saveName: `${player.realm}${player.stage}`,
        playTime: base.playTime,
        player: world.toSave(player.toSave()),
        ...inventoryBlock,
        skills: JSON.parse(JSON.stringify(player.skills)),
        gongfa: JSON.parse(JSON.stringify(player.gongfa)),
        ...questBlock,
        unlockedLocations: [...world.unlockedLocations],
        codex: JSON.parse(JSON.stringify(player.codex)),
        companions: JSON.parse(JSON.stringify(player.companions)),
        lover: player.lover,
        newGamePlus: player.newGamePlus,
        ngPlusInherit: base.ngPlusInherit,
        rngSeed: player.rngSeed,
        daoPoints: player.daoPoints,
      }
    },
    /** Distribute a loaded payload into every store. */
    applyPayload(payload) {
      const player = usePlayerStore()
      const world = useWorldStore()
      const inventory = useInventoryStore()
      const quest = useQuestStore()

      player.fromSave(payload.player)
      world.fromSave(payload.player)
      inventory.fromSave(payload)
      quest.fromSave(payload)

      player.skills = JSON.parse(JSON.stringify(payload.skills ?? []))
      player.gongfa = payload.gongfa ?? { id: null, level: 1, tier: 1 }
      player.codex = { yaoguai: [], fabao: [], gongfa: [], liaozhai: [], endings: [], ...JSON.parse(JSON.stringify(payload.codex ?? {})) }
      player.companions = JSON.parse(JSON.stringify(payload.companions ?? []))
      player.lover = payload.lover ?? null
      player.newGamePlus = payload.newGamePlus ?? 0
      player.rngSeed = payload.rngSeed ?? 20240517
      player.daoPoints = payload.daoPoints ?? 0
      player.stones = payload.player.stones ?? 50
    },
    /** Read + validate + load a slot in one step. */
    async loadSlot(slot) {
      const result = await smReadSlot(slot)
      if (!result) return null
      this.applyPayload(result.payload)
      return result
    },
  },
})
