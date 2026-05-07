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
