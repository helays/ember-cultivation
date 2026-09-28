import { defineStore } from 'pinia'

// UI-layer state only; game state lives in the other stores and Phaser.
// `blocking` gates the single-blockable-UI rule: dialog and menus are
// mutually exclusive (doc/13 §3.2).
export const useUiStore = defineStore('ui', {
  state: () => ({
    blocking: false,
    openMenu: null,
    toasts: [],
  }),
})
