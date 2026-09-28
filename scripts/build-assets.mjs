#!/usr/bin/env node
/**
 * 素材生产线总入口：一条命令重建全部素材并校验。
 *
 * 用法：
 *   node scripts/build-assets.mjs            # 重建 + 校验
 *   node scripts/build-assets.mjs --check    # 只校验（CI 用，不写盘）
 *
 * 顺序有意义：先生成色板（constants.js），再产素材，最后校验。
 * 尚未落地的生成器会被跳过并提示，不会让整条流水线失败。
 * 仓库尚无 package.json，因此这里不依赖 pnpm script，直接 node 即可。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')

/**
 * 正常模式：按依赖顺序运行全部生成器，最后校验。
 * --check 模式（CI）：**不重新生成**，只做「源码 → 产物是否漂移」的校验 + 素材校验。
 *   —— CI 不应该改工作区，所以生成步骤在这里被替换为各脚本的 --check。
 */
const STEPS = [
  { script: 'gen-palette.mjs', label: '色板单一源 → constants.js + doc/14 §2.1 校验', checkArgs: ['--check'], optional: false },
  { script: 'gen-tiles.mjs', label: 'L0 程序化瓦片', optional: true },
  { script: 'gen-ui.mjs', label: 'L0 UI 组件（九宫格 / 条 / 按钮）', optional: true },
  { script: 'gen-icons.mjs', label: 'L0 PWA 图标', optional: true },
  { script: 'render-pixels.mjs', label: 'L1 像素矩阵 → PNG-8 + 图集', checkArgs: ['--check'], optional: false },
  { script: 'gen-audio.mjs', label: 'L2 PSG 音序 → ogg', optional: true },
]

function run(script, args = []) {
  const full = path.join(ROOT, 'scripts', script)
  return execFileSync(process.execPath, [full, ...args], { encoding: 'utf8', cwd: ROOT }).trim()
}

let failed = 0
let skipped = 0

for (const step of STEPS) {
  const full = path.join(ROOT, 'scripts', step.script)
  if (!fs.existsSync(full)) {
    if (step.optional) {
      console.log(`— 跳过 ${step.script}（尚未落地）`)
      skipped++
      continue
    }
    console.error(`✗ 缺少必需脚本 ${step.script}`)
    failed++
    continue
  }

  // --check 模式只跑支持 --check 的步骤（不支持的生成器直接跳过，避免 CI 改工作区）
  if (checkOnly && !step.checkArgs) {
    console.log(`— 跳过 ${step.script}（--check 模式不重新生成）`)
    skipped++
    continue
  }
  const args = checkOnly ? step.checkArgs : []

  console.log(`▶ ${step.label}  (${step.script}${args.length ? ' ' + args.join(' ') : ''})`)
  try {
    const out = run(step.script, args)
    for (const line of out.split('\n')) if (line.trim()) console.log(`  ${line}`)
  } catch (e) {
    console.error(`  ✗ 失败：${(e.stderr || e.stdout || e.message).toString().trim()}`)
    failed++
  }
}

console.log('')
console.log(`▶ 素材校验  (check-assets.mjs)`)
try {
  const out = run('check-assets.mjs', ['--report'])
  for (const line of out.split('\n')) if (line.trim()) console.log(`  ${line}`)
} catch (e) {
  console.error(`  ✗ 校验失败：${(e.stderr || e.stdout || e.message).toString().trim()}`)
  failed++
}

console.log('')
console.log(failed ? `[build-assets] 失败（${failed} 个步骤出错，跳过 ${skipped} 个）` : `[build-assets] 完成（跳过 ${skipped} 个未落地生成器）`)
process.exit(failed ? 1 : 0)
