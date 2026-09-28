import { defineStore } from 'pinia'
import { listSlots, defaultPayload } from '@/core/saveManager.js'
import { usePlayerStore } from './playerStore.js'
import { useWorldStore } from './worldStore.js'

// Save orchestration on the Vue side (doc/12 §10.3): assembles the payload
// from sibling stores, tracks slot summaries and the writing flag.
// The actual IndexedDB write is performed by the Phaser side while the
// world is frozen (save:request -> writeSlot -> save:written).
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
    /** Compose the full doc/12 §3.1 payload from current store state.
     *  Systems without stores yet (inventory/quests/...) fall back to defaults. */
    buildPayload() {
      const base = defaultPayload()
      const player = usePlayerStore()
      const world = useWorldStore()
      const playerBlock = world.toSave(player.toSave())
      return {
        ...base,
        saveName: `${player.realm}${player.stage}`,
        player: playerBlock,
        unlockedLocations: [...world.unlockedLocations],
      }
    },
    /** Distribute a loaded payload into stores. */
    applyPayload(payload) {
      usePlayerStore().fromSave(payload.player)
      useWorldStore().fromSave(payload.player)
    },
  },
})
