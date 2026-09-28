#!/usr/bin/env node
/**
 * 素材检查工具：读取 PNG-8，报告元数据、调色板合规性、索引分布、
 * 瓦片接缝突变指标，并可选打印 ASCII 预览（字符与 `.px.txt` 完全一致）。
 *
 * 用法：
 *   node scripts/inspect-png.mjs <file> [--crop x,y,w,h] [--seam cell]
 *
 * 为什么有 ASCII 预览：本项目的美术产物是索引色像素图，
 * 用与源文件相同的字符集打印出来就能在终端/PR 里直接 review，
 * 不需要打开图像查看器（这对只有文本能力的 agent 尤其重要）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeIndexedPng, paletteArrays } from './lib/png.mjs'
import { PIXEL_CHARS } from './lib/pixels.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PALETTE_FILE = path.join(ROOT, 'src', 'assets', 'palette.json')

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

function main() {
  const file = process.argv[2]
  if (!file || file.startsWith('--')) {
    console.error('usage: node scripts/inspect-png.mjs <file> [--crop x,y,w,h] [--seam cell]')
    process.exit(2)
  }
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, file)
  const img = decodeIndexedPng(fs.readFileSync(abs))

  const raw = JSON.parse(fs.readFileSync(PALETTE_FILE, 'utf8'))
  const entries = [...raw.entries].sort((a, b) => a.index - b.index)
  const { palette: want, alpha: wantAlpha } = paletteArrays(entries)

  console.log(`file        ${path.relative(ROOT, abs).replace(/\\/g, '/')}`)
  console.log(`size        ${img.width}x${img.height}`)
  console.log(`colorType   ${img.colorType} (3 = indexed)   bitDepth ${img.bitDepth}   interlace ${img.interlace}`)
  console.log(`palette     ${img.palette.length} entries`)

  // 调色板合规
  let paletteOk = img.palette.length === want.length
  if (paletteOk) {
    for (let i = 0; i < want.length; i++) {
      if (img.palette[i][0] !== want[i][0] || img.palette[i][1] !== want[i][1] || img.palette[i][2] !== want[i][2]) {
        paletteOk = false
        console.log(`  ✗ index ${i} 实际 ${img.palette[i].join(',')} ≠ 期望 ${want[i].join(',')}`)
      }
    }
  } else {
    console.log(`  ✗ 调色板条目数 ${img.palette.length} ≠ 真源 ${want.length}`)
  }
  console.log(`palette ok  ${paletteOk ? 'YES' : 'NO'}`)

  // 索引使用分布 + 越界检查
  const hist = new Array(256).fill(0)
  let outOfRange = 0
  for (const v of img.indices) {
    hist[v]++
    if (v >= want.length) outOfRange++
  }
  const used = hist.map((n, i) => (n > 0 ? `${i}:${n}` : null)).filter(Boolean).join(' ')
  console.log(`used idx    ${used}`)
  console.log(`out-of-range ${outOfRange}`)
  console.log(`transparent idx used  ${hist[0] > 0 ? `YES (${hist[0]} px)` : 'no'}`)

  // 接缝突变指标：把 tile 周期性平铺后，边界处相邻像素差的均值 vs 内部均值
  const cell = Number(arg('--seam', '0'))
  if (cell > 0 && img.width % cell === 0 && img.height % cell === 0) {
    const idxAt = (x, y) => img.indices[(y % img.height) * img.width + (x % img.width)]
    let boundary = 0
    let boundaryCount = 0
    let internal = 0
    let internalCount = 0
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const right = idxAt(x + 1, y)
        const diff = Math.abs(idxAt(x, y) - right)
        if ((x + 1) % cell === 0) { boundary += diff; boundaryCount++ } else { internal += diff; internalCount++ }
      }
    }
    const bAvg = boundary / boundaryCount
    const iAvg = internal / internalCount
    console.log(`seam metric cell=${cell}  boundary=${bAvg.toFixed(3)}  internal=${iAvg.toFixed(3)}  ratio=${(bAvg / (iAvg || 1)).toFixed(2)}`)
    console.log(`            （ratio ≈ 1 表示接缝处与内部一样平缓；> 2 说明边界有明显断层）`)
  }

  // ASCII 预览
  const crop = (arg('--crop', '') || '').split(',').map(Number)
  const hasCrop = crop.length === 4 && crop.every((n) => Number.isInteger(n))
  const [cx, cy, cw, ch] = hasCrop ? crop : [0, 0, Math.min(img.width, 64), Math.min(img.height, 64)]
  if (cw > 96) {
    console.log(`ascii       skipped (crop width ${cw} > 96；用 --crop 指定更小的区域)`)
    return
  }
  console.log(`ascii       crop ${cx},${cy} ${cw}x${ch}`)
  console.log('            +' + '-'.repeat(cw) + '+')
  for (let y = cy; y < cy + ch; y++) {
    let line = ''
    for (let x = cx; x < cx + cw; x++) {
      const v = img.indices[(y % img.height) * img.width + (x % img.width)]
      line += PIXEL_CHARS[v] ?? '?'
    }
    console.log(`            |${line}|`)
  }
  console.log('            +' + '-'.repeat(cw) + '+')
  void wantAlpha
}

main()
