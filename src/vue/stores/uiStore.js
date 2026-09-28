import { defineStore } from 'pinia'

// UI-layer state only; game state lives in the other stores and Phaser.
// `blocking` gates the single-blockable-UI rule: dialog and menus are
// mutually exclusive (doc/13 §3.2). `phase` tracks menu vs in-game.
export const useUiStore = defineStore('ui', {
  state: () => ({
    phase: 'menu',
    blocking: false,
    openMenu: null,
    dialogOpen: false,
    toasts: [],
  }),
  actions: {
    openUi(menu) {
      if (this.dialogOpen) return
      this.openMenu = menu
      this.blocking = true
    },
    closeUi() {
      this.openMenu = null
      this.dialogOpen = false
      this.blocking = false
    },
    toggleMenu(menu) {
      if (this.dialogOpen) return
      if (this.openMenu === menu) this.closeUi()
      else this.openUi(menu)
    },
    openDialog() {
      if (this.openMenu || this.dialogOpen) return
      this.dialogOpen = true
      this.blocking = true
    },
    closeDialog() {
      this.dialogOpen = false
      this.blocking = !!this.openMenu
    },
    pushToast({ text, level = 'info' }) {
      const id = Date.now() + Math.random()
      this.toasts.push({ id, text, level })
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id)
      }, 2600)
    },
  },
})
