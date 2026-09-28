import { TIME_STEPS_PER_SHI } from '@/core/constants.js'

// Time skeleton (doc/12 §7): 12 shichen per day, 30 days per month,
// 12 months per year; movement accumulates steps -> shichen.
// TimeSystem is the ONLY mutator of game time (doc/12 §7.3).

const SHICHEN_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const MOON_PHASES = [
  'new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous',
  'full', 'waning-gibbous', 'last-quarter', 'waning-crescent',
]
const STEP_PX = 32

export function defaultTime() {
  return {
    year: 1,
    month: 1,
    day: 1,
    hour: '午',
    shichenIndex: 6,
    dayIndex: 0,
    season: 'spring',
    moonPhase: 'new',
    weather: 'clear',
    weatherRollDay: 0,
  }
}

function seasonOf(month) {
  if (month <= 3) return 'spring'
  if (month <= 6) return 'summer'
  if (month <= 9) return 'autumn'
  return 'winter'
}

function moonOf(day) {
  const dayInCycle = ((day - 1) % 30 + 30) % 30
  const idx = Math.round((dayInCycle / 30) * 8) % 8
  return MOON_PHASES[idx]
}

export class TimeSystem {
  constructor(time) {
    this.time = { ...time }
    this.pxAcc = 0
    this.paused = false
    this.onShichenChange = null
  }

  static isNight(time) {
    // Night = 戌~寅 (doc/12 §7.2)
    return [10, 11, 0, 1, 2].includes(time.shichenIndex)
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
  }

  /** Accumulate traveled distance; every TIME_STEPS_PER_SHI steps advances one shichen. */
  addDistance(px) {
    if (this.paused) return
    this.pxAcc += px
    const fullShichen = STEP_PX * TIME_STEPS_PER_SHI
    while (this.pxAcc >= fullShichen) {
      this.pxAcc -= fullShichen
      this.advance(1)
    }
  }

  advance(hours) {
    for (let i = 0; i < hours; i += 1) {
      this.time.shichenIndex = (this.time.shichenIndex + 1) % 12
      if (this.time.shichenIndex === 0) this.rollDay()
      this.time.hour = SHICHEN_NAMES[this.time.shichenIndex]
      this.onShichenChange?.(this.snapshot())
    }
  }

  rollDay() {
    this.time.dayIndex += 1
    this.time.day += 1
    this.time.moonPhase = moonOf(this.time.day)
    if (this.time.day > 30) {
      this.time.day = 1
      this.time.month += 1
      this.time.season = seasonOf(this.time.month)
      if (this.time.month > 12) {
        this.time.month = 1
        this.time.year += 1
        this.time.season = 'spring'
      }
    }
    // Weather reroll per day lands in M4 (weatherRollDay bookkeeping only).
    this.time.weatherRollDay = this.time.dayIndex
  }

  snapshot() {
    return { ...this.time }
  }
}
