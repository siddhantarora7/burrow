export interface Sky {
  top: string
  bottom: string
  /** Text color that reads on this sky. */
  ink: string
  night: boolean
}

// hour, top, bottom
const KEYS: Array<[number, string, string]> = [
  [0, '#0d1530', '#24305a'],
  [4.5, '#1a2148', '#3b3f6e'],
  [6, '#4c5a93', '#e7a99a'],
  [8, '#8db9da', '#f2ddbf'],
  [12, '#78b0da', '#d6ecf3'],
  [16.5, '#7ea3d2', '#f1d6b0'],
  [18.5, '#5a5e9e', '#ee9c7e'],
  [20, '#232a5c', '#5b4d7a'],
  [21.5, '#111a3a', '#2b3462'],
  [24, '#0d1530', '#24305a'],
]

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number) => {
  const A = rgb(a), B = rgb(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i]! - v) * t).toString(16).padStart(2, '0')).join('')
}

export function skyAt(hour: number): Sky {
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < KEYS.length - 2 && h >= KEYS[i + 1]![0]) i++
  const [h0, t0, b0] = KEYS[i]!
  const [h1, t1, b1] = KEYS[i + 1]!
  const t = (h - h0) / (h1 - h0)
  const night = h < 5.5 || h >= 19.8
  return { top: mix(t0, t1, t), bottom: mix(b0, b1, t), ink: night ? '#eef0f8' : '#1e2433', night }
}

export function season(month: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'autumn'
  return 'winter'
}
