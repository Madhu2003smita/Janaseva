import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1).max(200),
})
