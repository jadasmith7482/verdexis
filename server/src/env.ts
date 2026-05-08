import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  ALERT_POLL_ENABLED: z.coerce.boolean().default(true),
  ALERT_POLL_INTERVAL_MS: z.coerce.number().int().min(15_000).default(60_000),
  // Comma-separated list of emails that auto-promote to admin on next login.
  ADMIN_EMAILS: z.string().default(''),
  // Optional Alpha Vantage API key for historical stock prices used by the
  // admin "deposit + invest as <stock>" flow. Crypto prices come from the
  // free CoinGecko endpoints and don't need a key.
  ALPHA_VANTAGE_KEY: z.string().optional(),
  // Optional CoinGecko API key. Free "Demo" keys use header
  // `x-cg-demo-api-key` against api.coingecko.com; Pro keys use
  // `x-cg-pro-api-key` against pro-api.coingecko.com. Strongly recommended
  // when deploying to a cloud host (Render/Railway/Fly) since CoinGecko
  // aggressively rate-limits/blocks shared cloud egress IPs.
  COINGECKO_API_KEY: z.string().optional(),
  COINGECKO_API_TIER: z.enum(['demo', 'pro']).default('demo'),
  // Optional Finnhub key (60 req/min free) for stock/forex/crypto news.
  FINNHUB_API_KEY: z.string().optional(),
  // Optional Twelve Data key (800 req/day free) — used as a higher-volume
  // fallback to Alpha Vantage for stock quotes / time series.
  TWELVE_DATA_API_KEY: z.string().optional(),
  // Optional NewsAPI.org key — server-side aggregator used by the News page.
  NEWS_API_KEY: z.string().optional(),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('\n[verdexis-api] Invalid environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  console.error('\nSee server/.env.example for the required variables.\n')
  process.exit(1)
}

export const env = parsed.data
