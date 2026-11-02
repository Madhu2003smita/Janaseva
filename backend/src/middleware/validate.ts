import type { RequestHandler } from 'express'
import type { z } from 'zod'
import { HttpError } from '../utils/HttpError.js'

export function validate(
  schema: z.ZodType,
  source: 'body' | 'query' | 'params',
): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request[source])
    if (!result.success) {
      return next(new HttpError(400, 'Request validation failed.', 'VALIDATION_ERROR'))
    }
    if (source !== 'query') request[source] = result.data
    next()
  }
}
