/**
 * `.px.txt` 像素矩阵解析器（卡带机风格 L1 生产线）。
 *
 * 格式（纯文本，可 diff、可 review、LLM 友好）：
 *
 *   # 注释行（可省略）
 *   @id    sprite-player-walk-down-f0
 *   @size  32x48
 *   @anchor 16,47
 *   @tags  player walk down frame0
 *   ---
 *   .....1111111.....
 *   ...11222222211...
 *   ...
 *
 * 像素字符集（16 个符号，一一对应调色板索引）：
 *   `.` → 索引 0（透明槽）
 *   `1`-`9` → 索引 1-9
 *   `a`-`f` → 索引 10-15
 *
 * 硬规则（由 render-pixels.mjs 强制）：
 *   - 每行字符数必须等于 @size 的宽；
 *   - 行数必须等于 @size 的高；
 *   - 字符必须在字符集内；
 *   - 瓦片类（kind=tile）禁止出现 `.`（瓦片必须完全不透明）。
 */

export const PIXEL_CHARS = '.123456789abcdef'

const CHAR_TO_INDEX = new Map([...PIXEL_CHARS].map((c, i) => [c, i]))

/**
 * @param {string} text
 * @param {string} [origin] 出错时用于定位的文件名
 * @returns {{id:string|null,size:[number,number],anchor:[number,number]|null,tags:string[],rows:string[],indices:Uint8Array,usesTransparent:boolean}}
 */
export function parsePx(text, origin = '<px>') {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const meta = {}
  const rows = []
  let inBody = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!inBody) {
      const trimmed = line.trim()
      if (trimmed === '') continue
      if (trimmed.startsWith('#')) continue
      if (/^-{3,}$/.test(trimmed)) { inBody = true; continue }
      const m = /^@([A-Za-z][\w-]*)\s+(.*)$/.exec(trimmed)
      if (!m) throw new Error(`${origin}:${i + 1}: expected '@key value' or '---', got: ${trimmed.slice(0, 40)}`)
      meta[m[1].toLowerCase()] = m[2].trim()
      continue
    }
    // 正文：保留整行（不 trim，避免吃掉表示透明的点）
    if (line.length === 0 && i === lines.length - 1) continue
    rows.push(line)
  }

  if (!inBody) throw new Error(`${origin}: missing body separator '---'`)
  if (!meta.size) throw new Error(`${origin}: missing @size`)
  const sizeMatch = /^(\d+)\s*[x×]\s*(\d+)$/.exec(meta.size)
  if (!sizeMatch) throw new Error(`${origin}: bad @size '${meta.size}' (expected WxH)`)
  const width = Number(sizeMatch[1])
  const height = Number(sizeMatch[2])

  if (rows.length !== height) {
    throw new Error(`${origin}: expected ${height} rows, got ${rows.length}`)
  }

  const indices = new Uint8Array(width * height)
  let usesTransparent = false
  for (let y = 0; y < height; y++) {
    const row = rows[y]
    if (row.length !== width) {
      throw new Error(`${origin}: row ${y + 1} has ${row.length} chars, expected ${width}`)
    }
    for (let x = 0; x < width; x++) {
      const c = row[x]
      const idx = CHAR_TO_INDEX.get(c)
      if (idx === undefined) {
        throw new Error(`${origin}: row ${y + 1} col ${x + 1}: illegal pixel char '${c}' (allowed: ${PIXEL_CHARS})`)
      }
      if (idx === 0) usesTransparent = true
      indices[y * width + x] = idx
    }
  }

  const anchor = meta.anchor
    ? (() => {
        const m = /^(\d+)\s*,\s*(\d+)$/.exec(meta.anchor)
        if (!m) throw new Error(`${origin}: bad @anchor '${meta.anchor}' (expected x,y)`)
        return [Number(m[1]), Number(m[2])]
      })()
    : null

  return {
    id: meta.id || null,
    out: meta.out || null,
    kind: meta.kind || null,
    size: [width, height],
    anchor,
    tags: meta.tags ? meta.tags.split(/\s+/).filter(Boolean) : [],
    rows,
    indices,
    usesTransparent,
  }
}

/** 把若干等尺寸帧横向/网格拼合为一张图集 */
export function composeGrid(frames, cellWidth, cellHeight, columns) {
  const rows = Math.ceil(frames.length / columns)
  const width = columns * cellWidth
  const height = rows * cellHeight
  const indices = new Uint8Array(width * height)
  frames.forEach((frame, i) => {
    const cx = (i % columns) * cellWidth
    const cy = Math.floor(i / columns) * cellHeight
    for (let y = 0; y < cellHeight; y++) {
      for (let x = 0; x < cellWidth; x++) {
        indices[(cy + y) * width + cx + x] = frame.indices[y * cellWidth + x]
      }
    }
  })
  return { width, height, indices, columns, rows }
}

/** 把索引图整数放大（像素完美，不做插值） */
export function scaleNearest(indices, width, height, factor) {
  const outW = width * factor
  const outH = height * factor
  const out = new Uint8Array(outW * outH)
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      out[y * outW + x] = indices[Math.floor(y / factor) * width + Math.floor(x / factor)]
    }
  }
  return { width: outW, height: outH, indices: out }
}

/** 3×3 平铺，用于肉眼检查接缝 */
export function tile3x3(indices, width, height) {
  const outW = width * 3
  const outH = height * 3
  const out = new Uint8Array(outW * outH)
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      out[y * outW + x] = indices[(y % height) * width + (x % width)]
    }
  }
  return { width: outW, height: outH, indices: out }
}
