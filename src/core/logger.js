// Leveled logger for every layer.
// Rules (doc/15 §2.1): debug output is dev-only and silenced in production
// builds. `import.meta.env` only exists under Vite, so plain Node runs
// (unit tests, runtime/tools scripts) fall back to full output.
const LEVEL_ORDER = ['debug', 'info', 'warn', 'error']

const env = import.meta.env ?? {}
const minLevelIndex = env.PROD ? LEVEL_ORDER.indexOf('info') : 0

function emit(level, tag, args) {
  if (LEVEL_ORDER.indexOf(level) < minLevelIndex) return
  const method = level === 'debug' ? 'log' : level
  // Console is the sink by design; no transport abstraction until needed.
  console[method](`[${tag}]`, ...args)
}

export const logger = {
  debug: (tag, ...args) => emit('debug', tag, args),
  info: (tag, ...args) => emit('info', tag, args),
  warn: (tag, ...args) => emit('warn', tag, args),
  error: (tag, ...args) => emit('error', tag, args),
}
