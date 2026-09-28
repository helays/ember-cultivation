/**
 * 自动生成文件 —— 请勿手改。
 * 真源：src/assets/palette.json
 * 重新生成：node scripts/gen-palette.mjs
 *
 * 本文件同时提供：
 *  - PALETTE       完整 16 条索引色（含透明槽），供渲染与取色校验使用
 *  - COLOR         按语义名取索引，供 Phaser 特效 tint 与 UI 取色使用
 *  - 通用常量      集中所有魔法数字（doc/00 §七「唯一实现处」）
 */

export const TRANSPARENT_INDEX = 0

export const PALETTE = [
  { index:  0, code: 'TRANSPARENT', name: '透明槽'   , hex: '#0d1f27', rgb: [13, 31, 39], alpha: 0, usage: '保留索引，alpha 恒为 0。仅雪碧图/UI/图标/特效用；瓦片禁止使用。' },
  { index:  1, code: 'INK', name: '深墨青'   , hex: '#0d1f27', rgb: [13, 31, 39], alpha: 255, usage: '最暗部、角色描边、夜间遮挡、UI 底色' },
  { index:  2, code: 'TEAL_DARK', name: '暗青'    , hex: '#1d3b45', rgb: [29, 59, 69], alpha: 255, usage: '主基调：屋顶、石板阴影、面板底、树木暗部' },
  { index:  3, code: 'TEAL_MID', name: '青灰'    , hex: '#38565c', rgb: [56, 86, 92], alpha: 255, usage: '石材、远景、雾层、过渡中间色' },
  { index:  4, code: 'MOSS', name: '苔绿'    , hex: '#3f5d3a', rgb: [63, 93, 58], alpha: 255, usage: '植被、灵田、木构、苔痕' },
  { index:  5, code: 'BRONZE', name: '古铜'    , hex: '#8c6a3f', rgb: [140, 106, 63], alpha: 255, usage: '第二主色：铜器、门环、UI 边框、暖光反射' },
  { index:  6, code: 'BRONZE_DARK', name: '暗铜'    , hex: '#5c4327', rgb: [92, 67, 39], alpha: 255, usage: '铜器暗部、木质家具、地面泥土' },
  { index:  7, code: 'MOON', name: '月白'    , hex: '#e8e6dc', rgb: [232, 230, 220], alpha: 255, usage: '第三主色：月光、高光、正文文字、布衣' },
  { index:  8, code: 'STONE', name: '石灰'    , hex: '#6b7570', rgb: [107, 117, 112], alpha: 255, usage: '中性色：石阶、瓦当、UI 次要文字、禁用态' },
  { index:  9, code: 'NIGHT_BLUE', name: '夜蓝'    , hex: '#2a3a5c', rgb: [42, 58, 92], alpha: 255, usage: '夜色调：夜间 tint 基色、鬼魂、水面夜色' },
  { index: 10, code: 'TALISMAN', name: '符纸黄'   , hex: '#e0c070', rgb: [224, 192, 112], alpha: 255, usage: '符箓、纸灯、灯笼、暖色点缀、心境条' },
  { index: 11, code: 'SPIRIT', name: '灵光青'   , hex: '#4fd1c5', rgb: [79, 209, 197], alpha: 255, usage: '灵力与阵纹专用：灵力条、法术光、秘境机关' },
  { index: 12, code: 'BLOOD', name: '血色'    , hex: '#8f2b2b', rgb: [143, 43, 43], alpha: 255, usage: '伤害、危险提示、生命条、僵尸与妖鬼点缀' },
  { index: 13, code: 'EMBER', name: '暮橙'    , hex: '#c9713a', rgb: [201, 113, 58], alpha: 255, usage: '火光、余烬、灯笼、暮色（原「例外通道」色正式入板）' },
  { index: 14, code: 'FROST', name: '冷白'    , hex: '#d9e8ea', rgb: [217, 232, 234], alpha: 255, usage: '高光、雪、月白的亮阶（原「例外通道」色正式入板）' },
  { index: 15, code: 'BRONZE_LIGHT', name: '铜高光'   , hex: '#b08a52', rgb: [176, 138, 82], alpha: 255, usage: '金属亮阶、古铜高光、UI 描边高亮' },
]

/** 语义名 → 调色板索引 */
export const COLOR = {
  INK: 1,
  TEAL_DARK: 2,
  TEAL_MID: 3,
  MOSS: 4,
  BRONZE: 5,
  BRONZE_DARK: 6,
  MOON: 7,
  STONE: 8,
  NIGHT_BLUE: 9,
  TALISMAN: 10,
  SPIRIT: 11,
  BLOOD: 12,
  EMBER: 13,
  FROST: 14,
  BRONZE_LIGHT: 15,
}

export const PALETTE_HEX = PALETTE.map((p) => p.hex)
export const PALETTE_RGB = PALETTE.map((p) => p.rgb)

/** 渲染与取色校验用：不含透明槽的实色索引 */
export const OPAQUE_INDEXES = PALETTE.filter((p) => p.alpha !== 0).map((p) => p.index)

// ── 通用常量（其余模块禁止自行硬编码）──────────────────────────────
export const TILE_SIZE = 32
export const SPRITE_WALK = { width: 32, height: 48 }
export const SPRITE_BATTLE = { width: 48, height: 48 }
export const PLAYER_SPEED = 140
export const ENCOUNTER_RADIUS = 60
export const TIME_STEPS_PER_SHI = 180
export const LOGICAL_WIDTH = 640
export const LOGICAL_HEIGHT = 360
