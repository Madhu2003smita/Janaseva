import assert from 'node:assert/strict'
import test from 'node:test'
import { HttpError } from '../utils/HttpError.js'

process.env.STORAGE_MODE = 'json'
process.env.JWT_SECRET = 'ai-test-secret-with-at-least-32-characters'

const [{ createAiAssistantService }, { documentReviewRequestSchema, fieldSummaryRequestSchema }] = await Promise.all([
  import('./aiAssistantService.js'),
  import('../validators/ai.js'),
])

const revenueOfficer = {
  id: '000000000000000000000002',
  name: 'Test Revenue Officer',
  email: 'revenue@janaseva.local',
  role: 'REVENUE_OFFICER' as const,
  district: 'Khordha',
}
const fieldOfficer = { ...revenueOfficer, role: 'FIELD_OFFICER' as const }

const testApplication = {
  applicationId: 'INC-2026-0842',
  applicant: { fullName: 'Fictional Applicant', fatherOrGuardianName: 'Fictional Guardian', mobile: '+91 90000 10042' },
  address: { address: 'Fictional address', district: 'Khordha', block: 'Jatni', gramPanchayat: 'Jatni' },
  annualIncome: 96000,
  currentStatus: 'Document verification' as 'Document verification' | 'Field verification',
  priority: 'Normal' as const,
  documents: [
    { documentType: 'aadhaar', applicable: true, required: true, verificationStatus: 'Pending', officerRemarks: 'ID 1234 5678 9012', fileMetadata: { storageKey: 'fictional-key' } },
    { documentType: 'ration', applicable: true, required: true, verificationStatus: 'Pending', officerRemarks: 'Not uploaded', fileMetadata: undefined },
  ],
  verificationRemarks: '',
  fieldObservations: '',
}

function createHarness(responses: unknown[]) {
  const prompts: { system: string; context: unknown }[] = []
  const auditActions: string[] = []
  let savedObservations = ''
  const unchangedApplication = structuredClone(testApplication)
  const service = createAiAssistantService(async (system, context) => {
    prompts.push({ system, context })
    const response = responses.shift()
    if (response instanceof Error) throw response
    return response
  }, {
    async getApplication(_id, user) {
      if (user.district !== testApplication.address.district) throw new HttpError(403, 'Forbidden.', 'FORBIDDEN')
      return unchangedApplication
    },
    async saveFieldObservations(_id, observations) {
      savedObservations = observations
    },
    async recordAiAssistAction(_id, _user, action) {
      auditActions.push(action)
    },
  })
  return { service, prompts, auditActions, getSavedObservations: () => savedObservations, unchangedApplication }
}

test('document review detects required missing documents and reports model inconsistencies', async () => {
  const harness = createHarness([{
    findings: [{
      category: 'inconsistency',
      severity: 'medium',
      title: 'Conflicting officer note',
      explanation: 'A note appears inconsistent with the recorded document state.',
      recommendedAction: 'Ask the reviewing officer to clarify.',
    }],
    checklist: [
      { documentType: 'aadhaar', state: 'uploaded', note: 'File metadata is present.' },
      { documentType: 'ration', state: 'missing', note: 'No file metadata is present.' },
    ],
    uncertainty: 'The file contents were not supplied.',
  }])

  const result = await harness.service.reviewDocuments({ applicationId: 'INC-2026-0842', language: 'en' }, revenueOfficer)
  assert.ok(result.findings.some((finding) => finding.category === 'missing_document' && finding.title.toLowerCase().includes('ration')))
  assert.ok(result.findings.some((finding) => finding.category === 'inconsistency'))
  assert.match(result.warning, /authenticity cannot be established/)
  const context = JSON.stringify(harness.prompts[0]?.context)
  assert.ok(!context.includes('Fictional Applicant'))
  assert.ok(!context.includes('90000 10042'))
  assert.ok(!context.includes('1234 5678 9012'))
  assert.equal(harness.unchangedApplication.currentStatus, 'Document verification')
  assert.deepEqual(harness.auditActions, ['AI document review generated'])
})

test('document review localizes deterministic missing-document findings to Odia', async () => {
  const harness = createHarness([{
    findings: [],
    checklist: [],
    uncertainty: 'The file contents were not supplied.',
  }])

  const result = await harness.service.reviewDocuments({ applicationId: 'INC-2026-0842', language: 'or' }, revenueOfficer)
  const missingDocument = result.findings.find((finding) => finding.category === 'missing_document')
  assert.ok(missingDocument)
  assert.match(missingDocument.title, /ଆବଶ୍ୟକ ଦସ୍ତାବିଜ/)
  assert.match(missingDocument.explanation, /ଅପଲୋଡ୍/)
})

test('field checklist returns all requested categories without asserting a field visit', async () => {
  const harness = createHarness([{
    identityQuestions: ['Ask the applicant to state their name.'],
    residentialQuestions: ['Confirm the usual residence with the applicant.'],
    incomeQuestions: ['Ask how the reported income was calculated.'],
    supportingEvidence: ['Record supporting evidence actually reviewed.'],
    additionalQuestions: ['Note unanswered questions.'],
    uncertainty: 'The checklist does not establish facts.',
  }])
  const result = await harness.service.generateFieldChecklist({ applicationId: 'INC-2026-0842', language: 'or' }, revenueOfficer)
  assert.equal(result.identityQuestions.length, 1)
  assert.match(harness.prompts[0]?.system ?? '', /natural Odia/)
  assert.match(result.warning, /no visit results were inferred/)
})

test('field summary uses only supplied observations and stores those observations', async () => {
  const harness = createHarness([{
    summary: 'The officer recorded one observation.',
    keyObservations: ['A household member described seasonal work.'],
    uncertainty: 'Only the text entered by the officer was considered.',
  }])
  harness.unchangedApplication.currentStatus = 'Field verification'
  const observations = 'Applicant reports seasonal work. Contact 9000010042 and ID 123456789012.'
  const result = await harness.service.generateFieldSummary({
    applicationId: 'INC-2026-0842',
    observations,
    language: 'en',
  }, fieldOfficer)
  assert.equal(harness.getSavedObservations(), observations)
  assert.match(JSON.stringify(harness.prompts[0]?.context), /redacted phone number/)
  assert.ok(!JSON.stringify(harness.prompts[0]?.context).includes('123456789012'))
  assert.match(result.warning, /officer-entered observations/)
})

test('only field officers can submit observations for AI summaries', async () => {
  const harness = createHarness([])
  await assert.rejects(
    harness.service.generateFieldSummary({
      applicationId: 'INC-2026-0842',
      observations: 'A fictional observation.',
      language: 'en',
    }, revenueOfficer),
    (error: unknown) => error instanceof HttpError && error.statusCode === 403,
  )
  assert.equal(harness.prompts.length, 0)
})

test('AI field summaries cannot be requested outside the field-verification stage', async () => {
  const harness = createHarness([])
  await assert.rejects(
    harness.service.generateFieldSummary({
      applicationId: 'INC-2026-0842',
      observations: 'A fictional observation.',
      language: 'en',
    }, fieldOfficer),
    (error: unknown) => error instanceof HttpError && error.statusCode === 409,
  )
  assert.equal(harness.prompts.length, 0)
})

test('application summary separates applicant facts and never receives applicant contact details', async () => {
  const harness = createHarness([{
    summary: 'Application is at document verification with a required record outstanding.',
    submittedDocuments: ['aadhaar', 'ration'],
    verifiedDocuments: [],
    missingInformation: ['Required document is missing: ration.'],
    fieldObservations: [],
    outstandingIssues: ['Ration card file is not recorded.'],
    suggestedNextSteps: ['Review the applicable document requirement.'],
    uncertainty: 'The document files were not examined.',
  }])
  const result = await harness.service.generateApplicationSummary({ applicationId: 'INC-2026-0842', language: 'en' }, revenueOfficer)
  const context = JSON.stringify(harness.prompts[0]?.context)
  assert.ok(!context.includes('Fictional Applicant'))
  assert.ok(!context.includes('+91 90000 10042'))
  assert.equal(result.applicantInformation.name, 'Fictional Applicant')
  assert.match(result.warning, /does not determine eligibility/)
  assert.equal(harness.unchangedApplication.currentStatus, 'Document verification')
})

test('denies inaccessible application before contacting AI', async () => {
  const harness = createHarness([])
  const fieldOfficer = { ...revenueOfficer, role: 'FIELD_OFFICER' as const, district: 'Cuttack' }
  await assert.rejects(
    harness.service.generateFieldChecklist({ applicationId: 'INC-2026-0842', language: 'en' }, fieldOfficer),
    (error: unknown) => error instanceof HttpError && error.statusCode === 403,
  )
  assert.equal(harness.prompts.length, 0)
})

test('rejects invalid AI inputs and returns a controlled error when AI is unavailable', async () => {
  assert.equal(documentReviewRequestSchema.safeParse({ applicationId: '../private', language: 'en' }).success, false)
  assert.equal(fieldSummaryRequestSchema.safeParse({ applicationId: 'INC-2026-0842', observations: '', language: 'en' }).success, false)
  const harness = createHarness([new HttpError(503, 'AI unavailable.', 'AI_NOT_CONFIGURED')])
  await assert.rejects(
    harness.service.reviewDocuments({ applicationId: 'INC-2026-0842', language: 'en' }, revenueOfficer),
    (error: unknown) => error instanceof HttpError && error.statusCode === 503,
  )
})
