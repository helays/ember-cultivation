#!/usr/bin/env node
/**
 * L0 程序化 UI 素材生成（九宫格边框 / 状态条 / 按钮四态）。
 *
 * 产出与尺寸严格对齐 src/assets/assets.manifest.json 的 spec（清单是只读真源）：
 *   ui-frame-panel-9slice   48×48   九宫格边距 16px
 *   ui-frame-dialog-9slice  48×48   九宫格边距 16px
 *   ui-bar-hp / mp / mind   64×8
 *   ui-btn-primary-{normal,hover,active,disabled}  48×16
 *
 * ── 九宫格边距 ──────────────────────────────────────────────────
 * **margin = 16**：四角各 16×16（固定不拉伸）、四边中段 16px（沿一个方向平铺）、中心 16×16（双向平铺）。
 * 取值依据：assets.manifest.json 的 `spec.nineSlice: 16`。
 * 注意 doc/14 §8.2 写的「四角 32px / 四边 24px」与清单不一致 —— 清单是素材真源，且 doc 不在本任务可写范围内，
 * 故此处以清单为准，并把差异留在注释里，等文档侧对齐。
 *
 * ── 为什么九宫格一定可平铺 ──────────────────────────────────────
 * 整幅图由一个「距最近边的层数 ring」函数生成：
 *   ring = min(x, y, W-1-x, H-1-y)
 * 于是上下边中段的像素**只与 y 有关、与 x 无关**（同理左右边只与 x 有关）→ 沿边方向天然周期 1；
 * 中心与边中段的木纹用 `x % 4`（4 整除 16）→ 周期 4。两者都整除 16，所以四边与中心都能 1px 平铺。
 * 脚本末尾还会用 `checkNineSlice()` 把这条性质**实测一遍**（不是靠注释保证）。
 *
 * ── 透明（索引 0）的使用 ────────────────────────────────────────
 * UI 允许索引 0。这里只在**四角倒角**上使用：角上 2px 斜切，让面板/按钮叠在世界画面上时不是硬直角。
 * 面板中心**故意做成不透明的暗青木纹底**（不做镂空）：UI 面板的作用是遮挡底层世界画面，
 * 中心若透明会让地图透出来、且要额外叠一层底板；需要镂空风格的浮窗应另出一份素材，而不是改这一张。
 *
 * 硬规则：PNG-8 索引色，调色板严格等于 palette.json 16 条（走 lib/artkit.mjs 的唯一写入口）。
 * 幂等：纯函数 + 固定参数，无随机数，重跑字节一致。
 *
 * 用法：node scripts/gen-ui.mjs
 */

import path from 'node:path'
import { C, ROOT, dither, loadPalette, writePng } from './lib/artkit.mjs'

const NINE_SLICE = 16 // 九宫格边距：与 manifest spec.nineSlice 一致
const GRAIN_PERIOD = 4 // 木纹周期，必须整除 16（九宫格边中段/中心的宽度）

// ══════════════════════════════════════════════════════════════════
// 材质片段
// ══════════════════════════════════════════════════════════════════

/**
 * 暗青木纹底：竖木纹（周期 4）。
 * 不再加「横向木节」之类的 y 方向花纹：左右边中段只有 16px 高，任何 y 方向花纹的周期都必须整除 4，
 * 否则边中段纵向就不平铺了 —— 这是 checkNineSlice 会当场抓出来的错（第一版就是这么被抓的）。
 */
function woodGrain(x, y) {
  const g = x % GRAIN_PERIOD
  if (g === 0) return C.INK // 木纹线
  if (g === 1) return dither(C.TEAL_DARK, C.INK, x, y, 6) // 纹旁过渡（Bayer 抖动，非衍生色；只在 y%4===1 行变暗，周期仍是 4）
  void y
  return C.TEAL_DARK
}

/** 四角 2px 斜切（唯一的索引用途：让边框不是硬直角） */
function isChamfered(x, y, w, h) {
  return x + y < 2 || w - 1 - x + y < 2 || x + (h - 1 - y) < 2 || w - 1 - x + (h - 1 - y) < 2
}

/**
 * 通用面板：古铜包边 + 暗青木纹底 + 符纸黄细描线。
 * ring 0 深墨青外形线 / ring 1-2 古铜 / ring 3 受光或背光棱（左上亮、右下暗）/ ring 4 符纸黄细线 / 其余木纹。
 */
function panelFrame(x, y, w, h) {
  if (isChamfered(x, y, w, h)) return C.TRANSPARENT
  const dl = x
  const dr = w - 1 - x
  const dt = y
  const db = h - 1 - y
  const ring = Math.min(dl, dr, dt, db)
  const m = ring
  const side = m === dt ? 'top' : m === db ? 'bottom' : m === dl ? 'left' : 'right'
  if (ring === 0) return C.INK
  if (ring === 1 || ring === 2) return C.BRONZE
  if (ring === 3) return side === 'bottom' || side === 'right' ? C.BRONZE_DARK : C.BRONZE_LIGHT
  if (ring === 4) return C.TALISMAN
  return woodGrain(x, y)
}

/**
 * 对话框：更窄的边 + 更亮的描边。
 * ring 0 深墨青 / ring 1 铜高光（亮描边）/ ring 2 符纸黄细线 / 其余木纹 —— 3px 边，比面板窄 2px。
 */
function dialogFrame(x, y, w, h) {
  if (isChamfered(x, y, w, h)) return C.TRANSPARENT
  const ring = Math.min(x, w - 1 - x, y, h - 1 - y)
  if (ring === 0) return C.INK
  if (ring === 1) return C.BRONZE_LIGHT
  if (ring === 2) return C.TALISMAN
  return woodGrain(x, y)
}

// ══════════════════════════════════════════════════════════════════
// 状态条（64×8）
// ══════════════════════════════════════════════════════════════════

/**
 * 状态条：深墨青槽壁（上下左右各 1px）+ 填充段 + 顶部 1px 高光行 + 底部 1px 压暗行，
 * 最右列 x=63 是**填充末端的 1px 高光**（按数值裁剪时正好落在填充右缘）。
 * 填充分两段硬色块（fill + 压暗），不用渐变（doc/14 §8.3）。
 * 竖向纹理周期 8，64 % 8 === 0 → 需要更长的条时按 8px 整数倍拉伸不会破纹。
 */
function barArt(fill, highlight) {
  return (x, y, w, h) => {
    if (y === 0 || y === h - 1 || x === 0) return C.INK // 槽壁
    if (x === w - 1) return highlight // 填充末端 1px 高光
    if (y === 1) return dither(fill, highlight, x, y, 6) // 顶光行
    if (y === h - 2) return dither(fill, C.INK, x, y, 5) // 底部压暗
    if (x % 8 === 4) return dither(fill, C.INK, x, y, 5) // 竖向纹
    return fill
  }
}

// ══════════════════════════════════════════════════════════════════
// 按钮四态（48×16）—— 同一构图，只换配色，保证切换不跳动
// ══════════════════════════════════════════════════════════════════

/**
 * 四态共用同一套「位置 → 角色」映射，只有颜色表不同：
 *   y=0 上描边（active 去掉）/ y=1 内高光 / x=1 内高光 / y=14 内压暗 / x=46 内压暗 / y=15 下描边 / x=0,47 左右描边
 * 「按下下移 2px」由运行时做（见 doc/14 §8.5），**不画进贴图**：画进去会让三态切换时抖动。
 */
const BTN_STATES = {
  normal: { body: C.BRONZE, lit: C.BRONZE_LIGHT, dark: C.BRONZE_DARK, edge: C.MOON, topEdge: true },
  hover: { body: C.BRONZE_LIGHT, lit: C.FROST, dark: C.BRONZE, edge: C.FROST, topEdge: true }, // 古铜 → 铜高光：整体提亮一档
  active: { body: C.BRONZE_DARK, lit: C.BRONZE, dark: C.INK, edge: C.MOON, topEdge: false }, // 压暗一档 + 去掉上边
  disabled: { body: C.STONE, lit: C.STONE, dark: C.TEAL_MID, edge: C.TEAL_MID, topEdge: true }, // 石灰灰化，无高光
}

function buttonArt(state) {
  const s = BTN_STATES[state]
  return (x, y, w, h) => {
    if (isChamfered(x, y, w, h)) return C.TRANSPARENT
    if (x === 0 || x === w - 1) return s.edge // 左右描边
    if (y === h - 1) return s.edge // 下描边
    if (y === 0) return s.topEdge ? s.edge : s.body // 上描边（按下态没有）
    if (y === 1 || x === 1) return s.lit // 内高光（左上）
    if (y === h - 2 || x === w - 2) return s.dark // 内压暗（右下）
    return s.body
  }
}

// ══════════════════════════════════════════════════════════════════
// 产物表 —— 新增一个 UI 元件只需在这里加一条
// ══════════════════════════════════════════════════════════════════

const SHEETS = [
  { id: 'ui-frame-panel-9slice', width: 48, height: 48, nine: true, fn: panelFrame },
  { id: 'ui-frame-dialog-9slice', width: 48, height: 48, nine: true, fn: dialogFrame },
  { id: 'ui-bar-hp', width: 64, height: 8, fn: barArt(C.BLOOD, C.FROST) },
  { id: 'ui-bar-mp', width: 64, height: 8, fn: barArt(C.SPIRIT, C.FROST) },
  { id: 'ui-bar-mind', width: 64, height: 8, fn: barArt(C.TALISMAN, C.FROST) },
  { id: 'ui-btn-primary-normal', width: 48, height: 16, fn: buttonArt('normal') },
  { id: 'ui-btn-primary-hover', width: 48, height: 16, fn: buttonArt('hover') },
  { id: 'ui-btn-primary-active', width: 48, height: 16, fn: buttonArt('active') },
  { id: 'ui-btn-primary-disabled', width: 48, height: 16, fn: buttonArt('disabled') },
]

/** 目录按 id 归类：ui-frame-* → frames/，ui-bar-* → bars/，ui-btn-* → buttons/ */
function outputPath(id) {
  const group = id.startsWith('ui-frame') ? 'frames' : id.startsWith('ui-bar') ? 'bars' : 'buttons'
  return path.join(ROOT, 'src', 'assets', 'ui', group, `${id}.png`)
}

// ══════════════════════════════════════════════════════════════════
// 自检
// ══════════════════════════════════════════════════════════════════

/**
 * 实测九宫格可平铺性：边中段沿边方向必须整周期（period 整除 16），
 * 中心区域双向也必须整周期。不成立就抛错 —— 让「可拉伸」成为脚本保证，而不是口头承诺。
 */
function checkNineSlice(sheet, margin = NINE_SLICE, period = GRAIN_PERIOD) {
  const { width: W, height: H, indices } = sheet
  const span = W - margin * 2
  if (span % period !== 0) throw new Error(`边中段宽 ${span} 不是周期 ${period} 的整数倍`)
  const at = (x, y) => indices[y * W + x]

  // 上下边中段：同一行内 x 与 x+period 必须一致
  for (let y = 0; y < margin; y++) {
    for (let x = margin; x < W - margin - period; x++) {
      if (at(x, y) !== at(x + period, y)) throw new Error(`上/下边中段不平铺 (${x},${y})`)
    }
  }
  // 左右边中段：同一列内 y 与 y+period 必须一致
  for (let x = 0; x < margin; x++) {
    for (let y = margin; y < H - margin - period; y++) {
      if (at(x, y) !== at(x, y + period)) throw new Error(`左/右边中段不平铺 (${x},${y})`)
    }
  }
  // 中心：双向
  for (let y = margin; y < H - margin; y++) {
    for (let x = margin; x < W - margin; x++) {
      if (x + period < W - margin && at(x, y) !== at(x + period, y)) throw new Error(`中心横向不平铺 (${x},${y})`)
      if (y + period < H - margin && at(x, y) !== at(x, y + period)) throw new Error(`中心纵向不平铺 (${x},${y})`)
    }
  }
  return span
}

/** 按钮四态构图一致性：除配色外，像素「是否为透明」的分布必须完全一致（切换不跳动的前提） */
function transparencyMask(sheet) {
  const mask = new Uint8Array(sheet.width * sheet.height)
  sheet.indices.forEach((v, i) => (mask[i] = v === C.TRANSPARENT ? 1 : 0))
  return mask.join('')
}

// ══════════════════════════════════════════════════════════════════
// 生成
// ══════════════════════════════════════════════════════════════════

function buildSheet({ width, height, fn }) {
  const indices = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = fn(x, y, width, height)
      if (!Number.isInteger(v) || v < 0 || v > 15) throw new Error(`非法索引 ${v} @ (${x},${y})`)
      indices[y * width + x] = v
    }
  }
  return { width, height, indices }
}

function main() {
  const pal = loadPalette()
  if (pal.entries.length !== 16) throw new Error(`色板必须是 16 色，实际 ${pal.entries.length}`)
  const buttonMasks = new Map()
  let total = 0

  for (const def of SHEETS) {
    const sheet = buildSheet(def)
    if (def.nine) {
      const span = checkNineSlice(sheet)
      console.log(`[gen-ui] ${def.id}: 九宫格边距 ${NINE_SLICE}px，边中段 ${span}px = ${span / GRAIN_PERIOD} 个周期（${GRAIN_PERIOD}px）→ 可 1px 平铺`)
    }
    if (def.id.startsWith('ui-btn')) buttonMasks.set(def.id, transparencyMask(sheet))

    const out = outputPath(def.id)
    const bytes = writePng(out, sheet, pal)
    total += bytes
    const used = new Set(sheet.indices)
    const hasTransparent = used.has(C.TRANSPARENT)
    console.log(
      `[gen-ui] ${path.relative(ROOT, out).replace(/\\/g, '/')}  ${sheet.width}x${sheet.height}  ` +
        `${(bytes / 1024).toFixed(2)} KB  用色 ${used.size}  透明=${hasTransparent ? 'YES（四角倒角）' : 'no'}`,
    )
  }

  // 四态必须同构图：透明像素分布逐一比对
  const masks = [...buttonMasks.entries()]
  for (let i = 1; i < masks.length; i++) {
    if (masks[i][1] !== masks[0][1]) throw new Error(`按钮四态构图不一致：${masks[0][0]} vs ${masks[i][0]}`)
  }
  console.log(`[gen-ui] 按钮四态构图一致（透明分布相同，仅配色不同）；共 ${SHEETS.length} 张，${(total / 1024).toFixed(1)} KB`)
}

main()
