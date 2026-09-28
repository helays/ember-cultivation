import Phaser from 'phaser'
import { bus, EVT } from '@/core/bus.js'
import { logger } from '@/core/logger.js'

// NPC entity (doc/15 §2.5): position marker + name label; interaction is
// resolved by WorldScene proximity and the dialog flow lives in Vue.
export class Npc {
  constructor(scene, def) {
    this.def = def
    this.x = def.position?.x ?? 0
    this.y = def.position?.y ?? 0
    // Placeholder body until npc art ships (doc/14 §4.4 visible-block rule).
    this.go = scene.add
      .rectangle(this.x, this.y, 28, 44, 0x38565c)
      .setStrokeStyle(2, 0x8c6a3f)
      .setOrigin(0.5, 1)
      .setDepth(4)
    this.label = scene.add
      .text(this.x - 24, this.y - 66, def.name, {
        fontFamily: 'var(--font-ui)',
        fontSize: '12px',
        color: '#e0c070',
        resolution: 1,
      })
      .setDepth(4)
    logger.debug('Npc', `placed ${def.id} at ${this.x},${this.y}`)
  }

  contains(x, y, radius) {
    return Phaser.Math.Distance.Between(x, y, this.x, this.y - 22) <= radius
  }

  destroy() {
    this.go.destroy()
    this.label.destroy()
  }
}
