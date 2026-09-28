// EventTriggerSystem (doc/02 §8.3, M4 scope): the Phaser side only probes
// proximity to map event points — the five-step resolution (once → condition
// → chance → flag → cooldown) runs on the Vue side via event:probe, because
// it needs game state the scenes must not touch.
import Phaser from 'phaser'
import { bus, EVT } from '@/core/bus.js'

const PROBE_RADIUS = 40
const PROBE_COOLDOWN_MS = 3000

export class EventTriggerSystem {
  constructor(scene, player, eventPoints) {
    this.scene = scene
    this.player = player
    this.points = eventPoints ?? []
    this.probedAt = new Map()
    this.timer = scene.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => this.check(),
    })
  }

  check() {
    if (this.scene.frozen || this.scene.inBattle) return
    const body = this.player.body.center
    for (const point of this.points) {
      const last = this.probedAt.get(point.eventId) ?? 0
      if (this.scene.time.now - last < PROBE_COOLDOWN_MS) continue
      if (Phaser.Math.Distance.Between(body.x, body.y, point.x, point.y) <= PROBE_RADIUS) {
        this.probedAt.set(point.eventId, this.scene.time.now)
        bus.emit(EVT.EVENT_PROBE, { eventId: point.eventId })
        return
      }
    }
  }
}
