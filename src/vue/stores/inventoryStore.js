import { defineStore } from 'pinia'
import { getItem } from '@/core/registry.js'

// Inventory state (doc/02 §5): capacity from 24, stack 99 for stackables,
// equipment slots and the 4-slot hotbar. Persistence shape: doc/12 §3.6.
export const useInventoryStore = defineStore('inventory', {
  state: () => ({
    items: [],
    capacity: 24,
    equipment: { weapon: null, armor: null, accessory: null },
    hotbar: [null, null, null, null],
  }),
  getters: {
    slotCount: (state) => state.items.length,
    full: (state) => state.items.length >= state.capacity,
  },
  actions: {
    fromSave(payload) {
      this.items = JSON.parse(JSON.stringify(payload.inventory?.items ?? []))
      this.capacity = payload.inventory?.capacity ?? 24
      this.equipment = { weapon: null, armor: null, accessory: null, ...(payload.equipment ?? {}) }
      this.hotbar = [...(payload.hotbar ?? [null, null, null, null])]
      while (this.hotbar.length < 4) this.hotbar.push(null)
    },
    toSave() {
      return {
        inventory: { capacity: this.capacity, items: JSON.parse(JSON.stringify(this.items)) },
        equipment: { ...this.equipment },
        hotbar: [...this.hotbar],
      }
    },
    count(itemId) {
      return this.items.filter((s) => s.id === itemId).reduce((sum, s) => sum + s.qty, 0)
    },
    add(itemId, qty = 1) {
      const stackable = getItem(itemId)?.stackable ?? false
      if (stackable) {
        const slot = this.items.find((s) => s.id === itemId)
        if (slot) {
          slot.qty = Math.min(99, slot.qty + qty)
          return true
        }
      }
      if (this.items.length >= this.capacity) return false
      this.items.push({ id: itemId, qty: Math.min(99, qty) })
      return true
    },
    remove(itemId, qty = 1) {
      const slot = this.items.find((s) => s.id === itemId)
      if (!slot || slot.qty < qty) return false
      slot.qty -= qty
      if (slot.qty <= 0) this.items = this.items.filter((s) => s !== slot)
      return true
    },
    equip(itemId) {
      const slot = this.items.find((s) => s.id === itemId)
      const def = getItem(itemId)
      if (!slot || !def?.slot || !(def.slot in this.equipment)) return false
      const previous = this.equipment[def.slot]
      this.equipment[def.slot] = itemId
      this.items = this.items.filter((s) => s !== slot)
      if (previous) this.items.push({ id: previous, qty: 1 })
      return true
    },
    unequip(slotName) {
      const id = this.equipment[slotName]
      if (!id) return false
      if (this.items.length >= this.capacity) return false
      this.equipment[slotName] = null
      this.items.push({ id, qty: 1 })
      return true
    },
  },
})
