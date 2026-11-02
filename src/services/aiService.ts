import { apiClient } from './apiClient'

export type AiFinding = {
  category: 'missing_document' | 'inconsistency' | 'incomplete_information' | 'other'
  severity: 'low' | 'medium' | 'high'
  title: string
  explanation: string
  recommendedAction: string
}

export type DocumentReview = {
  findings: AiFinding[]
  checklist: { documentType: string; state: 'uploaded' | 'missing' | 'not_applicable' | 'reviewed' | 'needs_review'; note: string }[]
  uncertainty: string
  warning: string
}

export type FieldChecklist = {
  identityQuestions: string[]
  residentialQuestions: string[]
  incomeQuestions: string[]
  supportingEvidence: string[]
  additionalQuestions: string[]
  uncertainty: string
  warning: string
}

export type FieldSummary = {
  summary: string
  keyObservations: string[]
  uncertainty: string
  warning: string
}

export type ApplicationSummary = {
  applicantInformation: { name: string; district: string; block: string; annualIncome: number; workflowStatus: string }
  summary: string
  submittedDocuments: string[]
  verifiedDocuments: string[]
  missingInformation: string[]
  fieldObservations: string[]
  outstandingIssues: string[]
  suggestedNextSteps: string[]
  uncertainty: string
  warning: string
}

type AiRequest = { applicationId: string; language: 'en' | 'or' }

export const aiService = {
  reviewDocuments(input: AiRequest) {
    return apiClient.request<DocumentReview>('/ai/document-review', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  generateFieldChecklist(input: AiRequest) {
    return apiClient.request<FieldChecklist>('/ai/field-checklist', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  generateFieldSummary(input: AiRequest & { observations: string }) {
    return apiClient.request<FieldSummary>('/ai/field-summary', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  generateApplicationSummary(input: AiRequest) {
    return apiClient.request<ApplicationSummary>('/ai/application-summary', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
}
