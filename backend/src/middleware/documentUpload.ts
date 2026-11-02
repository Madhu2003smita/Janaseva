import multer from 'multer'
import { env } from '../config/env.js'

export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.DOCUMENT_MAX_SIZE_BYTES,
    files: 1,
    fields: 4,
    fieldSize: 1024,
  },
})
