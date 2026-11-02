import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'
import { HttpError } from '../utils/HttpError.js'

export interface DocumentStorage {
  save(contents: Buffer, extension: string): Promise<string>
  open(storageKey: string): Promise<Readable>
  remove(storageKey: string): Promise<void>
}

const defaultStorageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../uploads')
const storageDirectory = env.DOCUMENT_STORAGE_DIR
  ? resolve(process.cwd(), env.DOCUMENT_STORAGE_DIR)
  : defaultStorageDirectory
const storageKeyPattern = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(pdf|jpg|jpeg|png)$/i

function safePath(storageKey: string) {
  if (!storageKeyPattern.test(storageKey)) {
    throw new HttpError(404, 'Document file not found.', 'DOCUMENT_FILE_NOT_FOUND')
  }
  return resolve(storageDirectory, storageKey)
}

export class LocalDocumentStorage implements DocumentStorage {
  async save(contents: Buffer, extension: string) {
    await mkdir(storageDirectory, { recursive: true, mode: 0o700 })
    const storageKey = `${randomUUID()}.${extension}`
    await writeFile(safePath(storageKey), contents, { flag: 'wx', mode: 0o600 })
    return storageKey
  }

  async open(storageKey: string) {
    const filePath = safePath(storageKey)
    let fileInfo
    try {
      fileInfo = await stat(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new HttpError(404, 'Document file not found.', 'DOCUMENT_FILE_NOT_FOUND')
      }
      throw error
    }
    if (!fileInfo.isFile()) throw new HttpError(404, 'Document file not found.', 'DOCUMENT_FILE_NOT_FOUND')
    return createReadStream(filePath)
  }

  async remove(storageKey: string) {
    if (!storageKeyPattern.test(storageKey)) return
    try {
      await unlink(safePath(storageKey))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}

export const documentStorage: DocumentStorage = new LocalDocumentStorage()
