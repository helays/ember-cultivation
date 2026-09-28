import Phaser from 'phaser'
import { PALETTE, COLOR, LOGICAL_WIDTH } from '@/core/constants.js'
import { logger } from '@/core/logger.js'
import tilesetTownGround from '@/assets/tilesets/town/tileset-town-ground.png?url'
import tilesetTownBuilding from '@/assets/tilesets/town/tileset-town-building.png?url'
import tilesetTownDeco from '@/assets/tilesets/town/tileset-town-deco.png?url'
import tilesetWildGround from '@/assets/tilesets/wilderness/tileset-wilderness-ground.png?url'
import tilesetDunGround from '@/assets/tilesets/dungeon/tileset-dungeon-ground.png?url'
import tilesetDunWall from '@/assets/tilesets/dungeon/tileset-dungeon-wall.png?url'
import playerSheetUrl from '@/assets/sprites/player/sprite-player-walk-4dir.png?url'
import vfxHuoQiuUrl from '@/assets/vfx/skills/vfx-skill-huo-qiu.png?url'
import particleSpiritUrl from '@/assets/vfx/particles/particle-spirit.png?url'
import framePanelUrl from '@/assets/ui/frames/ui-frame-panel-9slice.png?url'
import frameDialogUrl from '@/assets/ui/frames/ui-frame-dialog-9slice.png?url'
import barHpUrl from '@/assets/ui/bars/ui-bar-hp.png?url'
import barMpUrl from '@/assets/ui/bars/ui-bar-mp.png?url'
import barMindUrl from '@/assets/ui/bars/ui-bar-mind.png?url'
import barExpUrl from '@/assets/ui/bars/ui-bar-exp.png?url'
import btnNormalUrl from '@/assets/ui/buttons/ui-btn-primary-normal.png?url'
import btnHoverUrl from '@/assets/ui/buttons/ui-btn-primary-hover.png?url'
import btnActiveUrl from '@/assets/ui/buttons/ui-btn-primary-active.png?url'
import btnDisabledUrl from '@/assets/ui/buttons/ui-btn-primary-disabled.png?url'
import iconDanHuiqi from '@/assets/ui/icons/icon-item-dan-huiqi.png?url'
import iconFuQixie from '@/assets/ui/icons/icon-item-fu-qixie.png?url'
import iconFacKunlun from '@/assets/ui/icons/icon-fac-kunlun.png?url'
import iconFacJiejiao from '@/assets/ui/icons/icon-fac-jiejiao.png?url'
import iconFacMaoshan from '@/assets/ui/icons/icon-fac-maoshan.png?url'
import iconFacYao from '@/assets/ui/icons/icon-fac-yao.png?url'
import iconFacCourt from '@/assets/ui/icons/icon-fac-court.png?url'
import iconFacSanxiu from '@/assets/ui/icons/icon-fac-sanxiu.png?url'

// Debug-only gallery for every produced asset (doc/14 §4.4). Never bundled
// into production builds: registration is guarded by import.meta.env.DEV
// in src/main.js, and the scene file itself is only dynamically imported.
const TILESETS = [
  'tileset-town-ground',
  'tileset-town-building',
  'tileset-town-deco',
  'tileset-wilderness-ground',
  'tileset-dungeon-ground',
  'tileset-dungeon-wall',
]

const TEXTURE_URLS = {
  'tileset-town-ground': tilesetTownGround,
  'tileset-town-building': tilesetTownBuilding,
  'tileset-town-deco': tilesetTownDeco,
  'tileset-wilderness-ground': tilesetWildGround,
  'tileset-dungeon-ground': tilesetDunGround,
  'tileset-dungeon-wall': tilesetDunWall,
  'player-walk': playerSheetUrl,
  'vfx-skill-huo-qiu': vfxHuoQiuUrl,
  'particle-spirit': particleSpiritUrl,
  'ui-frame-panel-9slice': framePanelUrl,
  'ui-frame-dialog-9slice': frameDialogUrl,
  'ui-bar-hp': barHpUrl,
  'ui-bar-mp': barMpUrl,
  'ui-bar-mind': barMindUrl,
  'ui-bar-exp': barExpUrl,
  'ui-btn-primary-normal': btnNormalUrl,
  'ui-btn-primary-hover': btnHoverUrl,
  'ui-btn-primary-active': btnActiveUrl,
  'ui-btn-primary-disabled': btnDisabledUrl,
  'icon-item-dan-huiqi': iconDanHuiqi,
  'icon-item-fu-qixie': iconFuQixie,
  'icon-fac-kunlun': iconFacKunlun,
  'icon-fac-jiejiao': iconFacJiejiao,
  'icon-fac-maoshan': iconFacMaoshan,
  'icon-fac-yao': iconFacYao,
  'icon-fac-court': iconFacCourt,
  'icon-fac-sanxiu': iconFacSanxiu,
}

const SCROLL_SPEED = 260

export class AssetPreviewScene extends Phaser.Scene {
  constructor() {
    super('AssetPreviewScene')
  }

  preload() {
    this.load.spritesheet('player-walk', TEXTURE_URLS['player-walk'], { frameWidth: 32, frameHeight: 48 })
    this.load.spritesheet('vfx-skill-huo-qiu', TEXTURE_URLS['vfx-skill-huo-qiu'], { frameWidth: 64, frameHeight: 64 })
    for (const [key, url] of Object.entries(TEXTURE_URLS)) {
      if (key === 'player-walk' || key === 'vfx-skill-huo-qiu') continue
      this.load.image(key, url)
    }
  }

  create() {
    const ink = PALETTE[COLOR.INK].hex
    this.cameras.main.setBackgroundColor(ink)

    this.label('素材测试场景 AssetPreview（` 返回世界 · ↑↓ 滚动 · R 取色检查）', 16, 10)
    this.buildZoneA(56)
    this.buildZoneB(210)
    this.buildZoneC(330)
    this.buildZoneD(590)
    this.buildZoneE(680)
    this.buildZoneF(800)

    const totalHeight = 900
    this.cameras.main.setBounds(0, 0, LOGICAL_WIDTH, totalHeight)
    this.cursors = this.input.keyboard.createCursorKeys()
    this.keys = this.input.keyboard.addKeys('W,S,R')

    // Backtick returns to the world session stored on game.registry.
    this.input.keyboard.on('keydown-BACKTICK', () => {
      this.scene.start('WorldScene', { state: this.game.registry.get('session') })
    })
    this.keys.R.on('down', () => this.runPaletteAudit())
    logger.info('AssetPreviewScene', 'ready (dev only)')
  }

  update(time, delta) {
    const cam = this.cameras.main
    const dt = delta / 1000
    if (this.cursors.up.isDown || this.keys.W.isDown) cam.scrollY -= SCROLL_SPEED * dt
    if (this.cursors.down.isDown || this.keys.S.isDown) cam.scrollY += SCROLL_SPEED * dt
  }

  label(text, x, y, size = 12, color) {
    return this.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: `${size}px`,
      color: color ?? PALETTE[COLOR.MOON].hex,
      resolution: 1,
    })
  }

  /** Missing assets must be visible, never silent (doc/14 §4.4). */
  imageOrPlaceholder(key, x, y, scale = 1) {
    if (this.textures.exists(key)) {
      return this.add.image(x, y, key).setScale(scale).setOrigin(0, 0)
    }
    const box = this.add.rectangle(x + 16, y + 16, 32, 32, 0x0d1f27)
      .setStrokeStyle(1, 0x8f2b2b)
      .setOrigin(0, 0)
    this.label(key, x + 2, y + 34, 10, PALETTE[COLOR.MOON].hex)
    return box
  }

  // ── A 区：瓦片平铺墙（3×3，含接缝检查） ──
  buildZoneA(y) {
    this.label('A · 瓦片平铺（3×3，四向接缝）', 16, y)
    TILESETS.forEach((key, i) => {
      const x = 18 + i * 102
      this.label(key.replace('tileset-', ''), x, y + 16, 9, PALETTE[COLOR.STONE].hex)
      if (!this.textures.exists(key)) {
        this.imageOrPlaceholder(key, x, y + 28)
        return
      }
      const rt = this.add.renderTexture(x, y + 28, 96, 96)
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          rt.draw(key, col * 32, row * 32, row * 4 + col)
        }
      }
    })
  }

  // ── B 区：动画跑马灯（全角色精灵 8fps） ──
  buildZoneB(y) {
    this.label('B · 动画跑马灯（帧对齐 / 朝向 / 特效位移漂移）', 16, y)
    const dirs = ['down', 'left', 'right', 'up']
    dirs.forEach((dir, i) => {
      const x = 48 + i * 90
      const key = `preview-player-${dir}`
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers('player-walk', { start: i * 4, end: i * 4 + 3 }),
          frameRate: 8,
          repeat: -1,
        })
      }
      if (this.textures.exists('player-walk')) {
        const sprite = this.add.sprite(x, y + 50, 'player-walk', i * 4).setOrigin(0.5, 1)
        sprite.play(key)
        this.label(dir, x - 12, y + 56, 10)
      } else {
        this.imageOrPlaceholder('player-walk', x - 16, y + 10)
      }
    })
  }

  // ── C 区：UI 组件墙 ──
  buildZoneC(y) {
    this.label('C · UI 组件墙（九宫格 / 状态条 / 按钮四态 / 图标）', 16, y)
    this.imageOrPlaceholder('ui-frame-panel-9slice', 20, y + 18, 2)
    this.imageOrPlaceholder('ui-frame-dialog-9slice', 130, y + 18, 2)
    this.label('panel / dialog（2×）', 20, y + 122, 9, PALETTE[COLOR.STONE].hex)

    const bars = ['ui-bar-hp', 'ui-bar-mp', 'ui-bar-mind', 'ui-bar-exp']
    bars.forEach((key, i) => {
      this.imageOrPlaceholder(key, 240, y + 20 + i * 20, 1)
    })
    this.label('bars（1×）', 240, y + 104, 9, PALETTE[COLOR.STONE].hex)

    const buttons = ['ui-btn-primary-normal', 'ui-btn-primary-hover', 'ui-btn-primary-active', 'ui-btn-primary-disabled']
    buttons.forEach((key, i) => {
      this.imageOrPlaceholder(key, 360, y + 20 + i * 22, 1)
    })
    this.label('按钮四态', 360, y + 104, 9, PALETTE[COLOR.STONE].hex)

    const icons = [
      'icon-item-dan-huiqi', 'icon-item-fu-qixie',
      'icon-fac-kunlun', 'icon-fac-jiejiao', 'icon-fac-maoshan',
      'icon-fac-yao', 'icon-fac-court', 'icon-fac-sanxiu',
    ]
    icons.forEach((key, i) => {
      const x = 480 + (i % 2) * 76
      const yy = y + 18 + Math.floor(i / 2) * 44
      this.imageOrPlaceholder(key, x, yy, 1)
    })
    this.label('图标 8 件', 480, y + 196, 9, PALETTE[COLOR.STONE].hex)
  }

  // ── D 区：特效播放器 ──
  buildZoneD(y) {
    this.label('D · 特效播放器（帧数 / 色板）', 16, y)
    if (this.textures.exists('vfx-skill-huo-qiu')) {
      if (!this.anims.exists('preview-vfx-huo-qiu')) {
        this.anims.create({
          key: 'preview-vfx-huo-qiu',
          frames: this.anims.generateFrameNumbers('vfx-skill-huo-qiu', { start: 0, end: 7 }),
          frameRate: 10,
          repeat: -1,
        })
      }
      this.add.sprite(64, y + 40, 'vfx-skill-huo-qiu').play('preview-vfx-huo-qiu')
      this.label('vfx-skill-huo-qiu ×8', 24, y + 66, 9, PALETTE[COLOR.STONE].hex)
    } else {
      this.imageOrPlaceholder('vfx-skill-huo-qiu', 24, y + 10)
    }
    this.imageOrPlaceholder('particle-spirit', 200, y + 14, 2)
    this.label('particle-spirit（2×）', 200, y + 84, 9, PALETTE[COLOR.STONE].hex)
  }

  // ── E 区：昼夜对比 ──
  buildZoneE(y) {
    this.label('E · 昼夜对比（夜间可读性）', 16, y)
    const modes = [
      { name: '昼', tint: 0xffffff, overlay: 0x000000, alpha: 0 },
      { name: '暮', tint: 0xd9b890, overlay: 0xc9713a, alpha: 0.18 },
      { name: '夜', tint: 0x9aa8c0, overlay: 0x5a6a9a, alpha: 0.45 },
    ]
    modes.forEach((mode, i) => {
      const x = 20 + i * 130
      if (!this.textures.exists('tileset-town-ground')) {
        this.imageOrPlaceholder('tileset-town-ground', x, y + 18)
        return
      }
      const rt = this.add.renderTexture(x, y + 18, 96, 96).setTint(mode.tint)
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          rt.draw('tileset-town-ground', col * 32, row * 32, row * 4 + col)
        }
      }
      if (mode.alpha > 0) {
        this.add.rectangle(x + 48, y + 66, 96, 96, mode.overlay, mode.alpha)
      }
      this.label(mode.name, x + 40, y + 118, 12)
    })
  }

  // ── F 区：色板取色器 ──
  buildZoneF(y) {
    this.label('F · 色板取色器（16 色 · R 键审计当前画面）', 16, y)
    PALETTE.forEach((entry) => {
      const x = 18 + entry.index * 36
      this.add.rectangle(x, y + 22, 32, 24, Phaser.Display.Color.HexStringToColor(entry.hex).color)
      this.add.rectangle(x + 16, y + 34, 32, 12, entry.alpha === 0 ? 0x000000 : Phaser.Display.Color.HexStringToColor(entry.hex).color)
      this.label(String(entry.index), x + 12, y + 40, 8, entry.index === 7 ? '#0d1f27' : '#e8e6dc')
    })
    this.auditText = this.label('按 R 采样当前画面，统计色板外像素（口径见 doc/14 §2.2）', 18, y + 64, 11)
  }

  /** Snapshot the canvas and count pixels outside the 16-color palette (tolerance applied). */
  runPaletteAudit() {
    this.game.renderer.snapshot((image) => {
      try {
        // The snapshot callback receives an <img>; rasterize it before reading pixels.
        const canvas = document.createElement('canvas')
        canvas.width = image.width || image.naturalWidth
        canvas.height = image.height || image.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(image, 0, 0)
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        const tol = 12
        const near = (r, g, b) => PALETTE.some(
          (p) => Math.abs(p.rgb[0] - r) <= tol && Math.abs(p.rgb[1] - g) <= tol && Math.abs(p.rgb[2] - b) <= tol,
        )
        let bad = 0
        let opaque = 0
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 16) continue
          opaque += 1
          if (!near(data[i], data[i + 1], data[i + 2])) bad += 1
        }
        const ratio = opaque ? ((bad / opaque) * 100).toFixed(2) : '0.00'
        this.auditText?.setText(`审计：不透明像素 ${opaque}，色板外 ${bad}（${ratio}%）——文本抗锯齿与缩放插值会计入，非 0 时优先查素材`)
      } catch (err) {
        this.auditText?.setText(`审计失败：${err.message}`)
      }
    })
  }
}
