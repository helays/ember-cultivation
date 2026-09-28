import Phaser from 'phaser'
import { PLAYER_SPEED } from '@/core/constants.js'
import { logger } from '@/core/logger.js'
import { Player } from '../entities/Player.js'
import { TimeSystem } from './TimeSystem.js'

const RUN_SPEED = 200
const WATER_SPEED_MUL = 0.6
const STEP_PX = 32 // 1 step = 32px of displacement (doc/12 §7.3)

// Eight-direction free movement (doc/15 §2.2): 140 px/s walk, 200 px/s run,
// water zones slow the player instead of blocking.
export class MovementSystem {
  constructor(scene, player, waterRects) {
    this.scene = scene
    this.player = player
    this.waterRects = waterRects ?? []
    const keyboard = scene.input.keyboard
    this.cursors = keyboard.createCursorKeys()
    this.keys = keyboard.addKeys('W,A,S,D,SHIFT,E')
    this.eWasDown = false
    Player.registerAnimations(scene)
  }

  inWater(x, y) {
    return this.waterRects.some((r) => r.contains(x, y))
  }

  update(delta) {
    const dt = delta / 1000
    const player = this.player

    if (this.scene.frozen) {
      player.setVelocity(0, 0)
      player.anims.stop()
      player.setIdleFrame()
      return
    }

    let vx = 0
    let vy = 0
    if (this.cursors.left.isDown || this.keys.A.isDown) vx -= 1
    if (this.cursors.right.isDown || this.keys.D.isDown) vx += 1
    if (this.cursors.up.isDown || this.keys.W.isDown) vy -= 1
    if (this.cursors.down.isDown || this.keys.S.isDown) vy += 1

    const moving = vx !== 0 || vy !== 0
    if (moving) {
      const len = Math.hypot(vx, vy)
      let speed = this.keys.SHIFT.isDown ? RUN_SPEED : PLAYER_SPEED
      const body = player.body.center
      if (this.inWater(body.x, body.y)) speed *= WATER_SPEED_MUL
      vx = (vx / len) * speed
      vy = (vy / len) * speed
      player.setVelocity(vx, vy)
      this.player.setFacing(Math.abs(vx) >= Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up')
      player.playWalk()
      this.scene.timeSystem.addDistance(Math.hypot(vx, vy) * dt)
    } else {
      player.setVelocity(0, 0)
      player.anims.stop()
      player.setIdleFrame()
    }

    // E is the interact key (default binds, doc/12 §1.1); edge-triggered.
    const eDown = this.keys.E.isDown
    if (eDown && !this.eWasDown) this.scene.tryInteract?.()
    this.eWasDown = eDown
  }
}
