import Phaser from 'phaser'
import { logger } from '@/core/logger.js'

// Phaser-side HUD overlay (hp/mp bars, floating numbers from M3 on).
// Vue panels are NOT rendered here — they live in src/vue/ and talk over bus.
export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene')
  }

  create() {
    logger.info('UIScene', 'ui overlay ready')
  }
}
