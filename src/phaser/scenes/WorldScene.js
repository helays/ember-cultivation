import Phaser from 'phaser'
import { logger } from '@/core/logger.js'

// Exploration map scene (free movement from M1 on). M0 empty shell.
export class WorldScene extends Phaser.Scene {
  constructor() {
    super('WorldScene')
  }

  create() {
    logger.info('WorldScene', 'world ready, launching UIScene')
    this.scene.launch('UIScene')
  }
}
