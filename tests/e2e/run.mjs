import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const storage = mkdtempSync(join(tmpdir(), 'janaseva-e2e-'))
const resolvedStorage = resolve(storage)

try {
  const dataDirectory = join(storage, 'data')
  mkdirSync(dataDirectory, { recursive: true })
  for (const name of ['seed-users.json', 'seed-applications.json', 'seed-audit-logs.json']) {
    copyFileSync(resolve(root, 'backend', 'data', name), join(dataDirectory, name))
  }

  const apiUrl = 'http://127.0.0.1:5508/api'
  const env = {
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
  const playwrightCli = resolve(root, 'node_modules', '@playwright', 'test', 'cli.js')
  const result = spawnSync(process.execPath, [playwrightCli, 'test'], { cwd: root, env, stdio: 'inherit' })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} catch (error) {
  console.error(error)
  process.exitCode = 1
}

if (dirname(resolvedStorage) !== resolve(tmpdir()) || !basename(resolvedStorage).startsWith('janaseva-e2e-')) {
  console.error('Refusing to remove a path outside the isolated JanaSeva E2E temp directory.')
  process.exitCode = 1
} else {
  try {
    await rm(resolvedStorage, { recursive: true, force: true })
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
