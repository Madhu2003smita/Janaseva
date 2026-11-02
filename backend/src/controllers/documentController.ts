import type { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import * as documentService from '../services/documentService.js'

function documentIdFrom(request: Request) {
  const documentId = request.params.documentId
  if (!documentId || Array.isArray(documentId)) {
    throw new HttpError(400, 'Document identifier is invalid.', 'INVALID_IDENTIFIER')
  }
  return documentId
}

export const getDocumentController = asyncHandler(async (request: Request, response: Response) => {
  const result = await documentService.getDocument(documentIdFrom(request), request.user!)
  response.json(result)
})

export const downloadDocumentController = asyncHandler(async (request: Request, response: Response, next) => {
  const { document, stream } = await documentService.openDocument(documentIdFrom(request), request.user!)
  const metadata = document.fileMetadata
  if (!metadata?.originalName || !metadata.mimeType || metadata.size == null) {
    throw new HttpError(404, 'Document file not found.', 'DOCUMENT_FILE_NOT_FOUND')
  }
  const filename = [...metadata.originalName].map((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127 || character === '"' || character === '\\' ? '_' : character
  }).join('')
  const encodedFilename = encodeURIComponent(filename)
    .replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  const inline = request.query.disposition === 'inline'
  response.setHeader('Content-Type', metadata.mimeType)
  response.setHeader('Content-Length', metadata.size)
  response.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodedFilename}`)
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Cache-Control', 'private, no-store')
  stream.on('error', (error) => {
    if (response.headersSent) response.destroy(error)
    else next(error)
  })
  stream.pipe(response)
})

export const deleteDocumentController = asyncHandler(async (request: Request, response: Response) => {
  const document = await documentService.deleteDocument(documentIdFrom(request), request.user!)
  response.json({ document })
})
