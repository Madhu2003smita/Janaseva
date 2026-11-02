import { z } from 'zod'
import { documentTypes, priorities, workflowStatuses } from '../models/Application.js'
import { objectIdSchema, remarksSchema } from './common.js'

const applicantSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  fatherOrGuardianName: z.string().trim().min(2).max(150),
  mobile: z.string().trim().regex(/^\+?[0-9 ]{10,16}$/),
})

const addressSchema = z.object({
  address: z.string().trim().min(3).max(500),
  district: z.string().trim().min(2).max(100),
  block: z.string().trim().min(2).max(100),
  gramPanchayat: z.string().trim().min(2).max(120),
})

const documentInputSchema = z.object({
  documentType: z.enum(documentTypes),
  applicable: z.boolean(),
  required: z.boolean(),
  verificationStatus: z.enum(['Pending', 'Verified', 'Needs correction']).optional(),
  officerRemarks: z.string().trim().max(2000).optional(),
})

export const createApplicationSchema = z.object({
  applicant: applicantSchema,
  address: addressSchema,
  annualIncome: z.number().finite().min(0).max(100000000),
  priority: z.enum(priorities).default('Normal'),
  documents: z.array(documentInputSchema).max(20).default([]),
  verificationRemarks: z.string().trim().max(5000).default(''),
  assignedOfficer: objectIdSchema.optional(),
})

export const updateApplicationSchema = z.object({
  priority: z.enum(priorities).optional(),
  verificationRemarks: z.string().trim().max(5000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required.')

export const listApplicationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(150).optional(),
  district: z.string().trim().max(100).optional(),
  status: z.enum(workflowStatuses).optional(),
  priority: z.enum(priorities).optional(),
  submittedFrom: z.iso.date().optional(),
  submittedTo: z.iso.date().optional(),
}).refine((value) => !value.submittedFrom || !value.submittedTo || value.submittedFrom <= value.submittedTo, {
  path: ['submittedTo'],
  message: 'End date must be on or after start date.',
})

export const applicationParamsSchema = z.object({ applicationId: z.string().regex(/^INC-\d{4}-\d{4,8}$/i) })
export const documentParamsSchema = applicationParamsSchema.extend({ documentId: objectIdSchema })
export const updateStatusSchema = z.object({
  action: z.enum(['start_verification', 'complete_document_verification', 'request_missing_documents', 'return_for_correction', 'resubmit', 'start_field_verification', 'complete_field_verification', 'approve', 'reject']),
  remarks: remarksSchema,
})
export const fieldObservationsSchema = z.object({
  observations: z.string().trim().min(1).max(5000),
})
export const assignApplicationSchema = z.object({ officerId: objectIdSchema })
export const updateDocumentSchema = z.object({
  verificationStatus: z.enum(['Pending', 'Verified', 'Needs correction']),
  officerRemarks: z.string().trim().max(2000).default(''),
})
export const uploadDocumentSchema = z.object({
  documentId: objectIdSchema.optional(),
  documentType: z.enum(documentTypes).optional(),
  applicable: z.union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')]).optional(),
  required: z.union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')]).optional(),
}).refine((value) => Boolean(value.documentId) || Boolean(value.documentType), {
  path: ['documentType'],
  message: 'Choose a configured document category or document record.',
})
