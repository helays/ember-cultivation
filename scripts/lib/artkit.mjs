/**
 * L0 程序化素材生成公共设施 —— 瓦片（gen-tiles）、UI（gen-ui）、图标（gen-icons）共用。
 *
 * 为什么抽出来：三套生成器都要「读唯一真源色板 → 构造索引网格 → 写 PNG-8 → 自检」，
 * 复制三份必然漂移；色板语义常量、Bayer 抖动、确定性哈希、接缝指标又必须在各处**完全一致**，
 * 否则「无缝」只是各写各的巧合。
 *
 * 硬规则（见 doc/14 §2.2）：
 *  - 只产出 8 位索引色 PNG，调色板严格等于 src/assets/palette.json 的 16 条；
 *  - 索引 0 = 保留透明槽，瓦片禁止使用（UI / 图标允许）；
 *  - 禁止衍生色：明暗过渡只能用 Bayer 4×4 抖动在 15 个实色之间跳。
 *
 * 本文件只依赖 node 内置模块与 ./png.mjs（零第三方依赖，仓库无 package.json）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodeIndexedPng, paletteArrays } from './png.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PALETTE_FILE = path.join(ROOT, 'src', 'assets', 'palette.json')

/**
 * 语义索引常量 —— 与 palette.json 的 `code` 字段一一对应。
 * 代码里一律写 C.BRONZE 而不是 5：色板将来若调整顺序，只有这一处要改。
 */
export const C = Object.freeze({
  TRANSPARENT: 0, // 保留透明槽：瓦片禁用，UI/图标可用
  INK: 1, // 深墨青 —— 最暗部、描边、UI 底色
  TEAL_DARK: 2, // 暗青 —— 主基调：屋顶、阴影、面板底
  TEAL_MID: 3, // 青灰 —— 石材、过渡中间色
  MOSS: 4, // 苔绿 —— 植被、木构、苔痕
  BRONZE: 5, // 古铜 —— 铜器、UI 边框、暖光
  BRONZE_DARK: 6, // 暗铜 —— 铜器暗部、木质、泥土
  MOON: 7, // 月白 —— 月光、高光、正文
  STONE: 8, // 石灰 —— 石阶、瓦当、禁用态
  NIGHT_BLUE: 9, // 夜蓝 —— 夜色调、水面、鬼魂
  TALISMAN: 10, // 符纸黄 —— 符箓、灯笼、心境条
  SPIRIT: 11, // 灵光青 —— 灵力与阵纹专用
  BLOOD: 12, // 血色 —— 伤害、生命条
  EMBER: 13, // 暮橙 —— 火光、余烬
  FROST: 14, // 冷白 —— 高光、雪
  BRONZE_LIGHT: 15, // 铜高光 —— 金属亮阶、UI 描边高亮
})

/** 4×4 有序抖动矩阵：把「多一档亮度」摊成像素纹理，代替被禁用的衍生色 */
export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

/**
 * 确定性整数哈希 → [0,1)。同一 (x,y,seed) 永远同一结果，
 * 因此「随机」细节可复现，重跑字节一致（幂等要求）。
 */
export function hash2(x, y, seed) {
  let h = (x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Bayer 抖动二选一：level 0..16，越大越偏向 b（16 = 全 b，0 = 全 a） */
export function dither(a, b, x, y, level) {
  return BAYER4[y & 3][x & 3] < level ? b : a
}

/** 读取色板唯一真源，返回 encodeIndexedPng 需要的 palette/alpha 与语义信息 */
export function loadPalette() {
  const raw = JSON.parse(fs.readFileSync(PALETTE_FILE, 'utf8'))
  const entries = [...raw.entries].sort((a, b) => a.index - b.index)
  return {
    entries,
    transparentIndex: raw.transparentIndex ?? 0,
    solidCount: entries.filter((e) => e.alpha !== 0).length,
    ...paletteArrays(entries),
  }
}

/**
 * 写 PNG-8。始终带上 alpha 通道（索引 0 的 alpha = 0），
 * 这样瓦片（不用索引 0）与 UI/图标（用索引 0）走同一条编码路径。
 * @returns {number} 字节数
 */
export function writePng(absPath, sheet, pal) {
  const bytes = encodeIndexedPng({
    width: sheet.width,
    height: sheet.height,
    indices: sheet.indices,
    palette: pal.palette,
    alpha: pal.alpha,
  })
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  fs.writeFileSync(absPath, bytes)
  return bytes.length
}

/**
 * 由「行描述表」构造瓦片集。
 *
 * 无缝的做法（与 tileset-town-ground 一致）：图案只由 **模运算** 与哈希决定，
 * 且所有周期都能整除 32 —— 于是右边界接左边界、下边界接上边界天然连续，
 * 不需要拼接期修补。这也是为什么图案函数里禁止出现裸的 `Math.random`。
 *
 * @param {object} o
 * @param {number} o.cols 列数（变体数）
 * @param {number} o.rows 行数（地貌数）
 * @param {number} o.tile 单元格边长
 * @param {Array<{name:string, roles?:string[], fn:(x:number,y:number,seed:number,variant:number)=>number}>} o.rowsDef
 * @param {number} o.seedBase 该表的种子基（不同表用不同基，避免两张表长得一模一样）
 * @param {boolean} [o.allowTransparent] 是否允许索引 0（瓦片必须 false）
 */
export function buildSheet({ cols, rows, tile, rowsDef, seedBase, allowTransparent = false }) {
  if (rowsDef.length !== rows) throw new Error(`rowsDef ${rowsDef.length} != rows ${rows}`)
  const width = cols * tile
  const height = rows * tile
  const indices = new Uint8Array(width * height)

  for (let row = 0; row < rows; row++) {
    const def = rowsDef[row]
    for (let col = 0; col < cols; col++) {
      const seed = seedBase + row * 97 + col * 13
      for (let ty = 0; ty < tile; ty++) {
        for (let tx = 0; tx < tile; tx++) {
          const value = def.fn(tx, ty, seed, col)
          if (!Number.isInteger(value) || value < 0 || value > 15) {
            throw new Error(`${def.name} 第 ${col} 变体 (${tx},${ty}) 产出非法索引 ${value}`)
          }
          if (value === C.TRANSPARENT && !allowTransparent) {
            throw new Error(`瓦片禁止产出透明槽（${def.name} 第 ${col} 变体 (${tx},${ty})）`)
          }
          indices[(row * tile + ty) * width + col * tile + tx] = value
        }
      }
    }
  }
  return { width, height, indices }
}

/**
 * 接缝突变指标（与 scripts/check-assets.mjs 完全同一算法，便于本地先自查）：
 * 平铺后 **列边界**（x+1 能被 cell 整除处）的相邻像素差均值 ÷ 内部均值。
 * ≈1 表示接缝和内部一样平缓；> 2 说明边界有系统断层（check-assets 会判错）。
 */
export function seamRatio(indices, width, height, cell) {
  const at = (x, y) => indices[(y % height) * width + (x % width)]
  let b = 0
  let bc = 0
  let i = 0
  let ic = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.abs(at(x, y) - at(x + 1, y))
      if ((x + 1) % cell === 0) {
        b += d
        bc++
      } else {
        i += d
        ic++
      }
    }
  }
  return b / bc / (i / ic || 1)
}

/**
 * 解析「像素字符矩阵」为索引网格，字符集与 .px.txt 完全一致（见 lib/pixels.mjs）：
 * `.` → 0（透明）、`1`-`9` → 1-9、`a`-`f` → 10-15。
 * 行宽必须一致，否则抛错（手写图形最容易在这里错一位）。
 */
export function parseGrid(rows, origin = '<grid>') {
  const width = rows[0].length
  const height = rows.length
  const CHAR_TO_INDEX = new Map([...'.123456789abcdef'].map((c, i) => [c, i]))
  const indices = new Uint8Array(width * height)
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${origin}: 第 ${y} 行 ${row.length} 字符 ≠ 宽 ${width}`)
    for (let x = 0; x < width; x++) {
      const idx = CHAR_TO_INDEX.get(row[x])
      if (idx === undefined) throw new Error(`${origin}: 第 ${y} 行第 ${x} 列非法字符 '${row[x]}'`)
      indices[y * width + x] = idx
    }
  })
  return { width, height, indices }
}

/** 把 src 贴到 dst 的 (ox,oy)（越界像素丢弃；用于给图标留安全区/边距） */
export function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.height; y++) {
    const dy = oy + y
    if (dy < 0 || dy >= dst.height) continue
    for (let x = 0; x < src.width; x++) {
      const dx = ox + x
      if (dx < 0 || dx >= dst.width) continue
      dst.indices[dy * dst.width + dx] = src.indices[y * src.width + x]
    }
  }
  return dst
}

/** 纯色（或纯索引）画布，用于图标的背景出血与边距填充 */
export function solidSheet(width, height, index) {
  return { width, height, indices: new Uint8Array(width * height).fill(index) }
}

// ── 光栅小工具（全部越界即忽略）：物件/UI/图标都靠这几行画出来 ──────

/** 画一个点 */
export function put(sheet, x, y, v) {
  if (x < 0 || y < 0 || x >= sheet.width || y >= sheet.height) return
  sheet.indices[y * sheet.width + x] = v
}

/** 水平线段（x0/x1 可反序） */
export function hline(sheet, x0, x1, y, v) {
  const [a, b] = x0 <= x1 ? [x0, x1] : [x1, x0]
  for (let x = a; x <= b; x++) put(sheet, x, y, v)
}

/** 垂直线段 */
export function vline(sheet, x, y0, y1, v) {
  const [a, b] = y0 <= y1 ? [y0, y1] : [y1, y0]
  for (let y = a; y <= b; y++) put(sheet, x, y, v)
}

/** 实心矩形 */
export function rect(sheet, x0, y0, x1, y1, v) {
  const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0]
  const [ay, by] = y0 <= y1 ? [y0, y1] : [y1, y0]
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) put(sheet, x, y, v)
}

/** 1px 空心矩形（描边） */
export function frame(sheet, x0, y0, x1, y1, v) {
  hline(sheet, x0, x1, y0, v)
  hline(sheet, x0, x1, y1, v)
  vline(sheet, x0, y0, y1, v)
  vline(sheet, x1, y0, y1, v)
}

/** 索引直方图（自检用：用于断言某色确实出现 / 没出现） */
export function histogram(indices) {
  const hist = new Array(16).fill(0)
  for (const v of indices) hist[v]++
  return hist
}
