import Phaser from 'phaser'
import { ENCOUNTER_RADIUS } from '@/core/constants.js'

// Real encounter trigger (M3): inside a zone (or within ENCOUNTER_RADIUS of a
// point zone) roll a chance, then hand the encounter table to WorldScene.
// Battle entry/exit, push-away and the invulnerability window live there.
const CHECK_INTERVAL_MS = 500
const CHANCE = 0.6
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
        if (Phaser.Geom.Polygon.Contains(zone.polygon, x, y)) return zone
      } else if (zone.x !== undefined && zone.y !== undefined) {
        if (Phaser.Math.Distance.Between(x, y, zone.x, zone.y) <= ENCOUNTER_RADIUS) return zone
      }
    }
    return null
  }

  check() {
    if (this.scene.frozen || this.scene.inBattle) return
    const now = this.scene.time.now
    if (now < this.cooldownUntil) return
    const body = this.player.body.center
    const zone = this.insideAnyZone(body.x, body.y)
    if (!zone) return
    if (Math.random() < CHANCE) {
      this.cooldownUntil = now + COOLDOWN_MS
      this.scene.startBattle(zone.table)
    }
  }

  update() {
    // Polling happens on the scene timer; nothing per-frame.
  }
}
