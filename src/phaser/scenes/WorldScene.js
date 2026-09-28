import Phaser from 'phaser'
import { bus, EVT } from '@/core/bus.js'
import { TILE_SIZE } from '@/core/constants.js'
import { composeSave, writeSlot } from '@/core/saveManager.js'
import { logger } from '@/core/logger.js'
import { MapLoader } from '../systems/MapLoader.js'
import { MovementSystem } from '../systems/MovementSystem.js'
import { EncounterSystem } from '../systems/EncounterSystem.js'
import { TimeSystem, defaultTime } from '../systems/TimeSystem.js'
import { Player } from '../entities/Player.js'

// Exploration scene: map, free movement, encounter placeholder, day/night
// tint and the world-freeze side of the save flow (doc/15 §2.2).
export class WorldScene extends Phaser.Scene {
  constructor() {
    super('WorldScene')
  }

  init(data) {
    // Restore from game:start data, or from the registry when returning
    // from the dev-only AssetPreviewScene.
    this.session = data?.state ?? this.game.registry.get('session') ?? null
    if (data?.state) this.game.registry.set('session', data.state)
  }

  preload() {
    this.mapLoader = new MapLoader(this)
    this.mapLoader.preload(this.session?.location ?? 'map-qingyun')
    Player.preload(this)
  }

  create() {
    this.frozen = false

    const loaded = this.mapLoader.create(this.session?.location ?? 'map-qingyun')
    this.mapData = loaded

    const spawn = this.session?.position ?? loaded.playerSpawn
    this.player = new Player(this, spawn.x, spawn.y, spawn.facing)
    this.physics.add.collider(this.player, loaded.wallGroup)

    this.movement = new MovementSystem(this, this.player, loaded.waterRects)
    this.timeSystem = new TimeSystem(this.session?.time ?? defaultTime())
    this.timeSystem.onShichenChange = (time) => this.applyDayNight(time)
    this.encounterSystem = new EncounterSystem(this, this.player, loaded.encounterZones)

    const cam = this.cameras.main
    cam.setBounds(0, 0, loaded.pixelWidth, loaded.pixelHeight)
    cam.startFollow(this.player, true, 0.12, 0.12)

    // Day/night tint placeholder (doc/15 §2.2): none by day, #5a6a9a @0.45 by night.
    this.nightTint = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x5a6a9a, 0.45)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(50)
    this.applyDayNight(this.timeSystem.snapshot())

    // Save flow: freeze -> compose payload (Vue stores) -> inject live
    // position/time -> write -> announce (doc/12 §10.2).
    bus.on(EVT.SAVE_REQUEST, this.onSaveRequest)

    // Dev-only shortcut into the asset gallery (doc/14 §4.4).
    if (import.meta.env.DEV) {
      this.input.keyboard.on('keydown-BACKTICK', () => this.scene.start('AssetPreviewScene'))
    }

    this.scene.launch('UIScene')
    logger.info('WorldScene', `world ready at ${loaded.mapName}`)
  }

  applyDayNight(time) {
    this.nightTint?.setVisible(TimeSystem.isNight(time))
  }

  /** E-key interaction: nearest interact object with a savePoint opens the panel. */
  tryInteract() {
    if (this.frozen) return
    const body = this.player.body.center
    for (const obj of this.mapData.interactables) {
      const cx = obj.x + obj.width / 2
      const cy = obj.y + obj.height / 2
      const dist = Phaser.Math.Distance.Between(body.x, body.y, cx, cy)
      if (dist <= TILE_SIZE * 1.5 && obj.props?.savePoint) {
        bus.emit(EVT.MENU_TOGGLE, { menu: 'save' })
        return
      }
    }
  }

  freeze() {
    if (this.frozen) return
    this.frozen = true
    this.physics.world.pause()
    this.timeSystem.pause()
  }

  unfreeze() {
    if (!this.frozen) return
    this.frozen = false
    this.physics.world.resume()
    this.timeSystem.resume()
  }

  onSaveRequest = ({ slot }) => {
    this.freeze()
    const payload = composeSave()
    if (payload) {
      const body = this.player.body.center
      payload.player.position = {
        x: Math.round(body.x * 10) / 10,
        y: Math.round(body.y * 10) / 10,
        facing: this.player.facing,
      }
      payload.player.time = this.timeSystem.snapshot()
      const mapName = this.mapData?.mapName
      if (mapName) payload.saveName = `${payload.player.realm}${payload.player.stage}·${mapName}`
    }
    writeSlot(slot, payload)
      .then((result) => {
        bus.emit(EVT.SAVE_WRITTEN, { slot, ok: result.ok, rev: result.rev })
        this.unfreeze()
      })
      .catch((err) => {
        logger.error('WorldScene', 'writeSlot threw', err)
        bus.emit(EVT.SAVE_WRITTEN, { slot, ok: false })
        this.unfreeze()
      })
  }

  update(time, delta) {
    this.movement?.update(delta)
    this.encounterSystem?.update()
  }
}
