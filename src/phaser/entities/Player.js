import Phaser from 'phaser'
import { SPRITE_WALK } from '@/core/constants.js'
import playerSheetUrl from '@/assets/sprites/player/sprite-player-walk-4dir.png?url'

const TEXTURE_KEY = 'player-walk'
// Atlas row order is fixed by the .atlas.json frames list:
// down, left, right, up — 4 frames each (see src/assets/pixel/player/).
const DIRECTIONS = ['down', 'left', 'right', 'up']
const ANIM_FPS = 8

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, facing = 'down') {
    super(scene, x, y, TEXTURE_KEY, 0)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setDepth(5)
    // Feet-anchored circular body: radius 12, centered at (16, 36) of the
    // 32x48 frame so the visible feet sit on the collision point.
    this.body.setCircle(12, 4, 24)
    this.facing = DIRECTIONS.includes(facing) ? facing : 'down'
    this.setIdleFrame()
  }

  static preload(scene) {
    scene.load.spritesheet(TEXTURE_KEY, playerSheetUrl, {
      frameWidth: SPRITE_WALK.width,
      frameHeight: SPRITE_WALK.height,
    })
  }

  static registerAnimations(scene) {
    DIRECTIONS.forEach((dir, row) => {
      const key = `player-walk-${dir}`
      if (scene.anims.exists(key)) return
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(TEXTURE_KEY, {
          start: row * 4,
          end: row * 4 + 3,
        }),
        frameRate: ANIM_FPS,
        repeat: -1,
      })
    })
  }

  setFacing(dir) {
    if (DIRECTIONS.includes(dir)) this.facing = dir
  }

  setIdleFrame() {
    this.setFrame(DIRECTIONS.indexOf(this.facing) * 4)
  }

  playWalk() {
    this.play(`player-walk-${this.facing}`, true)
  }
}
