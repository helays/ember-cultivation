import Phaser from 'phaser'
import { LOGICAL_WIDTH, LOGICAL_HEIGHT, PALETTE, COLOR } from '@/core/constants.js'
import { BootScene } from './scenes/BootScene.js'
import { WorldScene } from './scenes/WorldScene.js'
import { UIScene } from './scenes/UIScene.js'

// Render settings follow doc/14 §8.6: 640x360 logical resolution,
// pixel-perfect upscaling, letterboxed centering on odd windows.
export function createPhaserConfig(parent) {
  return {
    type: Phaser.AUTO,
    parent,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    backgroundColor: PALETTE[COLOR.INK].hex,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: 0,
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, WorldScene, UIScene],
  }
}
