#!/usr/bin/env node
/**
 * L2 生产线：GB 四通道 PSG 合成器 —— `.psg.txt` 音序 → WAV(PCM 16bit) → OGG Vorbis。
 *
 * 用法：
 *   node scripts/gen-audio.mjs                 # 合成全部（幂等：内容未变不触碰文件）
 *   node scripts/gen-audio.mjs bgm-qingyun     # 只合成指定 id
 *
 * 零第三方依赖：WAV 由 node 内置模块手写；OGG 由 ffmpeg（libvorbis）转码。
 * 中间 WAV 写在 runtime/tmp/gen-audio/（runtime/ 不入库，见 AGENTS §四）。
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `.psg.txt` 格式（本脚本定义，纯文本、可 diff、可 review）
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   # 注释行（'#' 开头，可出现在任何位置）
 *   @id        bgm-qingyun                 曲目 id（= 产物文件名主干）
 *   @out       src/assets/audio/bgm/bgm-qingyun.ogg
 *   @format    bgm                          bgm = 44.1kHz 立体声 128kbps
 *                                           sfx = 44.1kHz 单声道 96kbps
 *   @tempo     84                           BPM；1 拍 = 1 个四分音符
 *   @loop      yes                          是否要求无缝循环（yes 时脚本会核对首尾）
 *   @duty      sq1=50, sq2=25               方波占空比 %，只允许 12.5 / 25 / 50 / 75
 *   @gain      sq1=11, sq2=8, tri=12, noi=9 通道默认音量（0~15，GB 式 4bit）
 *   @pan       sq1=-0.28, sq2=0.28          可选：立体声像 -1~1（@format bgm 生效）
 *   ---
 *   # 正文：每行一个事件 —— 通道 音符 时值(拍) 音量(0~15)
 *   #   通道：sq1 | sq2 | tri | noi
 *   #   音符：c4 / d#5 / bb3 / -（休止）
 *   #         noi 通道的音符只决定 LFSR 时钟（音色明暗）：低音=闷底鼓，高音=亮踩镲
 *   #   时值：以拍为单位，可小数（4 = 全音符，1 = 四分，0.25 = 十六分）
 *   #   音量：0~15；缺省时用 @gain 的通道默认值
 *   #   两个可选后缀（紧跟在音符后）：
 *   #     %25     本音临时改占空比（仅 sq1/sq2）
 *   #     ~c1     本音内从当前音高扫到目标音高（对数插值；噪声做底鼓、三角做滑音）
 *   sq1  a4   1    12
 *   tri  a2   2    13
 *   noi  c1   0.25 15
 *   noi  -    0.25 0
 *
 * 同一通道的事件按出现顺序依次推进自己的时间游标；各通道必须铺满同样多的拍数
 * （不足请显式写休止），否则脚本报错 —— 这是"循环点对齐"的前提，不做自动补齐。
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 无缝循环是怎么保证的（数学，不靠试听）
 * ─────────────────────────────────────────────────────────────────────────
 *   1. 长度：全曲长度 = 总拍数 × (60/BPM) × 44100，取整到采样点；
 *      每个音的起止采样点都由"累计拍数 × 每拍采样数"取整得到，
 *      因此最后一个音的结束点必然正好是 L（循环点）。
 *   2. 包络：每个音的包络在首采样与末采样都**严格等于 0**
 *      （线性起振 env(0)=0；线性释放 env(L-1)=0；噪声通道一路衰减到 0）。
 *   3. 相位：每个音在自己的起点重置相位为 0 —— 这是 PSG 的真实行为，
 *      配合第 2 条，任何音的起止都不会产生阶跃 ⇒ 循环点上信号必然连续。
 *   脚本会输出首/末 100ms 的 RMS 能量差与首末采样值供核对。
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PSG_DIR = path.join(ROOT, 'src', 'assets', 'psg')
const TMP_DIR = path.join(ROOT, 'runtime', 'tmp', 'gen-audio')
const SAMPLE_RATE = 44100
const AUDIO_MAX_BYTES = 2 * 1024 * 1024

const ALL_CHANNELS = ['sq1', 'sq2', 'tri', 'noi']
const DUTY_ALLOWED = [12.5, 25, 50, 75]

/** 每通道音色参数：amp 是合成基准幅度，pan 是默认声像 */
const VOICE = {
  sq1: { wave: 'square', amp: 0.30, pan: -0.28 },
  sq2: { wave: 'square', amp: 0.24, pan: 0.28 },
  tri: { wave: 'triangle', amp: 0.42, pan: 0 },
  noi: { wave: 'noise', amp: 0.30, pan: 0 },
}

const SEMITONE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
const NOTE_RE = /^([a-g])([#b]?)(-?\d+)$/

/** 音符名 → 频率（十二平均律，A4=440） */
function noteToFreq(token) {
  const m = NOTE_RE.exec(token)
  if (!m) throw new Error(`非法音符 '${token}'（应为 c4 / d#5 / bb3 / -）`)
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  const midi = (Number(m[3]) + 1) * 12 + SEMITONE[m[1]] + acc
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/* ───────────────────────── 1. 解析 .psg.txt ───────────────────────── */

function parsePsg(text, origin) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const meta = {}
  const events = []
  let inBody = false

  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) return
    if (!inBody) {
      if (/^-{3,}$/.test(line)) { inBody = true; return }
      const m = /^@([A-Za-z][\w-]*)\s+(.*)$/.exec(line)
      if (!m) throw new Error(`${origin}:${i + 1}: 头部应为 '@key value' 或 '---'，实际：${line.slice(0, 40)}`)
      meta[m[1].toLowerCase()] = m[2].trim()
      return
    }
    const parts = line.split(/\s+/)
    if (parts.length < 3) throw new Error(`${origin}:${i + 1}: 事件行应为 '通道 音符 时值 [音量]'`)
    const [ch, noteTok, beatsTok, volTok] = parts
    if (!ALL_CHANNELS.includes(ch)) throw new Error(`${origin}:${i + 1}: 未知通道 '${ch}'（可用 ${ALL_CHANNELS.join('/')}）`)
    const beats = Number(beatsTok)
    if (!(beats > 0)) throw new Error(`${origin}:${i + 1}: 时值必须是正数，实际 '${beatsTok}'`)
    const vol = volTok === undefined ? null : Number(volTok)
    if (vol !== null && (!Number.isInteger(vol) || vol < 0 || vol > 15)) throw new Error(`${origin}:${i + 1}: 音量必须是 0~15 的整数`)
    events.push({ ch, noteTok, beats, vol, line: i + 1 })
  })

  if (!inBody) throw new Error(`${origin}: 缺少正文档分隔符 '---'`)
  if (!meta.id) throw new Error(`${origin}: 缺少 @id`)
  if (!meta.out) throw new Error(`${origin}: 缺少 @out`)
  const tempo = Number(meta.tempo || 120)
  if (!(tempo > 0)) throw new Error(`${origin}: @tempo 非法`)

  const duty = {}
  for (const ch of ALL_CHANNELS) duty[ch] = ch.startsWith('sq') ? 50 : 0
  for (const kv of (meta.duty || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = kv.split('=').map((s) => s.trim())
    if (!k.startsWith('sq')) throw new Error(`${origin}: @duty 只能用于 sq1/sq2，实际 '${k}'`)
    const d = Number(v)
    if (!DUTY_ALLOWED.includes(d)) throw new Error(`${origin}: @duty ${k}=${v} 不在允许集合 ${DUTY_ALLOWED.join('/')}`)
    duty[k] = d
  }
  const gain = {}
  for (const ch of ALL_CHANNELS) gain[ch] = 12
  for (const kv of (meta.gain || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = kv.split('=').map((s) => s.trim())
    if (!ALL_CHANNELS.includes(k)) throw new Error(`${origin}: @gain 未知通道 '${k}'`)
    const g = Number(v)
    if (!(g >= 0 && g <= 15)) throw new Error(`${origin}: @gain ${k}=${v} 必须在 0~15`)
    gain[k] = g
  }
  const pan = {}
  for (const ch of ALL_CHANNELS) pan[ch] = VOICE[ch].pan
  for (const kv of (meta.pan || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = kv.split('=').map((s) => s.trim())
    if (!ALL_CHANNELS.includes(k)) throw new Error(`${origin}: @pan 未知通道 '${k}'`)
    pan[k] = Math.max(-1, Math.min(1, Number(v)))
  }

  // 逐通道推进游标 → 展开成绝对采样区间
  const cursor = Object.fromEntries(ALL_CHANNELS.map((c) => [c, 0]))
  const notes = []
  let lastLine = {}
  for (const ev of events) {
    const startBeat = cursor[ev.ch]
    const endBeat = startBeat + ev.beats
    cursor[ev.ch] = endBeat
    lastLine[ev.ch] = ev.line
    let noteTok = ev.noteTok
    let dutyOverride = null
    let sweepTok = null
    const pct = noteTok.indexOf('%')
    if (pct >= 0) {
      dutyOverride = Number(noteTok.slice(pct + 1))
      noteTok = noteTok.slice(0, pct)
      if (!DUTY_ALLOWED.includes(dutyOverride)) throw new Error(`${origin}:${ev.line}: 占空比 ${dutyOverride} 不在 ${DUTY_ALLOWED.join('/')}`)
      if (!ev.ch.startsWith('sq')) throw new Error(`${origin}:${ev.line}: %占空比 只能用于 sq1/sq2`)
    }
    const tilde = noteTok.indexOf('~')
    if (tilde >= 0) { sweepTok = noteTok.slice(tilde + 1); noteTok = noteTok.slice(0, tilde) }
    const isRest = noteTok === '-'
    if (!isRest && !NOTE_RE.test(noteTok)) throw new Error(`${origin}:${ev.line}: 非法音符 '${noteTok}'`)
    if (sweepTok !== null && !NOTE_RE.test(sweepTok)) throw new Error(`${origin}:${ev.line}: 非法扫频目标 '${sweepTok}'`)
    notes.push({
      ch: ev.ch,
      startBeat,
      endBeat,
      freq: isRest ? 0 : noteToFreq(noteTok),
      freqTo: sweepTok ? noteToFreq(sweepTok) : null,
      duty: dutyOverride !== null ? dutyOverride / 100 : duty[ev.ch] / 100,
      vol: ev.vol === null ? gain[ev.ch] : ev.vol,
      rest: isRest,
      line: ev.line,
    })
  }

  const totals = ALL_CHANNELS.map((c) => ({ ch: c, beats: cursor[c] }))
  const used = totals.filter((t) => t.beats > 0)
  const totalBeats = used.reduce((a, t) => Math.max(a, t.beats), 0)
  if (!totalBeats) throw new Error(`${origin}: 没有任何音符`)
  for (const t of used) {
    if (Math.abs(t.beats - totalBeats) > 1e-9) {
      throw new Error(`${origin}: 通道 ${t.ch} 共 ${t.beats} 拍 ≠ 全曲 ${totalBeats} 拍（必须等长，请显式补休止；见文件头"无缝循环"第 1 条）`)
    }
  }

  return {
    id: meta.id,
    out: meta.out,
    format: (meta.format || 'bgm').toLowerCase(),
    tempo,
    loop: (meta.loop || 'no').toLowerCase() === 'yes',
    duty,
    gain,
    pan,
    notes,
    totalBeats,
    channels: used.map((t) => t.ch),
    origin,
  }
}

/* ───────────────────────── 2. PSG 合成 ───────────────────────── */

/** 包络：首末采样严格为 0（这是循环无缝的数学保证） */
function envelope(i, n, percussive) {
  if (n <= 1) return 0
  if (percussive) {
    const atk = Math.min(Math.max(1, Math.round(0.0008 * SAMPLE_RATE)), Math.max(1, Math.floor(n * 0.25)))
    const a = i < atk ? i / atk : 1
    const u = i / (n - 1)
    return a * Math.pow(1 - u, 1.5)
  }
  const atk = Math.min(Math.max(1, Math.round(0.003 * SAMPLE_RATE)), Math.max(1, Math.floor(n * 0.3)))
  const rel = Math.min(Math.max(1, Math.round(0.035 * SAMPLE_RATE)), Math.max(1, Math.floor(n * 0.3)))
  if (i < atk) return i / atk
  if (i >= n - rel) return (n - 1 - i) / rel
  return 1
}

function renderChannel(seq, ch) {
  const spb = (SAMPLE_RATE * 60) / seq.tempo
  const total = Math.round(seq.totalBeats * spb)
  const buf = new Float32Array(total)
  const voice = VOICE[ch]
  const percussive = voice.wave === 'noise'
  let phase = 0
  let lfsr = 0x7fff
  let noiseAcc = 0
  let noiseOut = 1
  let lastEnd = -1

  for (const note of seq.notes) {
    if (note.ch !== ch) continue
    if (note.rest || note.vol === 0) { lastEnd = Math.round(note.endBeat * spb); continue }
    const s0 = Math.round(note.startBeat * spb)
    const s1 = Math.round(note.endBeat * spb)
    const n = s1 - s0
    if (n <= 0) continue
    if (s0 < lastEnd) throw new Error(`${seq.origin}: 通道 ${ch} 的音符区间重叠（第 ${note.line} 行）`)
    lastEnd = s1

    const f0 = note.freq
    const ratio = note.freqTo ? note.freqTo / f0 : 1
    const g = Math.pow(note.vol / 15, 1.6) * voice.amp
    phase = 0 // PSG 行为：每个音重置相位
    for (let i = 0; i < n; i++) {
      const f = ratio === 1 ? f0 : f0 * Math.pow(ratio, i / n)
      let v
      if (voice.wave === 'square') {
        phase += f / SAMPLE_RATE
        if (phase >= 1) phase -= Math.floor(phase)
        v = phase < note.duty ? 1 : -1
      } else if (voice.wave === 'triangle') {
        phase += f / SAMPLE_RATE
        if (phase >= 1) phase -= Math.floor(phase)
        v = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4
      } else {
        // 15bit LFSR，时钟频率由音符音高映射（低音=闷，高音=亮）
        const clock = Math.max(120, Math.min(SAMPLE_RATE * 3, f * 24))
        noiseAcc += clock / SAMPLE_RATE
        while (noiseAcc >= 1) {
          noiseAcc -= 1
          const bit = (lfsr ^ (lfsr >> 1)) & 1
          lfsr = (lfsr >> 1) | (bit << 14)
          noiseOut = lfsr & 1 ? 1 : -1
        }
        v = noiseOut
      }
      buf[s0 + i] += v * g * envelope(i, n, percussive)
    }
  }
  return { buf, total }
}

/** 把各通道按声像混合成 [L,R]；peak 归一化到 0.85 */
function mixdown(channels, pans, stereo) {
  const total = channels[channels[0]] ? channels[channels[0]].length : 0
  const L = new Float32Array(total)
  const R = new Float32Array(total)
  for (const [ch, buf] of Object.entries(channels)) {
    const pan = stereo ? pans[ch] : 0
    const th = ((pan + 1) * Math.PI) / 4
    const gl = stereo ? Math.cos(th) : Math.SQRT1_2
    const gr = stereo ? Math.sin(th) : Math.SQRT1_2
    for (let i = 0; i < total; i++) {
      L[i] += buf[i] * gl
      R[i] += buf[i] * gr
    }
  }
  let peak = 0
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
  const norm = peak > 0 ? 0.85 / peak : 1
  for (let i = 0; i < total; i++) { L[i] *= norm; R[i] *= norm }
  return { L, R, total, peak, norm }
}

/** 首尾 100ms 能量对照（无缝循环核对） */
function seamReport(L, R, total) {
  const win = Math.min(Math.round(0.1 * SAMPLE_RATE), total)
  const rms = (from, n) => {
    let s = 0
    for (let i = from; i < from + n; i++) { s += L[i] * L[i] + R[i] * R[i] }
    return Math.sqrt(s / (2 * n))
  }
  const head = rms(0, win)
  const tail = rms(total - win, win)
  const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf')
  return {
    head,
    tail,
    deltaDb: head > 0 && tail > 0 ? Math.abs(20 * Math.log10(head / tail)) : Infinity,
    text: `首 100ms RMS ${db(head)} dBFS · 末 100ms RMS ${db(tail)} dBFS · 能量差 ${head > 0 && tail > 0 ? Math.abs(20 * Math.log10(head / tail)).toFixed(2) : 'n/a'} dB`,
  }
}

/* ───────────────────────── 3. WAV 编码 ───────────────────────── */

function encodeWav(channelBufs) {
  const numCh = channelBufs.length
  const n = channelBufs[0].length
  const dataBytes = n * numCh * 2
  const buf = Buffer.alloc(44 + dataBytes)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataBytes, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(numCh, 22)
  buf.writeUInt32LE(SAMPLE_RATE, 24)
  buf.writeUInt32LE(SAMPLE_RATE * numCh * 2, 28)
  buf.writeUInt16LE(numCh * 2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataBytes, 40)
  let o = 44
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < numCh; c++) {
      const v = Math.max(-1, Math.min(1, channelBufs[c][i]))
      buf.writeInt16LE(Math.round(v * 32767), o)
      o += 2
    }
  }
  return buf
}

/* ───────────────────────── 4. ffmpeg 转码 ───────────────────────── */

const FORMAT_SPEC = {
  bgm: { channels: 2, bitrate: '128k' },
  sfx: { channels: 1, bitrate: '96k' },
}

function transcode(wavPath, outPath, format) {
  const spec = FORMAT_SPEC[format] || FORMAT_SPEC.bgm
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', wavPath,
    '-c:a', 'libvorbis',
    '-ar', String(SAMPLE_RATE),
    '-ac', String(spec.channels),
    '-b:a', spec.bitrate,
    '-map_metadata', '-1',
    '-flags:a', '+bitexact',
    '-fflags', '+bitexact',
    outPath,
  ], { stdio: ['ignore', 'ignore', 'inherit'] })
}

function probe(file) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels', '-show_entries', 'format=duration', '-of', 'json', file], { encoding: 'utf8' })
    const info = JSON.parse(out)
    const st = info.streams?.[0] || {}
    return { sampleRate: Number(st.sample_rate), channels: Number(st.channels), duration: Number(info.format?.duration || 0) }
  } catch {
    return null
  }
}

/** 只在内容变化时写盘（幂等且不产生无意义的 mtime 变更） */
function writeIfChanged(outPath, buf) {
  if (fs.existsSync(outPath) && fs.readFileSync(outPath).equals(buf)) return 'unchanged'
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, buf)
  return 'written'
}

/* ───────────────────────── 5. 音序合成入口 ───────────────────────── */

function synthSequence(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  const seq = parsePsg(fs.readFileSync(file, 'utf8'), rel)
  const stereo = seq.format === 'bgm'
  const chans = {}
  for (const ch of seq.channels) chans[ch] = renderChannel(seq, ch).buf
  const mixed = mixdown(chans, seq.pan, stereo)
  const outAbs = path.join(ROOT, seq.out)
  fs.mkdirSync(TMP_DIR, { recursive: true })
  const wavPath = path.join(TMP_DIR, `${seq.id}.wav`)

  const wav = encodeWav(stereo ? [mixed.L, mixed.R] : [mixed.L])
  fs.writeFileSync(wavPath, wav)
  // 先转码到 runtime/tmp/，内容未变则不触碰入库文件（幂等 + 不制造无意义的 mtime 变更）
  const tmpOgg = path.join(TMP_DIR, `${seq.id}.ogg`)
  transcode(wavPath, tmpOgg, seq.format)
  const state = writeIfChanged(outAbs, fs.readFileSync(tmpOgg))

  const seconds = mixed.total / SAMPLE_RATE
  const seam = seamReport(mixed.L, mixed.R, mixed.total)
  const size = fs.statSync(outAbs).size
  console.log(`[gen-audio] ${seq.id}  ${seq.tempo} BPM · ${seq.totalBeats} 拍 · ${seconds.toFixed(2)}s · ${seq.channels.join('+')}`)
  console.log(`            峰值 ${mixed.peak.toFixed(3)} → 归一化 ×${mixed.norm.toFixed(3)}（${stereo ? '立体声' : '单声道'}）`)
  console.log(`            循环点：全部音末包络 = 0 · 首采样 ${mixed.L[0].toFixed(4)} / 末采样 ${mixed.L[mixed.total - 1].toFixed(4)}`)
  console.log(`            ${seam.text}`)
  if (seq.loop && seam.deltaDb > 12) console.log(`            ! 首尾能量差偏大（${seam.deltaDb.toFixed(1)} dB），循环听感可能突兀`)
  if (size > AUDIO_MAX_BYTES) throw new Error(`${seq.out}: ${(size / 1024 / 1024).toFixed(2)} MB 超过 2MB 上限（doc/14 §10.5）`)
  console.log(`            产物 ${seq.out}  ${(size / 1024).toFixed(1)} KB  (${state === 'written' ? '新写入' : '未变'})`)
  return { id: seq.id, out: seq.out, seconds, size, seam, state }
}

/* ───────────────────────── 6. SFX 参数表（无 .psg.txt） ───────────────────────── */
/**
 * UI 点击音不需要音序：直接用参数表描述——波形 / 包络 / 频率扫描 / 噪声混合 / 时长。
 * 时长必须 ≤ 80ms（doc/14 §10.3），体积 ≤ 50KB（doc/14 §10.5）。
 */
const SFX_TABLE = [
  {
    id: 'sfx-ui-click',
    out: 'src/assets/audio/sfx/sfx-ui-click.ogg',
    format: 'sfx',
    durationMs: 58,
    // 层：波形、起止频率（Hz）、增益、起振/释放（ms）、曲线指数
    layers: [
      { wave: 'square', duty: 0.5, from: 1720, to: 880, gain: 0.55, attackMs: 0.6, releaseMs: 16, curve: 2.2 },
      { wave: 'noise', from: 5200, to: 2600, gain: 0.22, attackMs: 0.3, releaseMs: 7, curve: 2.6 },
    ],
  },
]

function synthSfx(spec) {
  const n = Math.round((spec.durationMs / 1000) * SAMPLE_RATE)
  const buf = new Float32Array(n)
  let lfsr = 0x2b1d
  let acc = 0
  let noiseOut = 1
  for (const layer of spec.layers) {
    const atk = Math.max(1, Math.round((layer.attackMs / 1000) * SAMPLE_RATE))
    const rel = Math.max(1, Math.round((layer.releaseMs / 1000) * SAMPLE_RATE))
    let phase = 0
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1 || 1)
      const f = layer.from * Math.pow(layer.to / layer.from, u)
      let v
      if (layer.wave === 'square') {
        phase += f / SAMPLE_RATE
        if (phase >= 1) phase -= Math.floor(phase)
        v = phase < layer.duty ? 1 : -1
      } else {
        acc += Math.min(SAMPLE_RATE * 3, f * 12) / SAMPLE_RATE
        while (acc >= 1) {
          acc -= 1
          const bit = (lfsr ^ (lfsr >> 1)) & 1
          lfsr = (lfsr >> 1) | (bit << 14)
          noiseOut = lfsr & 1 ? 1 : -1
        }
        v = noiseOut
      }
      const a = i < atk ? i / atk : 1
      const r = i >= n - rel ? (n - 1 - i) / rel : 1
      const shape = Math.pow(1 - u, layer.curve)
      buf[i] += v * layer.gain * a * r * Math.max(shape, 1e-6)
    }
  }
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(buf[i]))
  const norm = peak > 0 ? 0.9 / peak : 1
  for (let i = 0; i < n; i++) buf[i] *= norm
  // 首末采样强制归零，避免设备端爆音
  buf[0] = 0
  buf[n - 1] = 0

  const outAbs = path.join(ROOT, spec.out)
  fs.mkdirSync(TMP_DIR, { recursive: true })
  const wavPath = path.join(TMP_DIR, `${spec.id}.wav`)
  fs.writeFileSync(wavPath, encodeWav([buf]))
  const tmpOgg = path.join(TMP_DIR, `${spec.id}.ogg`)
  transcode(wavPath, tmpOgg, spec.format)
  const state = writeIfChanged(outAbs, fs.readFileSync(tmpOgg))
  const size = fs.statSync(outAbs).size
  if (size > AUDIO_MAX_BYTES) throw new Error(`${spec.out}: 超过 2MB 上限`)
  const maxMs = 80
  if (spec.durationMs > maxMs) throw new Error(`${spec.id}: ${spec.durationMs}ms > ${maxMs}ms（doc/14 §10.3）`)
  console.log(`[gen-audio] ${spec.id}  参数表合成 · ${spec.durationMs}ms · ${spec.layers.length} 层（${spec.layers.map((l) => l.wave).join('+')}）`)
  console.log(`            产物 ${spec.out}  ${(size / 1024).toFixed(1)} KB  (${state === 'written' ? '新写入' : '未变'})`)
  return { id: spec.id, out: spec.out, seconds: spec.durationMs / 1000, size, state }
}

/* ───────────────────────── main ───────────────────────── */

function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const psgFiles = fs.existsSync(PSG_DIR)
    ? fs.readdirSync(PSG_DIR).filter((f) => f.endsWith('.psg.txt')).sort().map((f) => path.join(PSG_DIR, f))
    : []
  if (!psgFiles.length && !only.length) console.log(`[gen-audio] ${path.relative(ROOT, PSG_DIR)} 下没有 .psg.txt`)

  const done = []
  for (const file of psgFiles) {
    const id = path.basename(file).replace(/\.psg\.txt$/, '')
    if (only.length && !only.includes(id)) continue
    done.push(synthSequence(file))
  }
  for (const spec of SFX_TABLE) {
    if (only.length && !only.includes(spec.id)) continue
    done.push(synthSfx(spec))
  }

  console.log('')
  console.log(`[gen-audio] 共 ${done.length} 个音频产物`)
  for (const d of done) console.log(`  · ${d.out}  ${d.seconds.toFixed(2)}s  ${(d.size / 1024).toFixed(1)} KB${d.seam ? `  首尾能量差 ${d.seam.deltaDb.toFixed(2)} dB` : ''}`)
}

main()
