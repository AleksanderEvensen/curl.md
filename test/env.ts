import type {} from 'vitest'
import { z } from 'zod'

declare module 'vitest' {
  export interface ProvidedContext {
    env: string
  }
}

const schema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string(),
  CLOUDFLARE_BROWSER_API_TOKEN: z.string(),
  COOKIE_SECRET: z.string(),
  CURLMD_BASE_URL: z.string(),
  DB_URL: z.string(),
  GH_API_URL: z.string(),
  GH_CLIENT_ID: z.string(),
  GH_CLIENT_SECRET: z.string(),
  GH_URL: z.string(),
  HOST: z.string(),
  SELFHOST_API_KEY: z.string().default(''),
  SENTRY_DSN: z.string(),
  STRIPE_API_URL: z.string(),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  TOKEN_ENCRYPTION_KEY: z.string(),
})

type Input = z.infer<typeof schema>

export const Env = {
  get(overrides: Partial<Input> = {}) {
    return {
      CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
      CLOUDFLARE_BROWSER_API_TOKEN: 'test-browser-token',
      COOKIE_SECRET: 'test-secret',
      CURLMD_BASE_URL: 'http://localhost',
      DB_URL: 'postgres://localhost:5432/test',
      GH_API_URL: 'https://api.github.com',
      GH_CLIENT_ID: 'test',
      GH_CLIENT_SECRET: 'test',
      GH_URL: 'https://github.com',
      HOST: 'curl.local',
      SELFHOST_API_KEY: '',
      SENTRY_DSN: 'https://key@o123.ingest.us.sentry.io/456',
      STRIPE_API_URL: 'https://api.stripe.com',
      STRIPE_SECRET_KEY: 'sk_test_fake',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_fake',
      TOKEN_ENCRYPTION_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleXRlc3QtZW5jcnlwdGk=',
      ...overrides,
    } satisfies Input
  },
  parse(env: unknown) {
    return schema.parse(typeof env === 'string' ? JSON.parse(env) : env)
  },
  schema,
}
