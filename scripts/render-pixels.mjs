#!/usr/bin/env node
/**
 * L1 生产线：`src/assets/pixel/**` 下的 `.px.txt`（单图）与 `.atlas.json`（网格图集）
 * → PNG-8 索引色，写入 `out` 指定的路径。
 *
 * 用法：
 *   node scripts/render-pixels.mjs            # 渲染全部并汇报
 *   node scripts/render-pixels.mjs --check    # 只校验不写盘（CI 用）
 *
 * 幂等：同一份源文件渲染出的字节完全相同，可安全重复执行。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodeIndexedPng, paletteArrays } from './lib/png.mjs'
import { parsePx, composeGrid } from './lib/pixels.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PIXEL_DIR = path.join(ROOT, 'src', 'assets', 'pixel')
const PALETTE_FILE = path.join(ROOT, 'src', 'assets', 'palette.json')

const checkOnly = process.argv.includes('--check')

function loadPalette() {
  const raw = JSON.parse(fs.readFileSync(PALETTE_FILE, 'utf8'))
  const entries = [...raw.entries].sort((a, b) => a.index - b.index)
  const expected = entries.map((_, i) => i)
  entries.forEach((e, i) => {
    if (e.index !== expected[i]) throw new Error(`palette.json: 索引不连续，期望 ${i}，实际 ${e.index}`)
  })
  return { entries, ...paletteArrays(entries) }
}

/** 瓦片不得使用透明槽 */
function assertOpaqueForTiles(parsed, origin, kind) {
  if (kind === 'tile' && parsed.usesTransparent) {
    throw new Error(`${origin}: kind=tile 禁止使用透明槽 '.'（瓦片必须完全不透明）`)
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function writePng(relOut, width, height, indices, palette, alpha, report) {
  const outPath = path.join(ROOT, relOut)
  const buf = encodeIndexedPng({ width, height, indices, palette, alpha })
  if (checkOnly) {
    report.checked.push({ relOut, width, height, bytes: buf.length })
    return buf
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  // 内容未变则不触碰文件，保证幂等且不产生无意义的 mtime/git 变更
  if (fs.existsSync(outPath) && fs.readFileSync(outPath).equals(buf)) {
    report.unchanged.push(relOut)
    return buf
  }
  fs.writeFileSync(outPath, buf)
  report.written.push({ relOut, width, height, bytes: buf.length })
  return buf
}

function renderSingle(file, palette, alpha, report) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  const parsed = parsePx(fs.readFileSync(file, 'utf8'), rel)
  if (!parsed.out) throw new Error(`${rel}: 缺少 @out（单图必须显式声明输出路径）`)
  const kind = parsed.kind || 'image'
  assertOpaqueForTiles(parsed, rel, kind)
  const [w, h] = parsed.size
  writePng(parsed.out, w, h, parsed.indices, palette, alpha, report)
  return { rel, id: parsed.id, out: parsed.out, size: `${w}x${h}`, kind }
}

function renderAtlas(file, palette, alpha, report) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  const atlas = JSON.parse(fs.readFileSync(file, 'utf8'))
  const { id, out, cell, columns } = atlas
  if (!out) throw new Error(`${rel}: atlas 缺少 out`)
  if (!Array.isArray(cell) || cell.length !== 2) throw new Error(`${rel}: atlas 缺少 cell [w,h]`)
  if (!Array.isArray(atlas.frames) || atlas.frames.length === 0) throw new Error(`${rel}: atlas 缺少 frames`)
  if (!Number.isInteger(columns) || columns < 1) throw new Error(`${rel}: atlas 缺少 columns`)
  if (atlas.frames.length > columns * Math.ceil(atlas.frames.length / columns)) {
    throw new Error(`${rel}: frames 数量异常`)
  }

  const [cw, ch] = cell
  const baseDir = path.dirname(file)
  const frames = atlas.frames.map((entry, i) => {
    const src = typeof entry === 'string' ? entry : entry.src
    const framePath = path.resolve(baseDir, src)
    const frameRel = path.relative(ROOT, framePath).replace(/\\/g, '/')
    if (!fs.existsSync(framePath)) throw new Error(`${rel}: 第 ${i} 帧源文件不存在 → ${frameRel}`)
    const parsed = parsePx(fs.readFileSync(framePath, 'utf8'), frameRel)
    if (parsed.size[0] !== cw || parsed.size[1] !== ch) {
      throw new Error(`${frameRel}: 尺寸 ${parsed.size.join('x')} 与 atlas cell ${cw}x${ch} 不一致`)
    }
    assertOpaqueForTiles(parsed, frameRel, atlas.kind || 'sprite')
    return parsed
  })

  const composed = composeGrid(frames, cw, ch, columns)
  writePng(out, composed.width, composed.height, composed.indices, palette, alpha, report)
  return {
    rel,
    id,
    out,
    size: `${composed.width}x${composed.height}`,
    cell: `${cw}x${ch}`,
    frames: frames.length,
    columns,
  }
}

function main() {
  const { palette, alpha, entries } = loadPalette()
  const report = { written: [], unchanged: [], checked: [], singles: [], atlases: [] }

  if (!fs.existsSync(PIXEL_DIR)) {
    console.log(`[render-pixels] 源目录不存在，跳过：${path.relative(ROOT, PIXEL_DIR)}`)
    return
  }

  const files = walk(PIXEL_DIR)
  const sources = new Set(files.map((f) => path.resolve(f)))

  for (const file of files) {
    if (file.endsWith('.atlas.json')) {
      report.atlases.push(renderAtlas(file, palette, alpha, report))
    } else if (file.endsWith('.px.txt')) {
      // 被 atlas 引用的帧不单独出图（避免产出一堆单帧文件）
      const parent = files.find(
        (f) => f.endsWith('.atlas.json') && JSON.parse(fs.readFileSync(f, 'utf8')).frames
          .some((e) => path.resolve(path.dirname(f), typeof e === 'string' ? e : e.src) === path.resolve(file)),
      )
      if (parent) continue
      report.singles.push(renderSingle(file, palette, alpha, report))
    }
  }

  void sources

  console.log(`[render-pixels] 调色板 ${entries.length} 色（透明槽索引 ${entries[0].index}）`)
  console.log(`[render-pixels] 单图 ${report.singles.length} 张 · 图集 ${report.atlases.length} 张`)
  for (const s of report.singles) console.log(`  · ${s.out}  ${s.size}  (${s.id || '-'})`)
  for (const a of report.atlases) console.log(`  · ${a.out}  ${a.size}  ${a.frames} 帧 / ${a.columns} 列  (${a.id})`)
  if (checkOnly) {
    console.log(`[render-pixels] --check 模式：已校验 ${report.checked.length} 张，未写盘`)
  } else {
    console.log(`[render-pixels] 写入 ${report.written.length} 张，未变 ${report.unchanged.length} 张`)
  }
}

main()
