import { extname } from 'node:path'
import { env } from '../config/env.js'
import type { AuthUser } from '../middleware/authenticate.js'
import { documentTypes, type DocumentUploadMetadata } from '../models/Application.js'
import { documentStorage } from '../storage/documentStorage.js'
import { HttpError } from '../utils/HttpError.js'
import * as applicationService from './applicationService.js'

export type UploadedDocumentFile = {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}

const mimeTypesByExtension: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

function safeOriginalName(filename: string) {
  const basename = filename.replace(/\\/g, '/').split('/').pop() ?? ''
  const sanitized = [...basename].filter((character) => {
    const code = character.charCodeAt(0)
    return code >= 32 && code !== 127
  }).join('').trim()
  if (!sanitized || sanitized.length > 255) {
    throw new HttpError(400, 'The document filename is invalid.', 'INVALID_FILENAME')
  }
  return sanitized
}

function validateFile(file: UploadedDocumentFile) {
  if (!file.buffer.length || file.size !== file.buffer.length) {
    throw new HttpError(400, 'The uploaded document is empty or invalid.', 'INVALID_FILE')
  }
  if (file.size > env.DOCUMENT_MAX_SIZE_BYTES) {
    throw new HttpError(413, 'The document exceeds the configured file size limit.', 'FILE_TOO_LARGE')
  }
  const originalName = safeOriginalName(file.originalname)
  const extension = extname(originalName).toLowerCase()
  const expectedMimeType = mimeTypesByExtension[extension]
  if (!expectedMimeType || file.mimetype.toLowerCase() !== expectedMimeType) {
    throw new HttpError(400, 'Only matching PDF, JPG, JPEG and PNG files are supported.', 'UNSUPPORTED_FILE_TYPE')
  }

  const signatureMatches = extension === '.pdf'
    ? file.buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    : extension === '.png'
      ? file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff
  if (!signatureMatches) {
    throw new HttpError(400, 'The document content does not match its file type.', 'INVALID_FILE_SIGNATURE')
  }
  return { originalName, extension: extension.slice(1), mimeType: expectedMimeType }
}

export async function uploadDocument(applicationId: string, input: {
  documentId?: string
  documentType?: typeof documentTypes[number]
  applicable?: boolean
  required?: boolean
}, file: UploadedDocumentFile | undefined, user: AuthUser) {
  if (!file) throw new HttpError(400, 'Choose a document file to upload.', 'FILE_REQUIRED')
  if (file.size > env.DOCUMENT_MAX_SIZE_BYTES) {
    throw new HttpError(413, 'The document exceeds the configured file size limit.', 'FILE_TOO_LARGE')
  }
  const validated = validateFile(file)
  const storageKey = await documentStorage.save(file.buffer, validated.extension)
  const fileMetadata: DocumentUploadMetadata = {
    originalName: validated.originalName,
    mimeType: validated.mimeType,
    size: file.size,
    storageKey,
    uploadedAt: new Date().toISOString(),
  }
  let result
  try {
    result = await applicationService.attachDocument(applicationId, { ...input, fileMetadata }, user)
  } catch (error) {
    await documentStorage.remove(storageKey)
    throw error
  }
  if (result.previousStorageKey) await documentStorage.remove(result.previousStorageKey)
  return result.document
}

export async function getDocument(documentId: string, user: AuthUser) {
  return applicationService.getDocumentById(documentId, user)
}

export async function openDocument(documentId: string, user: AuthUser) {
  const { document } = await getDocument(documentId, user)
  const metadata = document.fileMetadata
  if (!metadata?.storageKey) throw new HttpError(404, 'Document file not found.', 'DOCUMENT_FILE_NOT_FOUND')
  const stream = await documentStorage.open(metadata.storageKey)
  try {
    await applicationService.recordDocumentViewed(documentId, user)
  } catch (error) {
    stream.destroy()
    throw error
  }
  return { document, stream }
}

export async function deleteDocument(documentId: string, user: AuthUser) {
  const result = await applicationService.deleteDocument(documentId, user)
  await documentStorage.remove(result.previousStorageKey)
  return result.document
}
