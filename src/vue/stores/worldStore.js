import { defineStore } from 'pinia'

// World-side state: location, position, time, weather, unlocks (doc/13 §4).
// During play the Phaser-side TimeSystem/MovementSystem own the live values;
// this store is the persisted snapshot restored on load (doc/13 §6).
export const useWorldStore = defineStore('world', {
  state: () => ({
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
    unlockedLocations: ['map-qingyun'],
  }),
  actions: {
    // Distribute the player block of a save payload (doc/12 §3.4).
    fromSave(player) {
      this.location = player.location
      this.position = { ...player.position }
      this.time = { ...player.time }
      this.unlockedLocations = [...(this.unlockedLocations ?? [])]
    },
    // Collect this store's share into the player block of a save payload.
    toSave(playerBlock) {
      return {
        ...playerBlock,
        location: this.location,
        position: { ...this.position },
        time: { ...this.time },
      }
    },
    // Initial state handed to Phaser via game:start.
    sessionState() {
      return {
        location: this.location,
        position: { ...this.position },
        time: { ...this.time },
      }
    },
  },
})
