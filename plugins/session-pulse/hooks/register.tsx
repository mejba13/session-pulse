import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit, SessionUsage } from 'claude-code'

import type { Meter } from '../types'
import { cacheState, cacheWritePerMTok, duration, percentTone, tokens, usd } from './format'
import type { Tone } from './format'

const TICK_MS = 30_000

const EMPTY: Meter = {
  ctxTokens: null,
  ctxWindow: 0,
  ctxPercent: null,
  fiveHour: null,
  fiveHourResetsAt: null,
  week: null,
  weekResetsAt: null,
  costUsd: null,
  startedAt: null,
  lastResponseAt: null,
  model: null,
}

const meter = atom({ plugin: 'session-pulse', key: 'meter' } as const, EMPTY)
const now = atom({ plugin: 'session-pulse', key: 'now' } as const, 0)
const isHidden = atom({ plugin: 'session-pulse', key: 'isHidden' } as const, false)

const COLOR: Record<Tone, string | undefined> = {
  good: 'green',
  warn: 'yellow',
  bad: 'red',
  dim: undefined,
}

const windowOf = (limits: readonly SessionRateLimit[], kind: string): SessionRateLimit | undefined =>
  limits.find(limit => limit.kind === kind)

const fromUsage = (usage: Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>): Partial<Meter> => {
  const five = windowOf(usage.rateLimits, 'five_hour')
  const week = windowOf(usage.rateLimits, 'seven_day')

  return {
    ctxTokens: usage.context.tokens ?? null,
    ctxWindow: usage.context.window,
    ctxPercent: usage.context.percent ?? null,
    fiveHour: five?.percentUsed ?? null,
    fiveHourResetsAt: five?.resetsAt ?? null,
    week: week?.percentUsed ?? null,
    weekResetsAt: week?.resetsAt ?? null,
    costUsd: usage.cost?.usd ?? null,
  }
}

const untilReset = (resetsAt: string | null, at: number): string | null => {
  if (resetsAt === null) {
    return null
  }
  const left = Date.parse(resetsAt) - at

  return Number.isFinite(left) && left > 0 ? duration(left) : null
}

async function tick($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, now, () => at)
}

export const register: Register = (on, options) => {
  const ttl = options.cacheTtl === '5m' ? '5m' : '1h'
  const priceOverride = typeof options.cacheWritePerMTok === 'number' ? options.cacheWritePerMTok : 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pulse',
      description: 'Show or hide the Session Pulse band above the prompt',
    })
    const [usage, model] = await Promise.all([$.session.usage(), $.session.model()])
    await update($, meter, current => ({ ...current, ...fromUsage(usage), startedAt: usage.startedAt, model }))
    await tick($)
    $.clock.every(TICK_MS, () => void tick($))

    return next(e)
  })

  on('command.run', { command: 'pulse' }, async $ => {
    const hidden = await update($, isHidden, value => !value)

    return { text: hidden ? 'Session Pulse hidden.' : 'Session Pulse shown.' }
  })

  on('session.measure', async ($, e, next) => {
    await update($, meter, current => ({ ...current, ...fromUsage(e) }))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.usage) {
      const at = await $.clock.now()
      const model = e.usage.model
      await update($, meter, current => ({ ...current, lastResponseAt: at, model }))
      await update($, now, () => at)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const m = await read($, meter)
    const at = (await read($, now)) || (await $.clock.now())
    const isWide = (e.viewport?.columns ?? 120) >= 110

    const cache = cacheState(m.lastResponseAt, at, ttl)
    const rate = cacheWritePerMTok(m.model, ttl, priceOverride)
    const rewrite = rate !== null && m.ctxTokens !== null ? (m.ctxTokens * rate) / 1_000_000 : null

    const sep = () => <Text dimColor> │ </Text>
    const label = (text: string) => <Text dimColor>{`${text} `}</Text>
    const value = (tone: Tone, text: string) => (
      <Text color={COLOR[tone]} dimColor={tone === 'dim'} bold={tone !== 'dim'}>
        {text}
      </Text>
    )
    const limit = (name: string, percent: number | null, resetsAt: string | null) => {
      if (percent === null) {
        return null
      }
      const reset = isWide ? untilReset(resetsAt, at) : null

      return (
        <Text>
          {label(name)}
          {value(percentTone(percent), `${Math.round(percent)}%`)}
          {reset !== null && <Text dimColor>{` ↻${reset}`}</Text>}
        </Text>
      )
    }
    const hasLimits = m.fiveHour !== null || m.week !== null

    return (
      <Box flexDirection="row" flexWrap="wrap" paddingLeft={1}>
        {value(cache.tone, cache.label)}

        {sep()}
        {label('ctx')}
        {m.ctxTokens === null ? (
          value('dim', '—')
        ) : (
          <Text>
            {value(percentTone(m.ctxPercent ?? 0), tokens(m.ctxTokens))}
            {isWide && m.ctxWindow > 0 && (
              <Text dimColor>{`/${tokens(m.ctxWindow)} ${m.ctxPercent ?? 0}%`}</Text>
            )}
          </Text>
        )}

        {sep()}
        {label('rewrite')}
        {value(rewrite === null ? 'dim' : 'good', rewrite === null ? '—' : `≈ ${usd(rewrite)}`)}

        {hasLimits && sep()}
        {limit('5h', m.fiveHour, m.fiveHourResetsAt)}
        {m.fiveHour !== null && m.week !== null && <Text dimColor> · </Text>}
        {limit('week', m.week, m.weekResetsAt)}

        {sep()}
        {label('session')}
        {value('good', m.costUsd === null ? '—' : usd(m.costUsd))}
        {isWide && m.startedAt !== null && <Text dimColor>{` · ${duration(at - m.startedAt)}`}</Text>}
      </Box>
    )
  })
}
