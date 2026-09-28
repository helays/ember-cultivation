import { defineStore } from 'pinia'

// Quest progress, world flags and relationship state (doc/13 §4).
// Persistence shape: doc/12 §3.8 (questProgress/worldFlags top-level fields).
export const useQuestStore = defineStore('quest', {
  state: () => ({
    questProgress: { active: [], states: {}, counters: {} },
    worldFlags: {},
    relationships: {},
    factions: {
      'fac-kunlun': 0,
      'fac-maoshan': 0,
      'fac-jiejiao': 0,
      'fac-yao': 0,
      'fac-court': 0,
      'fac-sanxiu': 0,
    },
  }),
  actions: {
    fromSave(payload) {
      this.questProgress = {
        active: JSON.parse(JSON.stringify(payload.questProgress?.active ?? [])),
        states: { ...payload.questProgress?.states },
        counters: { ...payload.questProgress?.counters },
      }
      this.worldFlags = { ...payload.worldFlags }
      this.relationships = { ...payload.relationships }
      this.factions = {
        'fac-kunlun': 0, 'fac-maoshan': 0, 'fac-jiejiao': 0,
        'fac-yao': 0, 'fac-court': 0, 'fac-sanxiu': 0,
        ...payload.factions,
      }
    },
    toSave() {
      return {
        questProgress: JSON.parse(JSON.stringify(this.questProgress)),
        worldFlags: { ...this.worldFlags },
        relationships: { ...this.relationships },
        factions: { ...this.factions },
      }
    },
    setQuestState(questId, state) {
      this.questProgress.states[questId] = state
      if (state === 'active' && !this.questProgress.active.some((q) => q.id === questId)) {
        this.questProgress.active.push({ id: questId, step: 0, startedDay: 0 })
      }
      if (state !== 'active') {
        this.questProgress.active = this.questProgress.active.filter((q) => q.id !== questId)
      }
    },
  },
})
