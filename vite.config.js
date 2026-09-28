import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base switches to the repo sub-path when deploying to GitHub Pages
// (see doc/13 §12); local dev and other hosts keep the root path.
const base = process.env.GITHUB_PAGES === 'true' ? '/EmberCultivation/' : '/'

// Production build gate (doc/13 §5.3): config tables must validate, else the
// build fails hard. Runs the same src/core/validate.js rules as pnpm validate.
async function tableValidationGate() {
  let validateTables
  try {
    ;({ validateTables } = await import('./src/core/validate.js'))
  } catch {
    return // browser-only context; nothing to do
  }
  const { readFile, readdir } = await import('node:fs/promises')
  const path = await import('node:path')
  const dataDir = fileURLToPath(new URL('./src/data', import.meta.url))
  const tables = {}
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith('.json')) {
        const rel = path.relative(dataDir, full).replace(/\\/g, '/')
        const data = JSON.parse(await readFile(full, 'utf8'))
        if (rel.startsWith('maps/')) {
          tables.maps = tables.maps ?? []
          tables.maps.push({ id: rel.replace('maps/', '').replace('.json', '') })
        } else {
          tables[rel.replace('.json', '')] = data
        }
      }
    }
  }
  return {
    name: 'table-validation-gate',
    async buildStart() {
      await walk(dataDir)
      const result = validateTables(tables)
      if (!result.ok) {
        throw new Error(
          `配置表校验失败（doc/11 §7），构建阻断：\n${result.errors.map((e) => `  ✗ ${e}`).join('\n')}`,
        )
      }
      console.log(`[table-gate] 配置表校验通过：${result.stats.tables} 张表 / ${result.stats.entries} 条（${result.warnings.length} 警告）`)
      for (const w of result.warnings) console.warn(`  ! ${w}`)
    },
  }
}

export default defineConfig({
  base,
  plugins: [vue(), tableValidationGate()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
