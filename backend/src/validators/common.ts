import { z } from 'zod'
import { documentStatuses, documentTypes, priorities, workflowStatuses } from '../models/Application.js'

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier.')
export const workflowStatusSchema = z.enum(workflowStatuses)
export const prioritySchema = z.enum(priorities)
export const documentTypeSchema = z.enum(documentTypes)
export const documentStatusSchema = z.enum(documentStatuses)
export const remarksSchema = z.string().trim().max(5000).default('')
