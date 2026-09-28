#!/usr/bin/env node
/**
 * L0 程序化瓦片生成 —— 6 张**构造性无缝**瓦片集，每张 128×128（4 列 × 4 行 × 32px cell）。
 *
 * 表驱动：所有表都是同一个 `main()` 跑出来的，行/变体描述集中在文件末尾的 `TILESETS` 表里，
 * 新增一张表 = 加一条记录 + 几个图案函数，不存在第 7 份几乎相同的 main。
 *
 * ── 无缝是怎么保证的 ────────────────────────────────────────────
 * 图案只由 **模运算 + 确定性哈希** 决定，且所有周期都整除 32（1/2/4/8/16/32）：
 *   - 行方向：`y % 8`、`Math.floor(y / 4)` 之类；
 *   - 列方向：`x % 8`、`(x + shift) % 16` 之类（shift 只按行取常数，不破坏周期性）；
 *   - 「不规则」形状（裂缝、水洼、阵纹）用**线性组合取模 32**：`(3x + 5y + c) % 32`，
 *     它对 x、y 都是周期 32，因此天生四向可拼接。
 * 于是右边界接左边界、下边界接上边界天然连续，不需要拼接期修补。
 *
 * ── 接缝指标的坑（check-assets 的 ratio > 2 直接判错）────────────
 * 指标只统计**列边界**（x = 31|32、63|64、95|96 以及 127→0）的相邻像素差，
 * 与全图内部均值相比。所以**禁止把高对比特征锚死在 x = 0 / 31 两列**：
 *   - 石砖灰缝：`(x + shift) % 16 === 0`，shift 取 12/4 → 竖缝落在 x%16 ∈ {4,12}，永不落 0/31；
 *   - 碎石石缝：`(x + 2) % 4 === 0` → 落在 x%4 = 2；
 *   - 门窗/物件：内容外留 ≥ 3px 的同类底（夯土墙面 / 深墨青暗部），边界列不参与造型。
 * 瓦顶瓦垄、木构板缝这类「边界列两侧同为暗色」的图案不受影响（BRONZE/STONE 亮色只在中间列）。
 *
 * 硬规则：**瓦片禁止使用索引 0**（buildSheet 会直接抛错）；调色板严格 16 色（见 lib/artkit.mjs）。
 * 每张表额外输出一张 3×3 平铺预览到 runtime/reports/（runtime/ 不入库），供肉眼查接缝。
 *
 * 幂等：seed 全部固定（seedBase + row*97 + col*13），重复执行字节一致。
 *
 * 用法：node scripts/gen-tiles.mjs
 */

import path from 'node:path'
import {
  BAYER4,
  C,
  ROOT,
  buildSheet,
  dither,
  frame,
  hash2,
  hline,
  loadPalette,
  put,
  rect,
  seamRatio,
  vline,
  writePng,
} from './lib/artkit.mjs'
import { tile3x3 } from './lib/pixels.mjs'

const TILE = 32
const COLS = 4
const ROWS = 4
const PREVIEW_DIR = path.join(ROOT, 'runtime', 'reports')

// ══════════════════════════════════════════════════════════════════
// 一、town-ground（原有地貌：函数与种子保持原样，重构后输出字节不变）
// ══════════════════════════════════════════════════════════════════

function flagstone(x, y, seed) {
  const bw = 16
  const bh = 8
  const row = Math.floor(y / bh)
  const sx = (x + (row % 2 ? bw / 2 : 0)) % TILE
  const localX = sx % bw
  const localY = y % bh
  if (localX === 0 || localY === 0) return C.TEAL_DARK // 灰缝
  const bx = Math.floor(sx / bw)
  const v = hash2(bx, row, seed)
  const d = BAYER4[y % 4][x % 4]
  if (hash2(x, y, seed + 7) > 0.94) return C.TEAL_DARK // 暗斑
  if (localY === 1 && d > 3) return C.STONE // 上沿高光
  let base = v < 0.25 ? C.STONE : C.TEAL_MID
  if (base === C.STONE && d < 7) base = C.TEAL_MID // 抖动避免大片纯色
  return base
}

function dirt(x, y, seed) {
  const v = hash2(x, y, seed)
  const d = BAYER4[y % 4][x % 4]
  if (v > 0.975) return C.INK // 碎石暗点
  if (v > 0.94) return C.BRONZE // 亮土粒
  if (d < 3) return C.BRONZE
  return C.BRONZE_DARK
}

function grass(x, y, seed) {
  const v = hash2(x, y, seed)
  const d = BAYER4[y % 4][x % 4]
  if (v > 0.992 && y % 3 === 0) return C.TEAL_MID // 草尖
  if (v > 0.93) return C.TEAL_MID
  if (v < 0.1) return C.TEAL_DARK
  if (d < 4) return C.TEAL_DARK
  return C.MOSS
}

function mossyStone(x, y, seed) {
  const s = flagstone(x, y, seed)
  const patch = hash2(Math.floor(x / 8), Math.floor(y / 8), seed + 31)
  if (patch > 0.7 && s === C.TEAL_MID) return hash2(x, y, seed + 5) > 0.45 ? C.MOSS : C.TEAL_DARK
  return s
}

// ══════════════════════════════════════════════════════════════════
// 二、town-building：夯土墙 / 木构墙 / 瓦顶 / 门窗
//     列 0 是「墙顶·压顶」变体：顶部三行受光 + 一道压暗线，
//     与 doc/10 §2 的 building 层配合即可做出体积感（墙顶 + 墙面 + 墙脚）；
//     行 2 列 0 的屋脊/檐口还能给 overhead 层收边，不需要 tileoffset（doc/14 §6.1）。
// ══════════════════════════════════════════════════════════════════

/** 夯土墙：水平夯层（周期 8）+ 碎石 + 土粒；列 0 = 压顶变体 */
function rammedEarth(x, y, seed, variant) {
  if (variant === 0) {
    if (y === 0) return C.BRONZE_LIGHT // 压顶受光棱
    if (y === 1 || y === 2) return C.BRONZE
    if (y === 3) return C.INK // 压顶下的投影线
  }
  const phase = (variant * 3) % 8 // 夯层错位；周期仍是 8（32 % 8 === 0），竖向无缝
  const band = (y + phase) % 8
  const n = hash2(x, y, seed)
  if (band === 7) return C.INK // 夯层接缝
  if (n > 0.965) return C.INK // 土中暗粒
  if (n < 0.04) return C.STONE // 半埋碎石
  if (band === 0) return C.BRONZE // 夯层受光面
  if (band === 1) return dither(C.BRONZE, C.BRONZE_DARK, x, y, 6) // 层间过渡（只一行抖动，避免整片棋盘感）
  if (n > 0.86) return C.BRONZE // 土粒
  return C.BRONZE_DARK
}

/** 木构墙：竖板（板宽 8，周期 8）；列 0 = 压顶横梁，列 2 = 横向铜箍，列 3 = 旧墙苔痕 */
function timberWall(x, y, seed, variant) {
  if (variant === 0) {
    if (y === 0) return C.INK
    if (y === 1) return C.BRONZE_LIGHT // 梁面受光
    if (y === 2) return C.BRONZE
    if (y === 3) return C.BRONZE_DARK
    if (y === 4) return C.INK // 梁下投影
  }
  if (variant === 2 && y % 16 < 3) {
    // 铜箍：y 周期 16，仍整除 32，竖向照样无缝
    if (y % 16 === 0) return C.INK
    return y % 16 === 1 ? C.BRONZE : C.BRONZE_DARK
  }
  const px = x % 8
  const n = hash2(x, y, seed)
  if (px === 0) return C.INK // 板缝
  let v = px === 1 || px === 6 ? C.TEAL_DARK : C.MOSS // 缝内侧暗（光自左上）
  if (n > 0.9) v = C.TEAL_DARK
  if (n < 0.06) v = C.BRONZE_DARK // 木节
  if (variant === 3 && hash2(Math.floor(x / 4), Math.floor(y / 4), seed + 41) > 0.8) v = C.TEAL_DARK // 苔痕
  return v
}

/** 瓦垄剖面（周期 8）：0=垄沟、2=垄脊受光、5/6=背光面 —— 亮色居中，边界列两侧同暗 */
const ROOF_PROFILE = [C.INK, C.TEAL_MID, C.STONE, C.TEAL_MID, C.TEAL_MID, C.TEAL_DARK, C.TEAL_DARK, C.INK]

/** 瓦顶：竖瓦垄（周期 8）× 横瓦垄缝（周期 16）；列 0 = 屋脊/檐口变体 */
function roofTiles(x, y, seed, variant) {
  if (variant === 0) {
    if (y <= 1) return C.INK // 屋脊线
    if (y === 2) return C.STONE // 脊面受光
    if (y === 3) return C.TEAL_DARK
    if (y >= 30) return C.INK // 檐口投影（接 overhead 层）
  }
  const px = x % 8
  let v = ROOF_PROFILE[px]
  const course = y % 16
  if (course === 0) v = C.INK // 横缝
  else if (course === 1) v = px === 2 ? C.STONE : C.TEAL_MID
  if (variant === 1 && px === 2) v = C.TEAL_MID // 列 1：旧瓦，垄脊不再反光
  if (variant === 2 && hash2(Math.floor(x / 4), Math.floor(y / 4), seed + 11) > 0.88) v = C.MOSS // 列 2：青苔瓦
  if (variant === 3 && hash2(Math.floor(x / 2), Math.floor(y / 2), seed + 7) > 0.88) v = C.TEAL_DARK // 列 3：斑驳旧瓦
  return v
}

/** 门：列 0 单扇门（门环 + 门闩）、列 1 双扇门（中缝 + 两环 + 门额符纸） */
function paintDoor(g, variant) {
  frame(g, 6, 3, 25, 29, C.INK) // 门洞描边
  rect(g, 7, 4, 24, 28, C.BRONZE_DARK) // 门扇
  hline(g, 7, 24, 4, C.BRONZE) // 门楣受光
  vline(g, 7, 4, 28, C.BRONZE) // 左侧受光棱
  if (variant === 0) {
    for (let x = 7; x <= 24; x++) if ((x - 7) % 4 === 0) vline(g, x, 5, 28, C.INK) // 竖板缝
    frame(g, 17, 14, 20, 17, C.BRONZE) // 门环
    rect(g, 18, 15, 19, 16, C.BRONZE_LIGHT)
    rect(g, 9, 21, 12, 22, C.BRONZE) // 门闩
  } else {
    vline(g, 15, 4, 28, C.INK) // 双扇门中缝
    vline(g, 16, 4, 28, C.INK)
    for (let x = 9; x <= 22; x++) if ((x - 9) % 5 === 0) vline(g, x, 5, 28, C.INK)
    frame(g, 9, 14, 12, 17, C.BRONZE)
    frame(g, 19, 14, 22, 17, C.BRONZE)
    rect(g, 10, 15, 11, 16, C.BRONZE_LIGHT)
    rect(g, 20, 15, 21, 16, C.BRONZE_LIGHT)
    frame(g, 12, 0, 19, 2, C.INK) // 门额
    rect(g, 13, 0, 18, 2, C.TALISMAN) // 门额符纸（镇门的黄符）
  }
  hline(g, 5, 26, 30, C.STONE) // 门槛石
  hline(g, 5, 26, 31, C.TEAL_DARK)
}

/** 窗：列 2 直棂窗（竖棂）、列 3 花格窗（斜格）；内里暗青 + 稀疏烛火，与门一眼可分 */
function paintWindow(g, variant) {
  frame(g, 6, 7, 25, 24, C.INK) // 窗框
  rect(g, 7, 8, 24, 23, C.TEAL_DARK) // 窗内暗部
  for (let y = 8; y <= 23; y++) {
    for (let x = 7; x <= 24; x++) if (hash2(x, y, 77) > 0.9) put(g, x, y, C.TALISMAN) // 窗内烛火
  }
  if (variant === 2) {
    for (let x = 8; x <= 23; x++) if ((x - 8) % 4 === 1) vline(g, x, 8, 23, C.BRONZE) // 直棂
    hline(g, 7, 24, 9, C.BRONZE_DARK)
    hline(g, 7, 24, 22, C.BRONZE_DARK)
  } else {
    for (let y = 8; y <= 23; y++) {
      for (let x = 7; x <= 24; x++) {
        if ((x + y) % 5 === 0 || (((x - y) % 5) + 5) % 5 === 0) put(g, x, y, C.BRONZE) // 斜格花窗
      }
    }
  }
  hline(g, 5, 26, 25, C.STONE) // 窗台
  hline(g, 5, 26, 26, C.TEAL_DARK)
}

// ══════════════════════════════════════════════════════════════════
// 三、town-deco：木桶木箱 / 灯笼灯柱 / 招牌幌子 / 石阶石墩
//     空白处一律用**深墨青索引 1**表示暗部（瓦片禁用索引 0），
//     物件靠自身描边与暗底分离，接缝列两侧都是同一片暗底，指标自然平缓。
// ══════════════════════════════════════════════════════════════════

function drawBarrel(g, x0, x1, y0, y1) {
  frame(g, x0, y0, x1, y1, C.INK) // 描边
  rect(g, x0 + 1, y0 + 1, x1 - 1, y1 - 1, C.BRONZE_DARK) // 桶身
  for (let x = x0 + 1; x <= x1 - 1; x++) if ((x - x0) % 4 === 0) vline(g, x, y0 + 2, y1 - 1, C.INK) // 竖板缝
  hline(g, x0 + 1, x1 - 1, y0 + 1, C.BRONZE) // 桶口
  hline(g, x0 + 2, x1 - 2, y0 + 2, C.BRONZE_LIGHT)
  hline(g, x0 + 1, x1 - 1, y0 + 5, C.BRONZE) // 上铁箍
  hline(g, x0 + 1, x1 - 1, y1 - 5, C.BRONZE) // 下铁箍
  hline(g, x0 + 1, x1 - 1, y1 - 1, C.BRONZE_DARK) // 桶底暗部
  hline(g, x0, x1, y1 + 1, C.INK) // 落地投影
}

function drawCrate(g, x0, x1, y0, y1) {
  frame(g, x0, y0, x1, y1, C.INK)
  rect(g, x0 + 1, y0 + 1, x1 - 1, y1 - 1, C.BRONZE_DARK)
  frame(g, x0 + 1, y0 + 1, x1 - 1, y1 - 1, C.BRONZE) // 木框
  hline(g, x0 + 2, x1 - 2, Math.floor((y0 + y1) / 2), C.INK) // 横板缝
  const w = x1 - x0 - 2
  const h = y1 - y0 - 2
  const n = Math.max(w, h)
  for (let i = 0; i <= n; i++) put(g, x0 + 1 + Math.round((i * w) / n), y0 + 1 + Math.round((i * h) / n), C.BRONZE) // 斜撑
  hline(g, x0 + 2, x1 - 2, y0 + 1, C.BRONZE_LIGHT) // 顶面受光
  hline(g, x0, x1, y1 + 1, C.INK) // 落地投影
}

function drawLantern(g, x0, x1, y0, y1, lit) {
  frame(g, x0, y0, x1, y1, C.INK) // 灯笼骨
  rect(g, x0 + 1, y0 + 1, x1 - 1, y1 - 1, lit ? C.TALISMAN : C.TEAL_DARK) // 纸面
  if (lit) {
    const cx = (x0 + x1) >> 1
    const cy = (y0 + y1) >> 1
    rect(g, cx - 1, cy - 1, cx + 1, cy + 1, C.EMBER) // 内焰
    put(g, cx, cy, C.FROST) // 灯芯
    hline(g, x0 + 1, x1 - 1, y0 + 1, C.MOON) // 纸面受光
  }
  hline(g, x0, x1, y0 - 1, C.BRONZE_DARK) // 上灯托
  hline(g, x0, x1, y1 + 1, C.BRONZE_DARK) // 下灯托
  put(g, (x0 + x1) >> 1, y0 - 2, C.BRONZE) // 挂环
}

function drawPost(g, cx, y0, y1) {
  rect(g, cx - 2, y0, cx + 1, y1, C.INK) // 描边
  rect(g, cx - 1, y0, cx, y1, C.BRONZE_DARK) // 柱身
  vline(g, cx - 1, y0, y1, C.BRONZE) // 受光侧
  hline(g, cx - 3, cx + 2, y1, C.BRONZE_DARK) // 柱础（可见，不被暗底吃掉）
  hline(g, cx - 3, cx + 2, y1 + 1, C.INK)
}

function drawBoard(g, x0, x1, y0, y1, face) {
  frame(g, x0, y0, x1, y1, C.INK)
  rect(g, x0 + 1, y0 + 1, x1 - 1, y1 - 1, face)
  frame(g, x0 + 1, y0 + 1, x1 - 1, y1 - 1, C.BRONZE) // 铜包边
  for (let i = 0; i < 3; i++) put(g, x0 + 3 + i * 3, y0 + 3, C.MOON) // 抽象刻痕（非文字）
  for (let i = 0; i < 3; i++) put(g, x0 + 3 + i * 3, y1 - 3, C.MOON)
}

function drawStep(g, x0, x1, y0, y1) {
  frame(g, x0, y0, x1, y1, C.INK)
  rect(g, x0 + 1, y0 + 1, x1 - 1, y1 - 1, C.TEAL_MID)
  hline(g, x0 + 1, x1 - 1, y0 + 1, C.STONE) // 踏面受光
  hline(g, x0 + 1, x1 - 1, y1 - 1, C.TEAL_DARK) // 踢面暗部
}

function drawBlock(g, x0, x1, y0, y1, mossy) {
  frame(g, x0, y0, x1, y1, C.INK)
  rect(g, x0 + 1, y0 + 1, x1 - 1, y1 - 1, C.TEAL_MID)
  hline(g, x0 + 1, x1 - 1, y0 + 1, C.STONE) // 顶面受光
  hline(g, x0 + 1, x1 - 1, y0 + 2, C.STONE)
  vline(g, x1 - 1, y0 + 1, y1 - 1, C.TEAL_DARK) // 背光侧
  if (mossy) {
    for (let y = y0 + 3; y <= y1 - 2; y++) {
      for (let x = x0 + 2; x <= x1 - 3; x++) if (hash2(x, y, 913) > 0.86) put(g, x, y, C.MOSS) // 苔痕
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// 四、wilderness-ground：泥土小径 / 荒草 / 碎石地 / 枯枝落叶
// ══════════════════════════════════════════════════════════════════

/** 泥土小径：亮土粒 + 车辙（x 周期 16，辙口落在 x%16 ∈ {12,13}，不压边界列） */
function dirtPath(x, y, seed) {
  const v = hash2(x, y, seed)
  if (v > 0.972) return C.INK // 碎石
  if (v > 0.94) return C.BRONZE // 亮土粒
  if ((x + 4) % 16 < 2) return dither(C.INK, C.BRONZE_DARK, x, y, 6) // 车辙
  return dither(C.BRONZE_DARK, C.BRONZE, x, y, 4)
}

/** 荒草：4×4 簇（周期 4）+ 暮橙枯尖 —— 与 town 的湿润草地明显区分 */
function wildGrass(x, y, seed) {
  const v = hash2(x, y, seed)
  const clump = hash2(Math.floor(x / 4), Math.floor(y / 4), seed + 5)
  if (clump > 0.86) {
    if (v > 0.78) return C.EMBER // 枯黄草尖
    return v > 0.45 ? C.MOSS : C.TEAL_DARK
  }
  if (clump < 0.14) return dither(C.TEAL_DARK, C.MOSS, x, y, 8) // 暗草窝
  if (v > 0.988 && y % 4 === 0) return C.EMBER // 零星枯尖
  if (v < 0.12) return C.TEAL_DARK
  return dither(C.MOSS, C.TEAL_DARK, x, y, 5)
}

/** 碎石地：4×4 石缝网格整体偏移 2px，使石缝不落在 x=0/31 */
function gravelGround(x, y, seed) {
  const n = hash2(Math.floor(x / 4), Math.floor(y / 4), seed)
  const local = hash2(x, y, seed + 3)
  if ((x + 2) % 4 === 0 || (y + 2) % 4 === 0) return n > 0.5 ? C.INK : C.TEAL_DARK // 石缝
  if (n > 0.78) return local > 0.45 ? C.STONE : C.TEAL_MID // 大石
  if (n < 0.22) return C.INK // 暗坑
  return dither(C.TEAL_MID, C.STONE, x, y, 6)
}

/** 枯枝落叶：8×8 落叶堆 + 横向枯枝（y 周期 8，按变体错位） */
function leafLitter(x, y, seed) {
  const v = hash2(x, y, seed)
  const patch = hash2(Math.floor(x / 8), Math.floor(y / 8), seed + 23)
  const twig = (seed % 3) + 2
  if (y % 8 === twig && v > 0.2) return C.INK // 枯枝（压在落叶上）
  if (y % 8 === (twig + 1) % 8 && v > 0.6) return C.BRONZE_DARK // 枝下阴影
  if (patch > 0.72) {
    if (v > 0.82) return C.EMBER // 橙叶
    if (v > 0.5) return C.MOSS // 湿叶
    return C.BRONZE_DARK
  }
  if (v > 0.96) return C.MOSS
  return dither(C.BRONZE_DARK, C.BRONZE, x, y, 3)
}

// ══════════════════════════════════════════════════════════════════
// 五、dungeon-ground：石砖地 / 裂缝地砖 / 灵光青阵纹砖 / 积水砖
// ══════════════════════════════════════════════════════════════════

/** 地宫石砖基底：错缝砖，竖缝落在 x%16 ∈ {4,12}（避开接缝列） */
function dungeonBrick(x, y, seed, opts = {}) {
  const bh = 8
  const row = Math.floor(y / bh)
  const shift = row % 2 ? 4 : 12
  if ((x + shift) % 16 === 0 || y % bh === 0) return C.INK // 灰缝
  const inRow = y % bh
  const v = hash2(Math.floor((x + shift) / 16), row, seed)
  if (opts.wet) return inRow === 1 ? C.TEAL_DARK : dither(C.TEAL_DARK, C.TEAL_MID, x, y, 4) // 湿砖无高光
  if (inRow === 1) return C.STONE // 砖上沿受光
  if (inRow === bh - 1) return C.TEAL_DARK // 下沿暗部
  if (v > 0.72) return C.STONE
  if (v < 0.25) return C.TEAL_DARK
  return dither(C.TEAL_MID, C.STONE, x, y, 6)
}

function dungeonFloor(x, y, seed) {
  return dungeonBrick(x, y, seed)
}

/**
 * 裂缝的横向偏移表（周期 16，整除 32 → 竖向无缝）。
 * 用「一行一个偏移量」的波形表，而不是线性取模：线性取模得到的是**一族平行细线**（看起来像网纹），
 * 而这里给出的是单条蜿蜒裂缝，更像真的地裂。
 */
const CRACK_WAVE = [0, 1, 2, 4, 5, 4, 3, 1, 0, -1, -3, -4, -5, -4, -2, -1]

/** 裂缝地砖：列 0 单缝、列 1 宽缝、列 2 斜缝（x = 6 + y，周期 32）、列 3 细缝带分叉 */
function crackedFloor(x, y, seed, variant) {
  const base = dungeonBrick(x, y, seed)
  const cx = variant === 2 ? (6 + y) % 32 : 16 + CRACK_WAVE[(y + variant * 5) % 16]
  const dx = Math.abs(x - cx)
  const half = variant === 1 ? 2 : variant === 3 ? 0 : 1 // 缝芯半宽
  if (dx <= half) return C.INK // 缝芯
  if (dx === half + 1) return base === C.STONE ? C.TEAL_MID : C.TEAL_DARK // 缝缘压暗
  if (variant === 3 && dx === 3 && y % 8 < 4) return C.TEAL_DARK // 分叉
  return base
}

/** 灵光青阵纹砖：菱环 + 内环 + 角点，全部收在 x ∈ [4,28]，边界列不参与发光 */
function runeFloor(x, y, seed) {
  const base = dungeonBrick(x, y, seed, { wet: true })
  const dx = Math.abs(x - 16)
  const dy = Math.abs(y - 16)
  const ring = dx + dy
  if (ring >= 11 && ring <= 12) return C.SPIRIT // 外菱环
  if (ring >= 13 && ring <= 15) return dither(C.TEAL_MID, base, x, y, 8) // 光晕
  if (ring >= 5 && ring <= 6) return C.SPIRIT // 内环
  if ((dx === 0 && dy <= 2) || (dy === 0 && dx <= 2)) return C.SPIRIT // 十字引线
  if ((x === 4 || x === 27) && (y === 4 || y === 27)) return C.SPIRIT // 四角符点
  return base
}

/**
 * 积水砖：水洼 = 单元格中央的圆盘（半径按变体变），圆心收在 x ∈ [14,18] 内，
 * 因此水洼永远不接触 x = 0/31 边界列（接缝指标安全）。上沿 1px 月白高光 = 水面反光。
 */
const PUDDLES = [
  { cx: 16, cy: 17, r2: 90 }, // 0 常规水洼
  { cx: 16, cy: 16, r2: 125 }, // 1 深水（更大更深）
  { cx: 17, cy: 18, r2: 55 }, // 2 浅水
  { cx: 15, cy: 19, r2: 80 }, // 3 湿痕范围大
]

function puddleFloor(x, y, seed, variant) {
  const { cx, cy, r2 } = PUDDLES[variant]
  const d2 = (xx, yy) => (xx - cx) * (xx - cx) + (yy - cy) * (yy - cy)
  const base = dungeonBrick(x, y, seed, { wet: true })
  if (d2(x, y) < r2) {
    if (d2(x, y - 1) >= r2) return C.MOON // 水面上沿反光（1px 弧）
    if (d2(x, y) < r2 * 0.45) return C.NIGHT_BLUE // 深水
    return dither(C.NIGHT_BLUE, C.TEAL_DARK, x, y, 6) // 浅水过渡
  }
  if (d2(x, y) < r2 * 1.7) return C.TEAL_DARK // 水洼外圈湿痕
  return base
}

// ══════════════════════════════════════════════════════════════════
// 六、dungeon-wall：墙顶 / 墙面 / 墙角 / 墙面带灵光青裂缝
//     上墙沿 = 行 0「墙顶」（顶端受光 + 下沿投影）；下墙沿 = 行 1 列 2「墙面下沿」；
//     两者叠在行 1 列 1「通用墙面」上即可拼出上下墙沿（doc/14 §6.2 的 building 层）。
// ══════════════════════════════════════════════════════════════════

function wallBrick(x, y, seed) {
  const bh = 8
  const row = Math.floor(y / bh)
  const shift = row % 2 ? 4 : 12
  if ((x + shift) % 16 === 0 || y % bh === 0) return C.INK // 灰缝
  const inRow = y % bh
  const v = hash2(Math.floor((x + shift) / 16), row, seed + 17)
  if (inRow === 1) return C.TEAL_MID // 砖上沿受光
  if (inRow === bh - 1) return C.INK // 砖下沿投影
  if (v > 0.78) return C.TEAL_MID
  if (v < 0.3) return C.INK
  return dither(C.TEAL_DARK, C.TEAL_MID, x, y, 5)
}

/** 墙顶（上墙沿）：顶端受光棱 + 顶面石板 + 底下 4px 投影，压住下面那块墙面 */
function wallTop(x, y, seed, variant) {
  if (y === 0) return C.MOON // 受光棱（整行同色，不影响接缝指标）
  if (y === 1) return C.STONE
  if (y === 2) return C.TEAL_MID
  if (y >= 28) return C.INK // 下沿投影
  const row = Math.floor(y / 8)
  const shift = row % 2 ? 4 : 12
  if ((x + shift) % 16 === 0) return C.INK // 顶面石板缝
  if (y % 8 === 4) return C.STONE // 板面受光
  const v = hash2(Math.floor((x + shift) / 16), row, seed + 3)
  if (variant === 3 && v > 0.9) return C.TEAL_DARK // 湿滑变体
  return v > 0.62 ? dither(C.TEAL_MID, C.STONE, x, y, 6) : dither(C.TEAL_DARK, C.TEAL_MID, x, y, 7)
}

/** 墙面：列 0 = 上沿（顶部受光）、列 1 = 通用、列 2 = 下沿（底部投影）、列 3 = 通用带苔痕 */
function wallFace(x, y, seed, variant) {
  if (variant === 0 && y <= 1) return y === 0 ? C.STONE : C.TEAL_MID // 上沿受光
  if (variant === 2 && y >= 29) return C.INK // 下沿投影（下墙沿）
  const base = wallBrick(x, y, seed)
  if (variant === 3 && hash2(Math.floor(x / 4), Math.floor(y / 4), seed + 53) > 0.84) return C.MOSS // 苔痕
  return base
}

/** 墙角：竖向外角描边 + 受光棱，按变体放在左 / 右 / 双角 / 左角带上沿 */
function wallCorner(x, y, seed, variant) {
  const base = wallBrick(x, y, seed)
  const left = variant === 0 || variant === 2 || variant === 3
  const right = variant === 1 || variant === 2
  if (variant === 3 && y <= 1) return y === 0 ? C.STONE : C.TEAL_MID // 与墙顶衔接
  if (left && x === 0) return C.INK
  if (left && x === 1) return C.STONE
  if (right && x === 31) return C.INK
  if (right && x === 30) return C.STONE
  return base
}

/** 墙面带灵光青裂缝：单条蜿蜒裂缝 + 光晕；裂缝整条收在 x ∈ [6,26]，不污染边界列 */
function wallCracked(x, y, seed, variant) {
  const cx = 16 + CRACK_WAVE[(y + variant * 3) % 16] + (variant >= 2 ? 4 : 0) - (variant === 1 ? 3 : 0)
  const dx = Math.abs(x - cx)
  if (dx === 0) return C.SPIRIT // 缝芯发光
  if (dx === 1) return dither(C.SPIRIT, C.TEAL_MID, x, y, 6) // 光晕
  if (variant === 3 && dx === 2) return C.TEAL_DARK // 宽的裂缝边缘
  return wallBrick(x, y, seed)
}

// ══════════════════════════════════════════════════════════════════
// 七、瓦片集描述表 —— 新增一张表只需在这里加一条
// ══════════════════════════════════════════════════════════════════

/**
 * 把「底 + 绘制」的物件型图案包装成逐像素图案函数。
 * 物件造型用命令式绘制好写得多；这里按 (seed,variant) 缓存一次 32×32 结果，
 * buildSheet 仍然只看到纯函数，幂等性不受影响。
 */
function painted(paint, background) {
  const cache = new Map()
  return (x, y, seed, variant) => {
    const key = `${seed}:${variant}`
    let sheet = cache.get(key)
    if (!sheet) {
      sheet = { width: TILE, height: TILE, indices: new Uint8Array(TILE * TILE) }
      for (let yy = 0; yy < TILE; yy++) {
        for (let xx = 0; xx < TILE; xx++) sheet.indices[yy * TILE + xx] = background(xx, yy, seed, variant)
      }
      paint(sheet, variant, seed)
      cache.set(key, sheet)
    }
    return sheet.indices[y * TILE + x]
  }
}

/** 门窗行：底为通用夯土墙面，门窗瓦片因此能直接顶替一块墙 */
const doorWindow = painted(
  (g, variant) => (variant < 2 ? paintDoor(g, variant) : paintWindow(g, variant)),
  (x, y, seed, variant) => rammedEarth(x, y, seed + 101, 1 + (variant % 2)),
)

const DECO_VOID = C.INK // deco 的「空白」= 深墨青暗部（瓦片禁用索引 0）

const decoBarrelCrate = painted((g, variant) => {
  if (variant === 0) drawBarrel(g, 9, 22, 6, 24)
  else if (variant === 1) drawCrate(g, 9, 22, 8, 24)
  else if (variant === 2) {
    drawBarrel(g, 4, 15, 10, 24) // 小桶
    drawCrate(g, 17, 28, 6, 20) // 木箱
  } else {
    drawCrate(g, 8, 23, 14, 24) // 双箱叠放
    drawCrate(g, 11, 20, 4, 13)
  }
}, () => DECO_VOID)

const decoLantern = painted((g, variant) => {
  if (variant === 0) {
    drawPost(g, 16, 16, 30)
    drawLantern(g, 11, 21, 5, 15, true)
  } else if (variant === 1) {
    drawPost(g, 16, 18, 30)
    drawLantern(g, 5, 13, 6, 14, true)
    drawLantern(g, 19, 27, 6, 14, true)
  } else if (variant === 2) {
    drawStep(g, 12, 19, 22, 26) // 石灯座
    drawPost(g, 16, 14, 25)
    drawLantern(g, 11, 21, 4, 13, true)
  } else {
    drawPost(g, 16, 16, 30)
    drawLantern(g, 11, 21, 5, 15, false) // 熄灯
  }
}, () => DECO_VOID)

const decoSign = painted((g, variant) => {
  if (variant === 0) {
    drawBoard(g, 5, 26, 8, 20, C.BRONZE_DARK) // 木招牌
  } else if (variant === 1) {
    hline(g, 4, 27, 7, C.BRONZE) // 横杆
    hline(g, 4, 27, 8, C.BRONZE_DARK)
    rect(g, 12, 9, 19, 24, C.MOSS) // 布幌
    frame(g, 12, 9, 19, 24, C.TEAL_DARK) // 布边（深墨青底上要看得见，不能用 INK）
    put(g, 13, 25, C.TEAL_DARK) // 下摆流苏
    put(g, 18, 25, C.TEAL_DARK)
  } else if (variant === 2) {
    frame(g, 15, 20, 16, 31, C.INK) // 立柱
    rect(g, 15, 20, 16, 31, C.BRONZE_DARK)
    drawBoard(g, 6, 25, 9, 21, C.BRONZE_DARK) // 立牌
  } else {
    frame(g, 7, 4, 8, 30, C.INK) // 旗杆
    rect(g, 7, 4, 8, 30, C.BRONZE_DARK)
    rect(g, 9, 6, 22, 16, C.TALISMAN) // 酒旗
    frame(g, 9, 6, 22, 16, C.INK)
    hline(g, 10, 21, 7, C.EMBER)
    hline(g, 10, 21, 15, C.EMBER)
  }
}, () => DECO_VOID)

const decoStone = painted((g, variant) => {
  if (variant === 0) {
    drawStep(g, 4, 28, 16, 23) // 石阶
    drawStep(g, 7, 25, 24, 31)
  } else if (variant === 1) {
    drawBlock(g, 9, 22, 12, 29, false) // 石墩
  } else if (variant === 2) {
    drawStep(g, 3, 17, 14, 22) // 转角石阶
    drawStep(g, 3, 21, 23, 31)
    drawBlock(g, 22, 28, 18, 30, false)
  } else {
    drawBlock(g, 8, 23, 13, 30, true) // 带苔痕石墩
  }
}, () => DECO_VOID)

/** 一张瓦片集 = 一条记录；cols × rows 固定 4×4（清单里的 spec） */
const TILESETS = [
  {
    id: 'tileset-town-ground',
    dir: 'town',
    seedBase: 1000,
    rows: [
      { name: 'flagstone', roles: ['石板路', '石板路·错缝', '石板路·暗斑', '石板路·亮斑'], fn: flagstone },
      { name: 'dirt', roles: ['泥土', '泥土·碎石多', '泥土·亮土粒多', '泥土·暗粒多'], fn: dirt },
      { name: 'grass', roles: ['草地', '草地·草尖多', '草地·暗处', '草地·亮处'], fn: grass },
      { name: 'mossy-stone', roles: ['苔痕石板', '苔痕石板·重', '苔痕石板·轻', '苔痕石板·斑驳'], fn: mossyStone },
    ],
  },
  {
    id: 'tileset-town-building',
    dir: 'town',
    seedBase: 3000,
    rows: [
      { name: 'rammed-earth-wall', roles: ['墙顶（压顶）', '通用夯土墙', '夯层错位', '含碎石'], fn: rammedEarth },
      { name: 'timber-wall', roles: ['墙顶（横梁）', '通用木构墙', '横向铜箍', '旧墙苔痕'], fn: timberWall },
      { name: 'roof-tiles', roles: ['屋脊/檐口', '通用瓦顶', '旧瓦', '斑驳旧瓦'], fn: roofTiles },
      { name: 'door-window', roles: ['单扇门', '双扇门·门额符纸', '直棂窗', '花格窗'], fn: doorWindow },
    ],
  },
  {
    id: 'tileset-town-deco',
    dir: 'town',
    seedBase: 4000,
    rows: [
      { name: 'barrel-crate', roles: ['木桶', '木箱', '桶+箱', '双箱叠放'], fn: decoBarrelCrate },
      { name: 'lantern-post', roles: ['灯柱+灯笼', '双灯笼', '石灯座', '熄灭灯笼'], fn: decoLantern },
      { name: 'sign-banner', roles: ['木招牌', '布幌子', '立牌', '酒旗'], fn: decoSign },
      { name: 'stone-step', roles: ['石阶', '石墩', '转角石阶', '苔痕石墩'], fn: decoStone },
    ],
  },
  {
    id: 'tileset-wilderness-ground',
    dir: 'wilderness',
    seedBase: 5000,
    rows: [
      { name: 'dirt-path', roles: ['泥土小径', '小径·辙深', '小径·石多', '小径·土松'], fn: dirtPath },
      { name: 'wild-grass', roles: ['荒草', '荒草·枯尖多', '荒草·暗窝', '荒草·亮处'], fn: wildGrass },
      { name: 'gravel', roles: ['碎石地', '碎石地·大石', '碎石地·暗坑', '碎石地·灰多'], fn: gravelGround },
      { name: 'leaf-litter', roles: ['枯枝落叶', '落叶·枝多', '落叶·橙叶多', '落叶·湿叶多'], fn: leafLitter },
    ],
  },
  {
    id: 'tileset-dungeon-ground',
    dir: 'dungeon',
    seedBase: 6000,
    rows: [
      { name: 'dungeon-brick', roles: ['石砖地', '石砖地·亮砖', '石砖地·暗砖', '石砖地·磨损'], fn: dungeonFloor },
      { name: 'cracked-floor', roles: ['裂缝地砖', '裂缝砖·宽', '裂缝砖·斜', '裂缝砖·细带分叉'], fn: crackedFloor },
      { name: 'rune-floor', roles: ['灵光青阵纹砖', '阵纹砖·亮', '阵纹砖·暗', '阵纹砖·旧'], fn: runeFloor },
      { name: 'puddle-floor', roles: ['积水砖', '积水砖·深', '积水砖·浅', '积水砖·湿痕大'], fn: puddleFloor },
    ],
  },
  {
    id: 'tileset-dungeon-wall',
    dir: 'dungeon',
    seedBase: 7000,
    rows: [
      { name: 'wall-top', roles: ['墙顶（上墙沿）', '墙顶·干', '墙顶·裂', '墙顶·湿滑'], fn: wallTop },
      { name: 'wall-face', roles: ['墙面上沿', '通用墙面', '墙面下沿（下墙沿）', '墙面苔痕'], fn: wallFace },
      { name: 'wall-corner', roles: ['左墙角', '右墙角', '双墙角', '左上角'], fn: wallCorner },
      { name: 'wall-spirit-crack', roles: ['灵光青裂缝·短', '裂缝·斜', '裂缝·长', '裂缝·重'], fn: wallCracked },
    ],
  },
]

// ══════════════════════════════════════════════════════════════════
// 八、生成 + 3×3 预览 + 自检
// ══════════════════════════════════════════════════════════════════

function main() {
  const pal = loadPalette()
  if (pal.entries.length !== 16) throw new Error(`色板必须是 16 色，实际 ${pal.entries.length}`)
  let total = 0

  for (const set of TILESETS) {
    const sheet = buildSheet({ cols: COLS, rows: ROWS, tile: TILE, rowsDef: set.rows, seedBase: set.seedBase })
    const out = path.join(ROOT, 'src', 'assets', 'tilesets', set.dir, `${set.id}.png`)
    const bytes = writePng(out, sheet, pal)
    total += bytes

    // 自检 1：接缝指标（与 check-assets 同一算法，先在这里拦住 > 2 的图案）
    const ratio = seamRatio(sheet.indices, sheet.width, sheet.height, TILE)
    if (ratio > 2) throw new Error(`${set.id}: 接缝突变比 ${ratio.toFixed(2)} > 2，图案在边界列有断层`)
    // 自检 2：索引合法性（buildSheet 已挡索引 0，这里再确认没有越界）
    for (const v of sheet.indices) if (v < 1 || v > 15) throw new Error(`${set.id}: 非法索引 ${v}`)

    // 3×3 平铺预览（只进 runtime/，不入库）
    const preview = tile3x3(sheet.indices, sheet.width, sheet.height)
    const previewPath = path.join(PREVIEW_DIR, `preview-${set.id}-x3.png`)
    writePng(previewPath, preview, pal)
    console.log(
      `[gen-tiles] ${path.relative(ROOT, out).replace(/\\/g, '/')}  ${sheet.width}x${sheet.height}  ${COLS}x${ROWS} 变体  ` +
        `${(bytes / 1024).toFixed(1)} KB  seam=${ratio.toFixed(2)}  预览=${path.relative(ROOT, previewPath).replace(/\\/g, '/')}`,
    )
    for (const row of set.rows) console.log(`             · ${row.name.padEnd(20)} ${row.roles.join(' / ')}`)
  }
  console.log(`[gen-tiles] 共 ${TILESETS.length} 张表，合计 ${(total / 1024).toFixed(1)} KB（seed 固定，重跑字节一致）`)
}

main()
