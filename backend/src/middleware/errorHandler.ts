import type { ErrorRequestHandler } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import { HttpError } from '../utils/HttpError.js'

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: { code: error.code ?? 'REQUEST_ERROR', message: error.message },
    })
    return
  }
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE'
    response.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? 'FILE_TOO_LARGE' : 'INVALID_MULTIPART_REQUEST',
        message: tooLarge ? 'The document exceeds the configured file size limit.' : 'The document upload request is invalid.',
      },
    })
    return
  }
  if (error instanceof mongoose.Error.ValidationError) {
    response.status(400).json({ error: { code: 'MODEL_VALIDATION_ERROR', message: 'Data validation failed.' } })
    return
  }
  if (error instanceof mongoose.Error.CastError) {
    response.status(400).json({ error: { code: 'INVALID_IDENTIFIER', message: 'An identifier is invalid.' } })
    return
  }
  if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
    response.status(409).json({ error: { code: 'DUPLICATE_RECORD', message: 'A record with the same unique value already exists.' } })
    return
  }
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body contains invalid JSON.' } })
    return
  }
  console.error('Unhandled API error:', error)
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' } })
}
