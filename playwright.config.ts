import { join } from 'node:path'
import { defineConfig } from '@playwright/test'

const storage = process.env.JANASEVA_E2E_STORAGE
if (!storage) throw new Error('Run browser tests through npm run test:e2e to create isolated test storage.')
const dataDirectory = join(storage, 'data')

const apiUrl = 'http://127.0.0.1:5508/api'
const appEnv = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: '5508',
  STORAGE_MODE: 'json',
  JSON_STORAGE_DIR: dataDirectory,
  DOCUMENT_STORAGE_DIR: join(storage, 'uploads'),
  JWT_SECRET: 'fictional-e2e-secret-with-at-least-32-characters',
  FRONTEND_URL: 'http://127.0.0.1:5175',
  OPENAI_API_KEY: '',
  VITE_API_URL: apiUrl,
  JANASEVA_E2E_STORAGE: storage,
  JANASEVA_E2E_API_URL: apiUrl,
}

export default defineConfig({
  testDir: './tests/e2e',
  globalTeardown: './tests/e2e/global-teardown.mjs',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5175',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node tests/e2e/start-api.mjs',
      url: `${apiUrl}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: appEnv,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
      url: 'http://127.0.0.1:5175',
      reuseExistingServer: false,
      timeout: 30_000,
      env: appEnv,
    },
  ],
})