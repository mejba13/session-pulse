export type Tone = 'good' | 'warn' | 'bad' | 'dim'

const MINUTE = 60_000

// Anthropic first-party list price for input, USD per 1M tokens.
// Cache writes cost 1.25x base (5m TTL) or 2x base (1h TTL). Order matters: first match wins.
const BASE_INPUT_PER_MTOK: ReadonlyArray<readonly [RegExp, number]> = [
  [/fable|mythos/i, 10],
  [/opus-5-5/i, 4],
  [/opus-4-1|opus-4-20|3-opus/i, 15],
  [/opus/i, 5],
  [/sonnet-5/i, 2],
  [/sonnet/i, 3],
  [/haiku-4/i, 1],
  [/haiku-3-5|3-5-haiku/i, 0.8],
  [/haiku/i, 0.25],
]

export const ttlMs = (ttl: string): number => (ttl === '5m' ? 5 : 60) * MINUTE

export const cacheWritePerMTok = (model: string | null, ttl: string, override: number): number | null => {
  if (override > 0) {
    return override
  }
  const hit = BASE_INPUT_PER_MTOK.find(([pattern]) => model !== null && pattern.test(model))
  if (!hit) {
    return null
  }

  return hit[1] * (ttl === '5m' ? 1.25 : 2)
}

export const tokens = (n: number): string => {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  }
  if (n >= 1_000) {
    return `${Math.round(n / 1_000)}k`
  }

  return String(n)
}

export const usd = (n: number): string => `$${n < 10 ? n.toFixed(2) : n.toFixed(1)}`

export const duration = (ms: number): string => {
  const minutes = Math.max(0, Math.floor(ms / MINUTE))
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h${String(minutes % 60).padStart(2, '0')}m`
  }

  return `${Math.floor(hours / 24)}d${hours % 24}h`
}

export const percentTone = (percent: number): Tone => {
  if (percent >= 85) {
    return 'bad'
  }

  return percent >= 60 ? 'warn' : 'good'
}

export type CacheState = { tone: Tone; label: string }

export const cacheState = (lastResponseAt: number | null, now: number, ttl: string): CacheState => {
  if (lastResponseAt === null) {
    return { tone: 'dim', label: '○ cache idle' }
  }
  const left = ttlMs(ttl) - (now - lastResponseAt)
  if (left <= 0) {
    return { tone: 'bad', label: '○ cache cold' }
  }
  const isLow = left < (ttl === '5m' ? MINUTE : 5 * MINUTE)

  return { tone: isLow ? 'warn' : 'good', label: `● cache warm ${duration(Math.max(left, MINUTE))}` }
}
