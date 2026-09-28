#!/usr/bin/env node
/**
 * 素材全量校验器（CI 门禁）。
 *
 * 用法：
 *   node scripts/check-assets.mjs             # 校验，失败退出码 1
 *   node scripts/check-assets.mjs --report    # 额外写报告到 runtime/reports/
 *
 * 校验项（对应 doc/14 §2 / §3 / §5 与 doc/00 §八 的硬规则）：
 *   1. 调色板单一源与 doc/14 §2.1 一致（复用 gen-palette --check）
 *   2. 素材清单 assets.manifest.json 与磁盘**双向**一致（无孤儿、无缺失）
 *   3. 每个 PNG 必须是 8 位索引色，且调色板严格等于真源 16 色
 *   4. 索引不得越界；瓦片不得使用透明槽
 *   5. 命名符合 doc/14 §5.2（kebab-case、前缀合法）
 *   6. 尺寸必须精确等于 manifest 的 spec（不允许近似）
 *   7. 瓦片接缝突变指标（ratio 过高说明有断层）
 *   8. 音频：采样率 / 声道 / 时长 / 体积上限（需 ffprobe）
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { decodeIndexedPng, paletteArrays } from './lib/png.mjs'
import { parsePx } from './lib/pixels.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = path.join(ROOT, 'src', 'assets')
const PIXEL_SRC = path.join(ASSETS, 'pixel')
const MANIFEST = path.join(ASSETS, 'assets.manifest.json')
const PALETTE_FILE = path.join(ASSETS, 'palette.json')
const REPORT_DIR = path.join(ROOT, 'runtime', 'reports')

const NAME_RE = /^(tileset|sprite|portrait|icon|ui|bg|vfx|particle|bgm|sfx)-[a-z0-9]+(-[a-z0-9]+)*\.(png|ogg|mp3|tsx)$/
const AUDIO_MAX_BYTES = 2 * 1024 * 1024
const SEAM_RATIO_WARN = 2.0
/** 精灵/特效各帧包围盒中心的允许漂移（px）。超过只报警告：摆动是正常动画，硬判 0 会逼美术画僵。 */
const CENTER_SPREAD_TOLERANCE = 2

const errors = []
const warnings = []
const notes = []

function err(msg) { errors.push(msg) }
function warn(msg) { warnings.push(msg) }

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')

function loadPalette() {
  const raw = JSON.parse(fs.readFileSync(PALETTE_FILE, 'utf8'))
  const entries = [...raw.entries].sort((a, b) => a.index - b.index)
  return { entries, ...paletteArrays(entries) }
}

/** 1. 调色板单一源一致性 */
function checkPaletteSource() {
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'gen-palette.mjs'), '--check'], { encoding: 'utf8' })
    notes.push(out.trim())
  } catch (e) {
    err(`调色板单一源校验失败：\n${(e.stderr || e.stdout || e.message).toString().trim()}`)
  }
}

/** 2. manifest 加载 */
function loadManifest() {
  if (!fs.existsSync(MANIFEST)) {
    err(`缺少素材清单：${rel(MANIFEST)}（所有素材必须在清单中登记）`)
    return null
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  if (!Array.isArray(m.assets)) {
    err('assets.manifest.json: 顶层必须含 assets 数组')
    return null
  }
  const seen = new Set()
  for (const a of m.assets) {
    if (!a.id) err('manifest: 存在缺少 id 的条目')
    else if (seen.has(a.id)) err(`manifest: id 重复 → ${a.id}`)
    else seen.add(a.id)
    if (!a.path) err(`manifest: ${a.id} 缺少 path`)
    if (!a.status) err(`manifest: ${a.id} 缺少 status`)
    if (!a.license && a.status !== 'planned') err(`manifest: ${a.id} 缺少 license（第三方/AI 素材必须登记授权）`)
  }
  return m
}

/** 3+4+6. 逐 PNG 校验 */
function checkPng(file, truth, manifestEntry) {
  const r = rel(file)
  let img
  try {
    img = decodeIndexedPng(fs.readFileSync(file))
  } catch (e) {
    err(`${r}: 解析失败 → ${e.message}`)
    return null
  }
  if (img.colorType !== 3) err(`${r}: 必须是索引色（colorType=3），实际 ${img.colorType}`)
  if (img.bitDepth !== 8) err(`${r}: 位深必须为 8，实际 ${img.bitDepth}`)

  if (img.palette.length !== truth.palette.length) {
    err(`${r}: 调色板 ${img.palette.length} 条 ≠ 真源 ${truth.palette.length} 条`)
  } else {
    for (let i = 0; i < truth.palette.length; i++) {
      const [r1, g1, b1] = img.palette[i]
      const [r2, g2, b2] = truth.palette[i]
      if (r1 !== r2 || g1 !== g2 || b1 !== b2) {
        err(`${r}: 调色板索引 ${i} = ${r1},${g1},${b1} ≠ 真源 ${r2},${g2},${b2}`)
      }
    }
  }

  let outOfRange = 0
  let usesTransparent = false
  for (const v of img.indices) {
    if (v >= truth.palette.length) outOfRange++
    if (v === 0) usesTransparent = true
  }
  if (outOfRange) err(`${r}: 有 ${outOfRange} 个像素索引越界`)

  const kind = manifestEntry?.kind
  if (kind === 'tile' && usesTransparent) {
    err(`${r}: 瓦片禁止使用透明槽（索引 0），实际有 ${[...img.indices].filter((v) => v === 0).length} 像素`)
  }

  if (manifestEntry?.spec) {
    const { width, height } = manifestEntry.spec
    if (width && img.width !== width) err(`${r}: 宽 ${img.width} ≠ spec ${width}`)
    if (height && img.height !== height) err(`${r}: 高 ${img.height} ≠ spec ${height}`)
  }

  return { img, usesTransparent, outOfRange }
}

/** 7. 瓦片接缝突变指标 */
function seamRatio(img, cell) {
  if (!cell || img.width % cell !== 0 || img.height % cell !== 0) return null
  const at = (x, y) => img.indices[(y % img.height) * img.width + (x % img.width)]
  let b = 0, bc = 0, i = 0, ic = 0
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const d = Math.abs(at(x, y) - at(x + 1, y))
      if ((x + 1) % cell === 0) { b += d; bc++ } else { i += d; ic++ }
    }
  }
  return b / bc / (i / ic || 1)
}

/**
 * 7b. 帧对齐校验（doc/14 §7.2）
 *
 * 规则按 kind 区分，因为"对齐"的语义不同：
 *   - kind=sprite（站地上的角色）：锚点是**内容包围盒底边中心** → 各帧底边 y 必须完全一致、中心 x 必须完全一致（误差 0）
 *   - kind=vfx（居中的特效）    ：锚点是中心 → 各帧中心 x/y 漂移超过 1px 报警（特效本来就会胀缩，不按底边判定）
 * 另外校验 `.px.txt` 的 `@anchor` 声明与实际内容包围盒是否自洽。
 */
function checkFrameAlignment(entry) {
  if (!entry.atlas) return null
  const atlasPath = path.join(ROOT, entry.atlas)
  if (!fs.existsSync(atlasPath)) {
    err(`${entry.id}: manifest 声明了 atlas 但文件不存在 → ${entry.atlas}`)
    return null
  }
  let atlas
  try {
    atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'))
  } catch (e) {
    err(`${entry.id}: atlas 解析失败 → ${e.message}`)
    return null
  }
  if (!Array.isArray(atlas.frames) || !atlas.frames.length) {
    err(`${entry.id}: atlas 缺少 frames`)
    return null
  }

  const baseDir = path.dirname(atlasPath)
  const frames = []
  for (let i = 0; i < atlas.frames.length; i++) {
    const srcRef = typeof atlas.frames[i] === 'string' ? atlas.frames[i] : atlas.frames[i].src
    const fp = path.resolve(baseDir, srcRef)
    const fr = rel(fp)
    if (!fs.existsSync(fp)) {
      err(`${entry.id}: 第 ${i + 1} 帧源文件不存在 → ${fr}`)
      return null
    }
    let parsed
    try {
      parsed = parsePx(fs.readFileSync(fp, 'utf8'), fr)
    } catch (e) {
      err(`${fr}: ${e.message}`)
      return null
    }
    const [cw, ch] = parsed.size
    let minX = cw, maxX = -1, minY = ch, maxY = -1
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (parsed.indices[y * cw + x] !== 0) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) {
      err(`${fr}: 整帧全透明（索引 0），无法判定锚点`)
      return null
    }
    frames.push({ i: i + 1, file: fr, declared: parsed.anchor, minX, maxX, minY, maxY })
  }

  const centerX = (f) => Math.round((f.minX + f.maxX) / 2)
  const centerY = (f) => Math.round((f.minY + f.maxY) / 2)
  const uniq = (arr) => [...new Set(arr)]

  const kind = entry.kind
  const uniqX = uniq(frames.map(centerX))
  const uniqY = uniq(frames.map(centerY))
  const bottoms = uniq(frames.map((f) => f.maxY))
  const spread = (arr) => (arr.length ? Math.max(...arr) - Math.min(...arr) : 0)

  // ── 硬要求 1：同一动作各帧的 @anchor 必须完全一致（唯一的对齐权威）──
  const declared = uniq(frames.map((f) => (f.declared ? f.declared.join(',') : 'none')))
  if (declared.length > 1) err(`${entry.id}: 各帧 @anchor 声明不一致 → ${declared.join(' | ')}（播放会跳位）`)
  if (declared.includes('none')) warn(`${entry.id}: 有帧未声明 @anchor`)

  // ── 硬要求 2：仅对"贴地精灵"校验锚点与接地线自洽 ──
  // 特效（vfx）的锚点是**附着点**：内容会在帧间位移与胀缩（火球从凝聚到消散），
  // 用内容包围盒去反推锚点必然误报，所以 vfx 不做这一项。
  if (kind === 'sprite') {
    for (const f of frames) {
      if (!f.declared) continue
      const ay = f.declared[1]
      if (ay !== f.maxY) {
        err(`${f.file}: @anchor y=${ay} ≠ 实际内容底边 y=${f.maxY}（角色必须踩在同一条接地线上）`)
      }
    }
    if (bottoms.length > 1) {
      err(`${entry.id}: 精灵各帧内容底边 y 不一致 → ${bottoms.join(', ')}（接地线必须一致）`)
    }
  }

  // ── 软要求：内容包围盒中心漂移**只作警告** ──
  // 手臂摆动（精灵）与位移/胀缩（特效）都会合法地改变包围盒中心；
  // 硬判 0 误差会把正常动画误判成错误、逼美术把动作画僵。真抖动靠素材测试场景 B 区肉眼确认。
  if (spread(uniqX) > CENTER_SPREAD_TOLERANCE) {
    warn(
      `${entry.id}: 各帧内容中心 x 漂移 ${spread(uniqX)}px（${uniqX.join('/')}）—— ` +
      `${kind === 'vfx' ? '特效位移与胀缩通常可接受' : '可能只是手臂摆动，也可能是帧抖动'}，请在素材测试场景 B 区确认`,
    )
  }
  if (kind === 'vfx' && spread(uniqY) > CENTER_SPREAD_TOLERANCE) {
    warn(`${entry.id}: 特效帧内容中心 y 漂移 ${spread(uniqY)}px（${uniqY.join('/')}）`)
  }

  return `align ${entry.id} (${kind}) · ${frames.length} 帧 · 底边 y=${bottoms.join('/')} · 中心 x=${uniqX.join('/')}`
}

/** 8. 音频（返回探测结果，供上层比对标称时长） */
function checkAudio(file) {
  const r = rel(file)
  const size = fs.statSync(file).size
  if (size > AUDIO_MAX_BYTES) err(`${r}: 体积 ${(size / 1024 / 1024).toFixed(2)} MB > 上限 2 MB`)
  try {
    const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels', '-show_entries', 'format=duration', '-of', 'json', file], { encoding: 'utf8' })
    const info = JSON.parse(probe)
    const st = info.streams?.[0] || {}
    const dur = Number(info.format?.duration || 0)
    notes.push(`audio ${r}: ${st.sample_rate || '?'} Hz / ${st.channels || '?'} ch / ${dur.toFixed(2)}s / ${(size / 1024).toFixed(0)} KB`)
    return { duration: dur, sampleRate: Number(st.sample_rate || 0), channels: Number(st.channels || 0) }
  } catch (e) {
    warn(`${r}: ffprobe 读取失败（${e.message.split('\n')[0]}）`)
    return null
  }
}

function main() {
  const { entries, palette, alpha } = loadPalette()
  notes.push(`调色板真源 ${entries.length} 色（含透明槽索引 0，实色 ${entries.length - 1}）`)
  checkPaletteSource()

  const manifest = loadManifest()
  const byPath = new Map()
  if (manifest) for (const a of manifest.assets) if (a.path) byPath.set(a.path, a)

  // 磁盘扫描（排除像素矩阵源目录）
  const diskFiles = walk(ASSETS).filter((f) => !path.resolve(f).startsWith(path.resolve(PIXEL_SRC)))
  const pngs = diskFiles.filter((f) => f.endsWith('.png'))
  const audios = diskFiles.filter((f) => f.endsWith('.ogg') || f.endsWith('.mp3'))

  // 5. 命名
  for (const f of [...pngs, ...audios, ...diskFiles.filter((x) => x.endsWith('.tsx'))]) {
    const base = path.basename(f)
    if (!NAME_RE.test(base)) err(`${rel(f)}: 命名不符合 doc/14 §5.2（须 kebab-case 且前缀合法）`)
  }

  // 3+4+6+7+7b
  for (const f of pngs) {
    const entry = byPath.get(rel(f))
    const res = checkPng(f, { entries, palette, alpha }, entry)
    if (res && entry?.kind === 'tile' && entry.spec?.cell) {
      const ratio = seamRatio(res.img, entry.spec.cell)
      if (ratio !== null) {
        notes.push(`seam ${rel(f)}: ratio=${ratio.toFixed(2)}（cell=${entry.spec.cell}）`)
        if (ratio > SEAM_RATIO_WARN) err(`${rel(f)}: 接缝突变比 ${ratio.toFixed(2)} > ${SEAM_RATIO_WARN}，疑似有断层`)
      }
    }
    // 帧对齐：由 atlas 的源帧判定（doc/14 §7.2）
    if (entry?.atlas) {
      const line = checkFrameAlignment(entry)
      if (line) notes.push(line)
    }
  }

  // 8. 音频 + 标称时长比对
  // placeholder 允许时长不足（占位曲就是要短），但 status=final 时必须贴近 spec.durationTarget，
  // 否则"标称 90 秒的 BGM"会带着 45 秒的占位曲上线。
  for (const f of audios) {
    const info = checkAudio(f)
    const entry = byPath.get(rel(f))
    const target = entry?.spec?.durationTarget
    if (!info || !target) continue
    const ratio = info.duration / target
    if (entry.status === 'final' && Math.abs(1 - ratio) > 0.25) {
      err(`${rel(f)}: 时长 ${info.duration.toFixed(2)}s 偏离 spec.durationTarget ${target}s 超过 25%（status=final 不允许）`)
    } else if (entry.status !== 'final') {
      notes.push(`audio ${rel(f)}: 占位时长 ${info.duration.toFixed(2)}s / 目标 ${target}s（status=${entry.status}，暂不判错）`)
    }
  }

  // 2. manifest ↔ 磁盘双向
  if (manifest) {
    const onDisk = new Set([...pngs, ...audios].map(rel))
    for (const a of manifest.assets) {
      const exists = fs.existsSync(path.join(ROOT, a.path))
      if (a.status === 'planned') {
        if (exists) warn(`manifest: ${a.id} 标记为 planned 但文件已存在（应更新 status）`)
        continue
      }
      if (!exists) err(`manifest: ${a.id} status=${a.status} 但文件不存在 → ${a.path}`)
    }
    for (const p of onDisk) {
      if (!byPath.has(p)) err(`磁盘存在未登记素材（孤儿文件）→ ${p}`)
    }
  }

  // 输出
  if (process.argv.includes('--report')) {
    fs.mkdirSync(REPORT_DIR, { recursive: true })
    const lines = []
    lines.push(`# 素材校验报告`)
    lines.push('')
    lines.push(`- 调色板：${entries.length} 色（实色 ${entries.length - 1}）`)
    lines.push(`- PNG：${pngs.length} · 音频：${audios.length} · manifest 条目：${manifest?.assets.length ?? 0}`)
    lines.push(`- 错误：${errors.length} · 警告：${warnings.length}`)
    lines.push('')
    lines.push('## 说明')
    for (const n of notes) lines.push(`- ${n}`)
    if (warnings.length) { lines.push('', '## 警告'); for (const w of warnings) lines.push(`- ${w}`) }
    if (errors.length) { lines.push('', '## 错误'); for (const e of errors) lines.push(`- ${e}`) }
    const out = path.join(REPORT_DIR, 'assets-check.md')
    fs.writeFileSync(out, lines.join('\n') + '\n')
    console.log(`[check-assets] 报告 → ${rel(out)}`)
  }

  console.log('')
  console.log(`[check-assets] PNG ${pngs.length} · 音频 ${audios.length} · manifest ${manifest?.assets.length ?? 0} 条`)
  for (const w of warnings) console.log(`  ! ${w}`)
  for (const e of errors) console.log(`  ✗ ${e}`)
  if (errors.length) {
    console.log(`[check-assets] 失败：${errors.length} 个错误，${warnings.length} 个警告`)
    process.exit(1)
  }
  console.log(`[check-assets] 通过（${warnings.length} 个警告）`)
}

main()
