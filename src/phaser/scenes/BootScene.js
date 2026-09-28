import Phaser from 'phaser'
import { bus, EVT } from '@/core/bus.js'
import { logger } from '@/core/logger.js'
import { clearPendingMarkers } from '@/core/saveManager.js'
import '@/core/loadTables.js' // bulk table load + registry index (doc/13 §5)

// Startup chain head (doc/12 §5.2): stays idle under the Vue main menu,
// then boots WorldScene when the menu emits game:start with session state.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create() {
    bus.on(EVT.GAME_START, this.onGameStart)

    // WAL cleanup from an interrupted write (doc/12 §1.4): IndexedDB
    // transactions are atomic, so a leftover marker just means the write
    // never landed — remove it and let the player know.
    clearPendingMarkers().then((count) => {
      if (count > 0) {
        logger.warn('BootScene', `cleared ${count} pending write marker(s)`)
        bus.emit(EVT.TOAST, { text: '检测到上次存档中断，已清理标记。', level: 'warn' })
      }
    })
  }

  onGameStart = (payload) => {
    logger.info('BootScene', `game:start mode=${payload.mode}`)
    this.scene.start('WorldScene', payload)
  }
}
