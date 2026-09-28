/**
 * 零依赖 PNG-8（索引色）编码与解码。
 *
 * 为什么手写而不是用 sharp / canvas：
 *  - 只依赖 node 内置 zlib，换机器与 CI 无需原生依赖；
 *  - 索引色输出天然强制调色板合规（doc/14 §2 的硬规则）；
 *  - 两个 agent 都能直接跑，不需要装包。
 *
 * 只支持我们产出的格式子集：8 位索引色、无隔行、扫描线 filter 恒为 0。
 * 读到 filter != 0 的文件会抛错（说明该文件不是本管线产出的）。
 */

import zlib from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

/** #rrggbb -> [r, g, b] */
export function hexToRgb(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) throw new Error(`invalid hex color: ${hex}`)
  const v = parseInt(m[1], 16)
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]
}

/** [r, g, b] -> #rrggbb */
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
}

/**
 * 编码为 8 位索引色 PNG。
 * @param {object} o
 * @param {number} o.width
 * @param {number} o.height
 * @param {Uint8Array} o.indices  长度必须等于 width*height，值为调色板索引
 * @param {Array<[number,number,number]>} o.palette  RGB 三元组，顺序即索引
 * @param {Uint8Array} [o.alpha]  每个索引的 alpha；省略则全不透明
 * @returns {Buffer}
 */
export function encodeIndexedPng({ width, height, indices, palette, alpha }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`bad size ${width}x${height}`)
  }
  if (indices.length !== width * height) {
    throw new Error(`indices length ${indices.length} != ${width}x${height}`)
  }
  if (palette.length < 1 || palette.length > 256) {
    throw new Error(`palette size ${palette.length} out of range`)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 3 // color type: indexed
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  const plte = Buffer.alloc(palette.length * 3)
  palette.forEach((rgb, i) => {
    plte[i * 3] = rgb[0]
    plte[i * 3 + 1] = rgb[1]
    plte[i * 3 + 2] = rgb[2]
  })

  const parts = [
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
  ]

  if (alpha) {
    let last = -1
    for (let i = 0; i < alpha.length; i++) if (alpha[i] !== 255) last = i
    if (last >= 0) parts.push(chunk('tRNS', Buffer.from(alpha.subarray(0, last + 1))))
  }

  const stride = width + 1
  const raw = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0 // filter: none
    raw.set(indices.subarray(y * width, (y + 1) * width), y * stride + 1)
  }

  parts.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9 })))
  parts.push(chunk('IEND', Buffer.alloc(0)))
  return Buffer.concat(parts)
}

/**
 * 读取 8 位索引色 PNG。返回调色板与逐像素索引，供校验器比对。
 * @param {Buffer} buf
 * @returns {{width:number,height:number,bitDepth:number,colorType:number,palette:Array<[number,number,number]>,alpha:Uint8Array|null,indices:Uint8Array,interlace:number}}
 */
export function decodeIndexedPng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG (bad signature)')

  let offset = 8
  let header = null
  let palette = null
  let alpha = null
  const idat = []

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const data = buf.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length

    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      }
    } else if (type === 'PLTE') {
      palette = []
      for (let i = 0; i < data.length; i += 3) palette.push([data[i], data[i + 1], data[i + 2]])
    } else if (type === 'tRNS') {
      alpha = new Uint8Array(data)
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data))
    } else if (type === 'IEND') {
      break
    }
  }

  if (!header) throw new Error('PNG missing IHDR')
  if (header.colorType !== 3) throw new Error(`not indexed color (colorType=${header.colorType})`)
  if (header.bitDepth !== 8) throw new Error(`unsupported bit depth ${header.bitDepth} (expected 8)`)
  if (header.interlace !== 0) throw new Error('interlaced PNG not supported')
  if (!palette) throw new Error('PNG missing PLTE')

  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = header.width + 1
  if (raw.length !== header.height * stride) {
    throw new Error(`inflated size ${raw.length} != ${header.height * stride}`)
  }
  const indices = new Uint8Array(header.width * header.height)
  for (let y = 0; y < header.height; y++) {
    const filter = raw[y * stride]
    if (filter !== 0) throw new Error(`row ${y} uses filter ${filter}; only filter 0 is supported`)
    indices.set(raw.subarray(y * stride + 1, y * stride + 1 + header.width), y * header.width)
  }

  return { ...header, palette, alpha, indices }
}

/** 构建 encodeIndexedPng 需要的 palette / alpha 数组（来自 palette.json 的 entries） */
export function paletteArrays(entries) {
  return {
    palette: entries.map((e) => hexToRgb(e.hex)),
    alpha: Uint8Array.from(entries.map((e) => (e.alpha === undefined ? 255 : e.alpha))),
  }
}
