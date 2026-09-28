import Phaser from 'phaser'
import { logger } from '@/core/logger.js'

// Startup chain head: BootScene → WorldScene → UIScene (doc/15 §2.1).
// M0 keeps it an empty shell; asset preload and registry wiring land in M1+.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  preload() {
    // No assets to load yet — M2 output gets wired in when WorldScene goes real.
  }

  create() {
    logger.info('BootScene', 'boot complete, starting WorldScene')
    this.scene.start('WorldScene')
  }
}
