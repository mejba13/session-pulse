export type Meter = {
  ctxTokens: number | null
  ctxWindow: number
  ctxPercent: number | null
  fiveHour: number | null
  fiveHourResetsAt: string | null
  week: number | null
  weekResetsAt: string | null
  costUsd: number | null
  startedAt: number | null
  lastResponseAt: number | null
  model: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'session-pulse': { meter: Meter; now: number; isHidden: boolean }
  }
}
