# Session Pulse

**See your Claude Code session at a glance.** Session Pulse adds one live line above the prompt with the numbers that decide what your next message costs.

```
● cache warm 59m │ ctx 109k/1M 11% │ rewrite ≈ $0.87 │ 5h 10% ↻3h12m · week 59% ↻4d │ session $1.01 · 42m
```

| Segment | What it tells you |
|---|---|
| `● cache warm 59m` | Time left before the prompt cache expires. Turns yellow near the end and red (`○ cache cold`) once it has expired. |
| `ctx 109k/1M 11%` | How much of the context window the conversation fills. |
| `rewrite ≈ $0.87` | Roughly what it costs to write the current context to the cache again once it goes cold. |
| `5h 10% · week 59%` | Your subscription's rate-limit use, with the time until each window resets (`↻`). |
| `session $1.01 · 42m` | What this session has cost so far, and how long it has run. |

Values change colour as they rise: green below 60%, yellow from 60%, red from 85%.

## Install

In Claude Code:

```
/plugin marketplace add mejba13/session-pulse
/plugin install session-pulse@session-pulse
```

Restart Claude Code. The line appears above the prompt.

**Requirements:** a Claude Code build with function-hook plugins. Session Pulse was built and tested on Claude Code 2.1.288. That plugin API is early access and may change between releases. If the line stops showing after an update, please [open an issue](https://github.com/mejba13/session-pulse/issues).

## Use

| Action | How |
|---|---|
| Hide or show the line | `/pulse` |
| Change settings | `/config`, then find **session-pulse** |

### Settings

| Setting | Default | What it does |
|---|---|---|
| Prompt cache TTL | `1h` | Set it to how long your cache lives: `1h` or `5m`. Drives the countdown and the rewrite price. |
| Cache write price (USD per 1M tokens) | `0` | Overrides the built-in price table. Use it for custom or negotiated pricing. `0` uses the table. |

## How the numbers are worked out

- **Context, rate limits and session cost** come straight from Claude Code, the same figures `/context`, `/usage` and `/cost` show.
- **The cache countdown** starts at the last main-thread response and runs for the configured TTL. It is an estimate: the server keeps the real timer.
- **The rewrite estimate** is `context tokens × cache-write price`. The cache-write price is the model's list input price × 2 for a 1h cache, or × 1.25 for a 5m cache:

| Model | Input $/1M | 1h write $/1M | 5m write $/1M |
|---|---|---|---|
| Fable 5 / 5.1 | 10.00 | 20.00 | 12.50 |
| Opus 5.5 | 4.00 | 8.00 | 5.00 |
| Opus 5, 4.5–4.8 | 5.00 | 10.00 | 6.25 |
| Opus 4 / 4.1 | 15.00 | 30.00 | 18.75 |
| Sonnet 5 / 5.5 | 2.00 | 4.00 | 2.50 |
| Sonnet 4.x | 3.00 | 6.00 | 3.75 |
| Haiku 4.5 | 1.00 | 2.00 | 1.25 |

These are Anthropic first-party API prices. On Bedrock or Vertex AI, or with negotiated rates, set your own price in `/config`. On a subscription plan the figure is what the same work would cost at API rates.

## Privacy

Session Pulse makes no network calls and writes no files. It reads only the usage figures Claude Code already keeps for your session.

## Development

```bash
git clone https://github.com/mejba13/session-pulse
claude --plugin-dir session-pulse/plugins/session-pulse   # run it without installing

claude plugin validate session-pulse/plugins/session-pulse
claude plugin test session-pulse/plugins/session-pulse
```

```
plugins/session-pulse/
├── .claude-plugin/plugin.json   manifest and settings
├── hooks/register.tsx           the line and its data feed
├── hooks/format.ts              price table, countdown and formatting
├── types/index.d.ts             state contract
└── tests/pulse.test.tsx         tests
```

## License

[MIT](LICENSE) © 2026 Mejba Ahmed
