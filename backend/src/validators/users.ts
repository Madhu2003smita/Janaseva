import { z } from 'zod'
import { userRoles } from '../models/User.js'

export const userIdParamsSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user identifier.'),
})

const userFields = {
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((email) => email.toLowerCase()),
  role: z.enum(userRoles),
  district: z.string().trim().min(2).max(100),
}

export const createUserSchema = z.object({
  ...userFields,
  password: z.string().min(12).max(128),
}).strict()

export const updateUserSchema = z.object({
  name: userFields.name.optional(),
  role: userFields.role.optional(),
  district: userFields.district.optional(),
  active: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required.')

export const listUsersSchema = z.object({
  district: z.string().trim().max(100).optional(),
  role: z.enum(userRoles).optional(),
  active: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
})
