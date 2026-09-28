// Settings layer (doc/12 §1.1): localStorage, sync reads, no transactions.
const KEY = 'ec:settings:v1'
const DEFAULTS = { bgmVolume: 0.7, sfxVolume: 0.8, uiVolume: 0.8, pixelPerfect: true, language: 'zh-CN', textSpeed: 1.0 }

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function updateSettings(patch) {
  const next = { ...getSettings(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}
