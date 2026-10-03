import { describe, expect, test } from 'claude-code/testing'

import { cacheState, cacheWritePerMTok, duration, percentTone, tokens, usd } from '../hooks/format'

const MIN = 60_000

describe('format', () => {
  test('cache warmth counts down the TTL', async () => {
    expect(cacheState(null, 0, '1h').label).toBe('○ cache idle')
    expect(cacheState(0, 1 * MIN, '1h')).toEqual({ tone: 'good', label: '● cache warm 59m' })
    expect(cacheState(0, 57 * MIN, '1h').tone).toBe('warn')
    expect(cacheState(0, 61 * MIN, '1h')).toEqual({ tone: 'bad', label: '○ cache cold' })
    expect(cacheState(0, 6 * MIN, '5m').tone).toBe('bad')
  })

  test('re-cache price follows model and TTL', async () => {
    expect(cacheWritePerMTok('claude-sonnet-5-5', '1h', 0)).toBe(4)
    expect(cacheWritePerMTok('claude-opus-5-5', '1h', 0)).toBe(8)
    expect(cacheWritePerMTok('claude-opus-4-1-20250805', '5m', 0)).toBe(18.75)
    expect(cacheWritePerMTok('claude-fable-5-1', '1h', 0)).toBe(20)
    expect(cacheWritePerMTok('claude-sonnet-4-6', '1h', 0)).toBe(6)
    expect(cacheWritePerMTok('claude-haiku-4-5-20251001', '5m', 0)).toBe(1.25)
    expect(cacheWritePerMTok('mystery-model', '1h', 0)).toBe(null)
    expect(cacheWritePerMTok('mystery-model', '1h', 8)).toBe(8)
  })

  test('numbers read short', async () => {
    expect(tokens(109_400)).toBe('109k')
    expect(tokens(1_000_000)).toBe('1.0M')
    expect(usd(1.006)).toBe('$1.01')
    expect(duration(125 * MIN)).toBe('2h05m')
    expect(percentTone(59)).toBe('good')
    expect(percentTone(90)).toBe('bad')
  })
})
