import Phaser from 'phaser'
import mapQingyunUrl from '@/data/maps/map-qingyun.json?url'
import mapHoushanUrl from '@/data/maps/map-houshan.json?url'
import mapLuanzangUrl from '@/data/maps/map-luanzang.json?url'
import townGroundUrl from '@/assets/tilesets/town/tileset-town-ground.png?url'
import townBuildingUrl from '@/assets/tilesets/town/tileset-town-building.png?url'
import townDecoUrl from '@/assets/tilesets/town/tileset-town-deco.png?url'
import wildGroundUrl from '@/assets/tilesets/wilderness/tileset-wilderness-ground.png?url'
import dunGroundUrl from '@/assets/tilesets/dungeon/tileset-dungeon-ground.png?url'
import dunWallUrl from '@/assets/tilesets/dungeon/tileset-dungeon-wall.png?url'

// Tiled map loader (doc/10 §2): layers are matched BY NAME, never by index.
// M1 keeps a static registry of known maps; the config-table registry
// (core/registry.js) generalizes this in M4.

const TILE_LAYERS = ['ground', 'detail', 'building', 'overhead']
const OBJECT_LAYERS = ['collision', 'interact', 'spawn', 'event', 'encounter']
const TILE_FALLBACK = 32

const MAPS = {
  'map-qingyun': {
    url: mapQingyunUrl,
    tilesets: {
      'town-ground': townGroundUrl,
      'town-building': townBuildingUrl,
      'town-deco': townDecoUrl,
    },
  },
  'map-houshan': {
    url: mapHoushanUrl,
    tilesets: {
      'wilderness-ground': wildGroundUrl,
      'town-building': townBuildingUrl,
      'town-deco': townDecoUrl,
    },
  },
  'map-luanzang': {
    url: mapLuanzangUrl,
    tilesets: {
      'dungeon-ground': dunGroundUrl,
      'dungeon-wall': dunWallUrl,
      'town-deco': townDecoUrl,
    },
  },
}

function propsOf(tiledObject) {
  const out = {}
  for (const prop of tiledObject.properties ?? []) {
    out[prop.name] = prop.value
  }
  return out
}

export class MapLoader {
  constructor(scene) {
    this.scene = scene
  }

  preload(location) {
    const def = MAPS[location]
    if (!def) throw new Error(`unknown map: ${location}`)
    this.scene.load.tilemapTiledJSON(location, def.url)
    for (const [name, url] of Object.entries(def.tilesets)) {
      this.scene.load.image(name, url)
    }
  }

  /** Build all layers and bodies; returns the data WorldScene needs. */
  create(location) {
    const map = this.scene.make.tilemap({ key: location })
    const addedTilesets = []
    for (const ts of map.tilesets ?? []) {
      addedTilesets.push(map.addTilesetImage(ts.name, ts.name))
    }

    const layers = {}
    for (const name of TILE_LAYERS) {
      const layer = map.createLayer(name, addedTilesets, 0, 0)
      if (!layer) throw new Error(`map ${location}: missing tile layer "${name}"`)
      layers[name] = layer
    }
    layers.ground.setDepth(0)
    layers.detail.setDepth(1)
    layers.building.setDepth(2)
    layers.overhead.setDepth(10)

    // Object layers (doc/10 §2): collision / interact / spawn / event / encounter.
    const wallGroup = this.scene.physics.add.staticGroup()
    const waterRects = []
    const triggers = []
    const interactables = []
    const encounterZones = []
    const events = []
    let playerSpawn = null

    const collisionObjects = map.getObjectLayer('collision')?.objects ?? []
    for (const obj of collisionObjects) {
      const kind = obj.type || propsOf(obj).collision || 'wall'
      const rect = new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width, obj.height)
      if (kind === 'water') {
        waterRects.push(rect)
      } else if (kind === 'trigger') {
        // Triggers never block (doc/02 §2.2); portals consume them (M5).
        triggers.push({ x: obj.x, y: obj.y, width: obj.width, height: obj.height, props: propsOf(obj), name: obj.name })
        continue
      } else {
        const body = this.scene.add.rectangle(
          obj.x + obj.width / 2,
          obj.y + obj.height / 2,
          obj.width,
          obj.height,
        )
        body.setVisible(false)
        this.scene.physics.add.existing(body, true)
        wallGroup.add(body)
      }
    }

    for (const obj of map.getObjectLayer('interact')?.objects ?? []) {
      interactables.push({
        x: obj.x,
        y: obj.y,
        width: obj.width ?? TILE_FALLBACK,
        height: obj.height ?? TILE_FALLBACK,
        name: obj.name,
        props: propsOf(obj),
      })
    }

    const spawns = []
    for (const obj of map.getObjectLayer('spawn')?.objects ?? []) {
      const point = { x: obj.x, y: obj.y, name: obj.name, from: propsOf(obj).from ?? null }
      spawns.push(point)
      if (obj.name === 'player-spawn') playerSpawn = point
    }

    for (const obj of map.getObjectLayer('event')?.objects ?? []) {
      events.push({ x: obj.x, y: obj.y, name: obj.name, eventId: propsOf(obj).eventId ?? obj.name })
    }

    for (const obj of map.getObjectLayer('encounter')?.objects ?? []) {
      const props = propsOf(obj)
      if (obj.polygon) {
        const points = obj.polygon.map((p) => new Phaser.Geom.Point(obj.x + p.x, obj.y + p.y))
        encounterZones.push({ polygon: new Phaser.Geom.Polygon(points), table: props.encounterTable ?? null })
      } else {
        encounterZones.push({ x: obj.x, y: obj.y, table: props.encounterTable ?? null })
      }
    }

    if (!playerSpawn) throw new Error(`map ${location}: missing "player-spawn" object`)

    const mapName = (map.properties ?? []).find?.((p) => p.name === 'displayName')?.value ?? location

    return {
      map,
      layers,
      wallGroup,
      waterRects,
      triggers,
      interactables,
      events,
      spawns,
      encounterZones,
      playerSpawn,
      mapName,
      pixelWidth: map.widthInPixels,
      pixelHeight: map.heightInPixels,
    }
  }
}
