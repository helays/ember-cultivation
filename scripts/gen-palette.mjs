#!/usr/bin/env node
/**
 * 调色板单一源 → 代码与文档的一致性维护。
 *
 * 真源：`src/assets/palette.json`
 *   ├─ 生成 → `src/core/constants.js` 的 PALETTE / COLOR / TRANSPARENT_INDEX
 *   └─ 校验 → `doc/14-美术与音频规范.md` §2.1 的色板表必须与真源逐行一致
 *
 * 用法：
 *   node scripts/gen-palette.mjs           # 生成 constants.js + 校验 doc/14
 *   node scripts/gen-palette.mjs --check   # 只校验，不写盘（CI 用）
 *
 * 为什么这样做：色板一旦在两个地方手写，就必然漂移（本项目已经修过一次同类双真源）。
 * 因此 doc/14 的表格由本脚本校验，constants.js 由本脚本生成，任何手改都会被拦下。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hexToRgb } from './lib/png.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PALETTE_FILE = path.join(ROOT, 'src', 'assets', 'palette.json')
const CONSTANTS_FILE = path.join(ROOT, 'src', 'core', 'constants.js')
const DOC14 = path.join(ROOT, 'doc', '14-美术与音频规范.md')

const checkOnly = process.argv.includes('--check')
const errors = []

function loadPalette() {
  const raw = JSON.parse(fs.readFileSync(PALETTE_FILE, 'utf8'))
  const entries = [...raw.entries].sort((a, b) => a.index - b.index)
  entries.forEach((e, i) => {
    if (e.index !== i) errors.push(`palette.json: 索引必须从 0 连续排列，位置 ${i} 实际 index=${e.index}`)
    if (!/^#[0-9a-f]{6}$/.test(e.hex)) errors.push(`palette.json: ${e.name} 的 hex 非法 → ${e.hex}`)
    if (!e.code || !/^[A-Z][A-Z0-9_]*$/.test(e.code)) errors.push(`palette.json: ${e.name} 的 code 非法 → ${e.code}`)
  })
  const codes = new Set()
  for (const e of entries) {
    if (codes.has(e.code)) errors.push(`palette.json: code 重复 → ${e.code}`)
    codes.add(e.code)
  }
  // 透明槽（索引 0）刻意复用实色的 RGB 作为预览底色（PNG 允许同 RGB 不同 alpha），
  // 因此唯一性只针对实色检查。
  const solidHexes = entries.filter((e) => e.index !== 0).map((e) => e.hex)
  const dupes = solidHexes.filter((h, i) => solidHexes.indexOf(h) !== i)
  if (dupes.length) errors.push(`palette.json: 实色值重复 → ${[...new Set(dupes)].join(', ')}`)
  return { raw, entries }
}

function renderConstants(entries) {
  const rows = entries
    .map((e) => {
      const name = `'${e.name}'`.padEnd(8)
      return `  { index: ${String(e.index).padStart(2)}, code: '${e.code}', name: ${name}, hex: '${e.hex}', rgb: [${hexToRgb(e.hex).join(', ')}], alpha: ${e.alpha}, usage: '${e.usage.replace(/'/g, "\\'")}' },`
    })
    .join('\n')

  const colorRows = entries
    .filter((e) => e.index !== 0)
    .map((e) => `  ${e.code}: ${e.index},`)
    .join('\n')

  return `/**
 * 自动生成文件 —— 请勿手改。
 * 真源：src/assets/palette.json
 * 重新生成：node scripts/gen-palette.mjs
 *
 * 本文件同时提供：
 *  - PALETTE       完整 16 条索引色（含透明槽），供渲染与取色校验使用
 *  - COLOR         按语义名取索引，供 Phaser 特效 tint 与 UI 取色使用
 *  - 通用常量      集中所有魔法数字（doc/00 §七「唯一实现处」）
 */

export const TRANSPARENT_INDEX = ${entries[0].index}

export const PALETTE = [
${rows}
]

/** 语义名 → 调色板索引 */
export const COLOR = {
${colorRows}
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
export const STEPS_PER_SHI = 180
export const LOGICAL_WIDTH = 640
export const LOGICAL_HEIGHT = 360
`
}

function normalizeHex(s) {
  return s.trim().toLowerCase().replace(/^#?/, '#')
}

/** 校验 doc/14 §2.1 的表格与真源一致 */
function verifyDoc14(entries) {
  if (!fs.existsSync(DOC14)) {
    errors.push(`doc/14 不存在：${path.relative(ROOT, DOC14)}`)
    return null
  }
  const text = fs.readFileSync(DOC14, 'utf8')
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => /^###\s*2\.1/.test(l))
  if (start < 0) {
    errors.push('doc/14: 找不到 §2.1 小节标题')
    return null
  }
  const found = []
  for (let i = start; i < lines.length; i++) {
    if (i > start && /^###\s/.test(lines[i])) break
    const m = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*`(#[0-9a-fA-F]{6})`\s*\|/.exec(lines[i])
    if (m) found.push({ n: Number(m[1]), name: m[2].trim(), hex: normalizeHex(m[3]) })
  }
  if (found.length === 0) {
    errors.push('doc/14 §2.1: 未解析到任何色板行（期望形如 | 1 | 深墨青 | `#0d1f27` | 用途 |）')
    return found
  }
  const truth = entries.filter((e) => e.index !== 0)
  if (found.length !== truth.length) {
    errors.push(`doc/14 §2.1: 色板行数 ${found.length} ≠ 真源实色数 ${truth.length}`)
  }
  const n = Math.min(found.length, truth.length)
  for (let i = 0; i < n; i++) {
    if (found[i].hex !== truth[i].hex) {
      errors.push(`doc/14 §2.1 第 ${i + 1} 行颜色 ${found[i].hex} ≠ 真源 ${truth[i].hex}（${truth[i].name}）`)
    }
    if (found[i].name !== truth[i].name) {
      errors.push(`doc/14 §2.1 第 ${i + 1} 行色名「${found[i].name}」≠ 真源「${truth[i].name}」`)
    }
  }
  return found
}

function main() {
  const { entries } = loadPalette()
  const docRows = verifyDoc14(entries)

  if (errors.length) {
    console.error('[gen-palette] 校验失败：')
    for (const e of errors) console.error(`  ✗ ${e}`)
    process.exit(1)
  }

  const out = renderConstants(entries)
  const target = path.join(ROOT, 'src', 'core', 'constants.js')

  if (checkOnly) {
    console.log(`[gen-palette] --check 通过：真源 ${entries.length} 色，doc/14 §2.1 一致（${docRows?.length ?? 0} 行实色）`)
    return
  }

  const exists = fs.existsSync(target)
  if (exists && fs.readFileSync(target, 'utf8') === out) {
    console.log(`[gen-palette] 未变：${path.relative(ROOT, target)}`)
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, out)
    console.log(`[gen-palette] 已生成：${path.relative(ROOT, target)}`)
  }
  console.log(`[gen-palette] 真源 ${entries.length} 色（含透明槽）· doc/14 §2.1 一致（${docRows?.length ?? 0} 行实色）`)
  void CONSTANTS_FILE
}

main()
