import { z } from 'zod'

const applicationId = z.string().regex(/^INC-\d{4}-\d{4,8}$/i)
const language = z.enum(['en', 'or']).default('en')

export const documentReviewRequestSchema = z.object({ applicationId, language }).strict()
export const fieldChecklistRequestSchema = z.object({ applicationId, language }).strict()
export const fieldSummaryRequestSchema = z.object({
  applicationId,
  observations: z.string().trim().min(1).max(5000),
  language,
}).strict()
export const applicationSummaryRequestSchema = z.object({ applicationId, language }).strict()

const findingSchema = z.object({
  category: z.enum(['missing_document', 'inconsistency', 'incomplete_information', 'other']),
  severity: z.enum(['low', 'medium', 'high']),
  title: z.string().min(1).max(180),
  explanation: z.string().min(1).max(1000),
  recommendedAction: z.string().min(1).max(500),
})

export const documentReviewResultSchema = z.object({
  findings: z.array(findingSchema).max(20),
  checklist: z.array(z.object({
    documentType: z.string().min(1).max(100),
    state: z.enum(['uploaded', 'missing', 'not_applicable', 'reviewed', 'needs_review']),
    note: z.string().min(1).max(500),
  })).max(20),
  uncertainty: z.string().min(1).max(1000),
}).strict()

export const fieldChecklistResultSchema = z.object({
  identityQuestions: z.array(z.string().min(1).max(300)).max(10),
  residentialQuestions: z.array(z.string().min(1).max(300)).max(10),
  incomeQuestions: z.array(z.string().min(1).max(300)).max(10),
  supportingEvidence: z.array(z.string().min(1).max(300)).max(10),
  additionalQuestions: z.array(z.string().min(1).max(300)).max(10),
  uncertainty: z.string().min(1).max(1000),
}).strict()

export const fieldSummaryResultSchema = z.object({
  summary: z.string().min(1).max(2000),
  keyObservations: z.array(z.string().min(1).max(500)).max(15),
  uncertainty: z.string().min(1).max(1000),
}).strict()

export const applicationSummaryResultSchema = z.object({
  summary: z.string().min(1).max(2000),
  submittedDocuments: z.array(z.string().min(1).max(250)).max(20),
  verifiedDocuments: z.array(z.string().min(1).max(250)).max(20),
  missingInformation: z.array(z.string().min(1).max(500)).max(20),
  fieldObservations: z.array(z.string().min(1).max(500)).max(15),
  outstandingIssues: z.array(z.string().min(1).max(500)).max(20),
  suggestedNextSteps: z.array(z.string().min(1).max(500)).max(10),
  uncertainty: z.string().min(1).max(1000),
}).strict()
