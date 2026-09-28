#!/usr/bin/env node
/**
 * PWA / favicon 图标生成（`public/icons/`，不在 src/assets 下，因此不参与素材清单校验）。
 *
 * ── 唯一的设计手法：16×16 主图 × 整数放大 ──────────────────────
 * 「小尺寸可辨认」是图标的硬指标，所以**图形只在 16×16 索引网格里画一次**
 * （见 NORMAL_MASTER / MASKABLE_MASTER，字符集与 .px.txt 一致），
 * 再按整数倍 `scaleNearest` 放大到各尺寸；**绝不做插值缩放**（没有 1.5×、2.25×，也就没有糊边）。
 * 其中 180 不是 16 的整数倍：取 11× → 176，居中放进 180 画布，余下 2px 用暗青补齐。
 *
 *   16  → ×1       32 → ×2       192 → ×12      512 → ×32
 *   180 → ×11 + 2px 边距（apple-touch-icon）
 *
 * ── maskable 的安全区 ──────────────────────────────────────────
 * maskable 变体用**背景出血到四边**、主体（残碑 + 灵光青）收进中央 12×12 的独立主图，
 * 即内容占 75%（≤ 要求的中央 80% 安全区）。脚本会实测内容包围盒并断言它落在安全区内，
 * 而不是只在注释里承诺。
 *
 * 主视觉：镇口残碑 + 一点灵光青；背景暗青（索引 2），描边深墨青（索引 1），灵光青点（索引 11）。
 * 仍是 16 色索引板产物（图标虽不在 src/assets 下，也守同一条色板规则）。
 *
 * 幂等：纯查表 + 整数放大，无随机数，重跑字节一致。
 *
 * 用法：node scripts/gen-icons.mjs
 */

import path from 'node:path'
import { C, ROOT, loadPalette, parseGrid, solidSheet, blit, writePng } from './lib/artkit.mjs'
import { scaleNearest } from './lib/pixels.mjs'

const MASTER = 16
const PUBLIC_ICONS = path.join(ROOT, 'public', 'icons')

// ══════════════════════════════════════════════════════════════════
// 主图（16×16，唯一一次手绘）
// 字符：`.` 透明（未使用）/ `1` 深墨青 / `2` 暗青 / `3` 青灰 / `8` 石灰 / `b` 灵光青
// ══════════════════════════════════════════════════════════════════

/** 普通图标：残碑几乎满幅，碑身左缘受光、右下缺口（「残」），碑侧一点灵光青 */
const NORMAL_MASTER = [
  '1111111111111111',
  '1222222222222221',
  '1222111111122221',
  '12221112222bb221',
  '12221832222bb221',
  '1222183111122221',
  '1222183333122221',
  '1222183133122221',
  '1222181333122221',
  '1222183113122221',
  '1222183333122221',
  '1222183133122221',
  '1222111111122221',
  '1221333333312221',
  '1331333333331331',
  '1111111111111111',
]

/**
 * maskable 图标：去掉外框，背景暗青出血到四边；残碑 + 灵光青整体缩小并收进中央 12×12。
 * 字形与普通版同构（顶部缺口、碑身裂纹、基座、地面），只是去掉描边边框、整体内缩。
 */
const MASKABLE_MASTER = [
  '2222222222222222',
  '2222222222222222',
  '2222222222222222',
  '2222222222222222',
  '22222211122bb222',
  '22222218312bb222',
  '2222221831222222',
  '2222221811222222',
  '2222221831222222',
  '2222221131222222',
  '2222221831222222',
  '2222221811222222',
  '2222213333122222',
  '2223313333133222',
  '2222222222222222',
  '2222222222222222',
]

// ══════════════════════════════════════════════════════════════════
// 产物表
// ══════════════════════════════════════════════════════════════════

const ICONS = [
  { file: 'icon-192.png', size: 192, master: 'normal', scale: 12 },
  { file: 'icon-512.png', size: 512, master: 'normal', scale: 32 },
  { file: 'icon-192-maskable.png', size: 192, master: 'maskable', scale: 12 },
  { file: 'icon-512-maskable.png', size: 512, master: 'maskable', scale: 32 },
  { file: 'apple-touch-icon.png', size: 180, master: 'normal', scale: 11 }, // 11×16=176，余 2px 边距
  { file: 'favicon-32.png', size: 32, master: 'normal', scale: 2 },
  { file: 'favicon-16.png', size: 16, master: 'normal', scale: 1 },
]

// ══════════════════════════════════════════════════════════════════
// 自检
// ══════════════════════════════════════════════════════════════════

/** 内容包围盒（把背景暗青 2 视作空），用于断言 maskable 的安全区 */
function contentBox(sheet, background) {
  let minX = sheet.width
  let minY = sheet.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < sheet.height; y++) {
    for (let x = 0; x < sheet.width; x++) {
      if (sheet.indices[y * sheet.width + x] === background) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return { minX, minY, maxX, maxY }
}

/**
 * maskable 安全区断言：PWA 规范要求重要内容落在中央 80% 圆内。
 * 这里用更严的**中央 12×12（75%）方框**作为验收口径：主图只有 16px，圆内判定会让边界像素变得含糊，
 * 方框判定可复现、可断言。
 */
function assertMaskableSafe(sheet) {
  const box = contentBox(sheet, C.TEAL_DARK)
  const lo = 2
  const hi = MASTER - 3 // = 13
  if (box.minX < lo || box.minY < lo || box.maxX > hi || box.maxY > hi) {
    throw new Error(`maskable 内容越出安全区：bbox x[${box.minX},${box.maxX}] y[${box.minY},${box.maxY}]，要求落在 [${lo},${hi}]`)
  }
  const side = Math.max(box.maxX - box.minX + 1, box.maxY - box.minY + 1)
  return { box, side, pct: ((side / MASTER) * 100).toFixed(0) }
}

// ══════════════════════════════════════════════════════════════════
// 生成
// ══════════════════════════════════════════════════════════════════

function main() {
  const pal = loadPalette()
  if (pal.entries.length !== 16) throw new Error(`色板必须是 16 色，实际 ${pal.entries.length}`)

  const masters = {
    normal: parseGrid(NORMAL_MASTER, 'NORMAL_MASTER'),
    maskable: parseGrid(MASKABLE_MASTER, 'MASKABLE_MASTER'),
  }
  for (const [name, m] of Object.entries(masters)) {
    if (m.width !== MASTER || m.height !== MASTER) throw new Error(`${name} 主图必须是 ${MASTER}×${MASTER}`)
  }
  const safe = assertMaskableSafe(masters.maskable)
  console.log(
    `[gen-icons] maskable 内容包围盒 x[${safe.box.minX},${safe.box.maxX}] y[${safe.box.minY},${safe.box.maxY}]，` +
      `占主图 ${safe.pct}%（≤ 中央 80% 安全区）`,
  )

  let total = 0
  for (const icon of ICONS) {
    const master = masters[icon.master]
    const art = scaleNearest(master.indices, master.width, master.height, icon.scale) // 整数放大，无插值
    const artW = art.width
    if (artW > icon.size) throw new Error(`${icon.file}: ${icon.scale}× = ${artW} 超过目标 ${icon.size}`)
    const margin = (icon.size - artW) / 2
    if (!Number.isInteger(margin)) throw new Error(`${icon.file}: ${icon.size} - ${artW} 不是偶数，无法居中`)
    const sheet =
      margin === 0
        ? art
        : blit(solidSheet(icon.size, icon.size, C.TEAL_DARK), art, margin, margin) // 余量用暗青补齐，避免非整数缩放

    const bytes = writePng(path.join(PUBLIC_ICONS, icon.file), sheet, pal)
    total += bytes
    console.log(
      `[gen-icons] public/icons/${icon.file}  ${sheet.width}x${sheet.height}  ` +
        `${icon.master} 主图 ×${icon.scale}${margin ? ` + ${margin}px 暗青边距` : ''}  ${(bytes / 1024).toFixed(1)} KB`,
    )
  }
  console.log(`[gen-icons] 共 ${ICONS.length} 张，${(total / 1024).toFixed(1)} KB（16×16 主图整数放大，无插值）`)
}

main()
