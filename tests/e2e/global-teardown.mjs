import { rm } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { tmpdir } from 'node:os'

export default async function globalTeardown() {
  const storage = process.env.JANASEVA_E2E_STORAGE
  if (storage) {
    const resolvedStorage = resolve(storage)
    if (resolvedStorage.startsWith(resolve(tmpdir())) && basename(resolvedStorage).startsWith('janaseva-e2e-')) {
      await rm(resolvedStorage, { recursive: true, force: true })
    } else {
      throw new Error('Refusing to remove a path outside the isolated JanaSeva E2E temp directory.')
    }
  }
}