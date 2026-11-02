import OpenAI from 'openai'
import type { AuthUser } from '../middleware/authenticate.js'
import type { WorkflowStatus } from '../models/Application.js'
import { env } from '../config/env.js'
import * as applicationService from './applicationService.js'
import { HttpError } from '../utils/HttpError.js'
import {
  applicationSummaryResultSchema,
  documentReviewResultSchema,
  fieldChecklistResultSchema,
  fieldSummaryResultSchema,
  type applicationSummaryRequestSchema,
  type documentReviewRequestSchema,
  type fieldChecklistRequestSchema,
  type fieldSummaryRequestSchema,
} from '../validators/ai.js'
import type { z } from 'zod'

type GenerateStructured = (systemPrompt: string, context: unknown) => Promise<unknown>
type RequestLanguage = 'en' | 'or'
type ApplicationSource = {
  applicationId: string
  applicant: { fullName: string; fatherOrGuardianName: string; mobile: string }
  address: { address: string; district: string; block: string; gramPanchayat: string }
  annualIncome: number
  currentStatus: WorkflowStatus
  documents: {
    documentType: string
    applicable: boolean
    required: boolean
    verificationStatus: string
    officerRemarks?: string
    fileMetadata?: { storageKey?: string | null } | null
  }[]
  verificationRemarks?: string
  fieldObservations?: string
}

const languageNames: Record<RequestLanguage, string> = { en: 'English', or: 'natural Odia (Odia script)' }
const documentTypeLabels: Record<string, Record<RequestLanguage, string>> = {
  aadhaar: { en: 'Aadhaar identification', or: 'ଆଧାର ପରିଚୟ ପତ୍ର' },
  ration: { en: 'Ration card', or: 'ରାସନ କାର୍ଡ' },
  declaration: { en: 'Income declaration', or: 'ଆୟ ଘୋଷଣାପତ୍ର' },
  salary: { en: 'Salary certificate / income proof', or: 'ଦରମା ପ୍ରମାଣପତ୍ର / ଆୟ ପ୍ରମାଣ' },
  supporting: { en: 'Other supporting document', or: 'ଅନ୍ୟାନ୍ୟ ସହାୟକ ଦସ୍ତାବିଜ' },
}

function documentTypeLabel(documentType: string, language: RequestLanguage) {
  return documentTypeLabels[documentType]?.[language] ?? documentType
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sanitizeText(value: string, application: ApplicationSource) {
  let safe = value
  for (const name of [application.applicant.fullName, application.applicant.fatherOrGuardianName]) {
    if (name.trim()) safe = safe.replace(new RegExp(escapeRegex(name), 'gi'), '[person]')
  }
  return safe
    .replace(/\b\d(?:[\s-]*\d){11}\b/g, '[redacted identification number]')
    .replace(/\b(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){10}\b/g, '[redacted phone number]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]')
    .slice(0, 1000)
}

function documentContext(application: ApplicationSource) {
  return application.documents.map((document) => ({
    documentType: document.documentType,
    applicable: document.applicable,
    required: document.required,
    filePresent: Boolean(document.fileMetadata?.storageKey),
    verificationStatus: document.verificationStatus,
    officerRemarks: sanitizeText(document.officerRemarks ?? '', application),
  }))
}

function parseResult<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new HttpError(502, 'The AI service returned an invalid response. Please retry or continue manual review.', 'AI_INVALID_RESPONSE')
  return parsed.data
}

function createOpenAIGenerator(): GenerateStructured {
  return async (systemPrompt, context) => {
    if (!env.OPENAI_API_KEY) {
      throw new HttpError(503, 'AI assistance is not configured. Set OPENAI_API_KEY on the backend.', 'AI_NOT_CONFIGURED')
    }
    try {
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
      const response = await client.responses.create({
        model: env.AI_MODEL,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
          { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(context) }] },
        ],
        text: { format: { type: 'json_object' } },
      })
      if (!response.output_text) throw new Error('Empty AI response.')
      return JSON.parse(response.output_text) as unknown
    } catch (error) {
      if (error instanceof HttpError) throw error
      console.error('OpenAI request failed:', error instanceof Error ? error.message : 'Unknown provider error')
      throw new HttpError(502, 'AI assistance is temporarily unavailable. Please retry or continue manual review.', 'AI_SERVICE_UNAVAILABLE')
    }
  }
}

async function getApplicationForAi(applicationId: string, user: AuthUser): Promise<ApplicationSource> {
  const application = await applicationService.getApplication(applicationId, user)
  return {
    applicationId: application.applicationId,
    applicant: {
      fullName: application.applicant.fullName,
      fatherOrGuardianName: application.applicant.fatherOrGuardianName,
      mobile: application.applicant.mobile,
    },
    address: {
      address: application.address.address,
      district: application.address.district,
      block: application.address.block,
      gramPanchayat: application.address.gramPanchayat,
    },
    annualIncome: application.annualIncome,
    currentStatus: application.currentStatus,
    documents: application.documents.map((document) => ({
      documentType: document.documentType,
      applicable: document.applicable,
      required: document.required,
      verificationStatus: document.verificationStatus,
      officerRemarks: document.officerRemarks ?? '',
      fileMetadata: document.fileMetadata ? { storageKey: document.fileMetadata.storageKey } : undefined,
    })),
    verificationRemarks: application.verificationRemarks ?? '',
    fieldObservations: application.fieldObservations ?? '',
  }
}

const defaultDependencies = {
  getApplication: getApplicationForAi,
  saveFieldObservations: applicationService.saveFieldObservations,
  recordAiAssistAction: applicationService.recordAiAssistAction,
}

export function createAiAssistantService(
  generate: GenerateStructured = createOpenAIGenerator(),
  dependencies: {
    getApplication(applicationId: string, user: AuthUser): Promise<ApplicationSource>
    saveFieldObservations(applicationId: string, observations: string, user: AuthUser): Promise<unknown>
    recordAiAssistAction(applicationId: string, user: AuthUser, action: string): Promise<unknown>
  } = defaultDependencies,
) {
  return {
    async reviewDocuments(input: z.infer<typeof documentReviewRequestSchema>, user: AuthUser) {
      const application = await dependencies.getApplication(input.applicationId, user)
      const docs = documentContext(application)
      const result = parseResult(documentReviewResultSchema, await generate(
        `You are a cautious administrative support assistant. Respond in ${languageNames[input.language]}. Analyze only the supplied application fields, document metadata/statuses, and officer remarks. Do not claim to verify authenticity, inspect file contents, or infer facts not present. The files are not provided to you. Identify possible missing information, inconsistencies supported by the supplied data, and an actionable document checklist. Clearly explain uncertainty. Do not recommend approval or rejection. Return JSON with keys findings (array of {category, severity, title, explanation, recommendedAction}), checklist (array of {documentType, state, note}), uncertainty.`,
        {
          declaredAnnualIncome: application.annualIncome,
          district: application.address.district,
          block: application.address.block,
          applicationStatus: application.currentStatus,
          documents: docs,
        },
      ))
      const findings = [...result.findings]
      for (const doc of docs) {
        if (doc.applicable && doc.required && !doc.filePresent
          && !findings.some((finding) => finding.category === 'missing_document'
            && (finding.title.toLowerCase().includes(doc.documentType.toLowerCase())
              || finding.title.toLowerCase().includes(documentTypeLabel(doc.documentType, input.language).toLowerCase())))) {
          findings.push({
            category: 'missing_document',
            severity: 'high',
            title: input.language === 'or'
              ? `ଆବଶ୍ୟକ ଦସ୍ତାବିଜ ମିଳିନାହିଁ: ${documentTypeLabel(doc.documentType, input.language)}`
              : `Required document missing: ${documentTypeLabel(doc.documentType, input.language)}`,
            explanation: input.language === 'or'
              ? 'ଏହି ଦସ୍ତାବିଜକୁ ପ୍ରଯୁଜ୍ୟ ଓ ଆବଶ୍ୟକ ଭାବେ ଚିହ୍ନିତ କରାଯାଇଛି, କିନ୍ତୁ ଅପଲୋଡ୍ ଫାଇଲ୍ ରେକର୍ଡ ନାହିଁ।'
              : 'This document is marked applicable and required, but no uploaded file metadata is recorded.',
            recommendedAction: input.language === 'or'
              ? 'ପ୍ରଯୁଜ୍ୟ ପ୍ରକ୍ରିୟା ଅନୁଯାୟୀ ଏହାର ଆବଶ୍ୟକତା ନିଶ୍ଚିତ କରି, ଆବଶ୍ୟକ ହେଲେ ଦସ୍ତାବିଜ ମାଗନ୍ତୁ।'
              : 'Confirm the requirement under the applicable process and request the document if needed.',
          })
        }
      }
      await dependencies.recordAiAssistAction(application.applicationId, user, 'AI document review generated')
      return {
        findings,
        checklist: result.checklist,
        uncertainty: result.uncertainty,
        warning: 'AI suggestion only. Document contents were not provided to the model, and authenticity cannot be established by this review.',
      }
    },

    async generateFieldChecklist(input: z.infer<typeof fieldChecklistRequestSchema>, user: AuthUser) {
      const application = await dependencies.getApplication(input.applicationId, user)
      const result = parseResult(fieldChecklistResultSchema, await generate(
        `You are a neutral field-work assistant. Respond in ${languageNames[input.language]}. Generate questions and a supporting-evidence checklist for a field officer. Do not presume any answer or state that a visit occurred. Do not decide eligibility. Return JSON with identityQuestions, residentialQuestions, incomeQuestions, supportingEvidence, additionalQuestions (arrays of strings), and uncertainty.`,
        {
          applicationStatus: application.currentStatus,
          district: application.address.district,
          block: application.address.block,
          gramPanchayat: application.address.gramPanchayat,
          declaredAnnualIncome: application.annualIncome,
          submittedDocumentTypes: application.documents.filter((document) => document.applicable).map((document) => document.documentType),
        },
      ))
      await dependencies.recordAiAssistAction(application.applicationId, user, 'AI field verification checklist generated')
      return { ...result, warning: 'AI-generated checklist only. The officer must record actual observations; no visit results were inferred.' }
    },

    async generateFieldSummary(input: z.infer<typeof fieldSummaryRequestSchema>, user: AuthUser) {
      if (user.role !== 'FIELD_OFFICER') {
        throw new HttpError(403, 'Only field officers may submit field observations.', 'FORBIDDEN')
      }
      const application = await dependencies.getApplication(input.applicationId, user)
      if (application.currentStatus !== 'Field verification') {
        throw new HttpError(409, 'Field observations can only be summarized during field verification.', 'INVALID_TRANSITION')
      }
      const observations = sanitizeText(input.observations, application)
      await dependencies.saveFieldObservations(application.applicationId, input.observations, user)
      const result = parseResult(fieldSummaryResultSchema, await generate(
        `You summarize only the officer observations supplied below. Respond in ${languageNames[input.language]}. Do not add, infer, embellish, or imply any field visit fact not explicitly stated. If observations are limited or ambiguous, say so. Do not decide eligibility. Return JSON with summary, keyObservations (array of strings), and uncertainty.`,
        { officerObservations: observations },
      ))
      await dependencies.recordAiAssistAction(application.applicationId, user, 'AI field observation summary generated')
      return { ...result, warning: 'This summary is based only on the officer-entered observations and must be checked by the officer.' }
    },

    async generateApplicationSummary(input: z.infer<typeof applicationSummaryRequestSchema>, user: AuthUser) {
      const application = await dependencies.getApplication(input.applicationId, user)
      const docs = documentContext(application)
      const safeVerificationRemarks = sanitizeText(application.verificationRemarks ?? '', application)
      const safeFieldObservations = sanitizeText(application.fieldObservations ?? '', application)
      const missingInformation: string[] = []
      if (!application.applicant.fullName.trim()) missingInformation.push(input.language === 'or' ? 'ଆବେଦନକାରୀଙ୍କ ନାମ ରେକର୍ଡ ହୋଇନାହିଁ।' : 'Applicant name is not recorded.')
      if (!application.applicant.fatherOrGuardianName.trim()) missingInformation.push(input.language === 'or' ? 'ପିତା କିମ୍ବା ଅଭିଭାବକଙ୍କ ନାମ ରେକର୍ଡ ହୋଇନାହିଁ।' : 'Father or guardian name is not recorded.')
      if (!application.address.address.trim()) missingInformation.push(input.language === 'or' ? 'ଠିକଣା ରେକର୍ଡ ହୋଇନାହିଁ।' : 'Address is not recorded.')
      if (!application.annualIncome) missingInformation.push(input.language === 'or' ? 'ବାର୍ଷିକ ପରିବାର ଆୟ ରେକର୍ଡ ହୋଇନାହିଁ।' : 'Annual family income is not recorded.')
      for (const doc of docs) {
        if (doc.applicable && doc.required && !doc.filePresent) {
          missingInformation.push(input.language === 'or'
            ? `ଆବଶ୍ୟକ ଦସ୍ତାବିଜ ମିଳିନାହିଁ: ${documentTypeLabel(doc.documentType, input.language)}।`
            : `Required document is missing: ${documentTypeLabel(doc.documentType, input.language)}.`)
        }
      }
      const result = parseResult(applicationSummaryResultSchema, await generate(
        `You prepare a neutral administrative review summary in ${languageNames[input.language]}. Use only supplied facts. Do not decide eligibility, approve or reject, or suggest an outcome. Distinguish recorded facts from unresolved issues and observations. If field observations are empty, state that none are recorded; do not invent any. Do not claim file authenticity or that file contents were read. Return JSON with summary, submittedDocuments, verifiedDocuments, missingInformation, fieldObservations, outstandingIssues, suggestedNextSteps (arrays of strings), and uncertainty.`,
        {
          workflowStatus: application.currentStatus,
          declaredAnnualIncome: application.annualIncome,
          district: application.address.district,
          block: application.address.block,
          documents: docs,
          verificationRemarks: safeVerificationRemarks,
          fieldObservations: safeFieldObservations,
          recordedMissingInformation: missingInformation,
        },
      ))
      await dependencies.recordAiAssistAction(application.applicationId, user, 'AI application review summary generated')
      return {
        applicantInformation: {
          name: application.applicant.fullName,
          district: application.address.district,
          block: application.address.block,
          annualIncome: application.annualIncome,
          workflowStatus: application.currentStatus,
        },
        ...result,
        warning: 'AI-generated review aid only. It does not determine eligibility or make a decision; an authorized officer must review the record.',
      }
    },
  }
}

export const aiAssistantService = createAiAssistantService()
