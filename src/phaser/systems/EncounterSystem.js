import Phaser from 'phaser'
import { bus, EVT } from '@/core/bus.js'
import { ENCOUNTER_RADIUS } from '@/core/constants.js'

// Placeholder encounter system (doc/15 §2.2): while the player is inside an
// encounter zone (or within ENCOUNTER_RADIUS of a point zone), roll a chance
// and toast "遭遇（战斗未实装）". Real battles land in M3.
const CHECK_INTERVAL_MS = 500
const CHANCE = 0.35
const COOLDOWN_MS = 8000

export class EncounterSystem {
  constructor(scene, player, zones) {
    this.scene = scene
    this.player = player
    this.zones = zones ?? []
    this.cooldownUntil = 0
    this.timer = scene.time.addEvent({
      delay: CHECK_INTERVAL_MS,
      loop: true,
      callback: () => this.check(),
    })
  }

  insideAnyZone(x, y) {
    for (const zone of this.zones) {
      if (zone.polygon) {
        if (Phaser.Geom.Polygon.Contains(zone.polygon, x, y)) return true
      } else if (zone.x !== undefined && zone.y !== undefined) {
        if (Phaser.Math.Distance.Between(x, y, zone.x, zone.y) <= ENCOUNTER_RADIUS) return true
      }
    }
    return false
  }

  check() {
    if (this.scene.frozen) return
    const now = this.scene.time.now
    if (now < this.cooldownUntil) return
    const body = this.player.body.center
    if (!this.insideAnyZone(body.x, body.y)) return
    if (Math.random() < CHANCE) {
      bus.emit(EVT.TOAST, { text: '遭遇（战斗未实装）', level: 'warn' })
      this.cooldownUntil = now + COOLDOWN_MS
    }
  }

  update() {
    // Polling happens on the scene timer; nothing per-frame.
  }
}
