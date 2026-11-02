import 'dotenv/config'
import { z } from 'zod'

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  STORAGE_MODE: z.enum(['mongodb', 'json']).default('json'),
  MONGODB_URI: z.string().optional(),
  JSON_STORAGE_DIR: z.string().optional(),
  DOCUMENT_STORAGE_DIR: z.string().optional(),
  DOCUMENT_MAX_SIZE_BYTES: z.coerce.number().int().min(1).max(25 * 1024 * 1024).default(5 * 1024 * 1024),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters.'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  OPENAI_API_KEY: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
  AI_MODEL: z.string().trim().min(1).max(100).default('gpt-4.1-mini'),
})

const parsed = environmentSchema.safeParse(process.env)
if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
  throw new Error(`Invalid environment configuration: ${issues}`)
}

export const env = parsed.data

if (env.STORAGE_MODE === 'mongodb' && !env.MONGODB_URI) {
  throw new Error('Invalid environment configuration: MONGODB_URI is required when STORAGE_MODE=mongodb.')
}
