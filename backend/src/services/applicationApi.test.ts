import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n')

test('authenticated API supports approval, correction, rejection, RBAC and restart persistence', async () => {
  const testDirectory = resolve(tmpdir(), `janaseva-api-${randomUUID()}`)
  const dataDirectory = resolve(testDirectory, 'data')
  process.env.STORAGE_MODE = 'json'
  process.env.JSON_STORAGE_DIR = dataDirectory
  process.env.DOCUMENT_STORAGE_DIR = resolve(testDirectory, 'uploads')
  process.env.JWT_SECRET = 'application-api-test-secret-with-at-least-32-characters'
  process.env.NODE_ENV = 'test'
  process.env.FRONTEND_URL = 'http://localhost:5173'
  process.env.OPENAI_API_KEY = ''

  const seedDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../data')
  await mkdir(dataDirectory, { recursive: true })
  await Promise.all(['seed-users.json', 'seed-applications.json', 'seed-audit-logs.json'].map((file) =>
    copyFile(resolve(seedDirectory, file), resolve(dataDirectory, file))))

  let server: import('node:http').Server | undefined
  try {
    const [{ connectJsonStorage, disconnectJsonStorage, getJsonState }, { default: app }] = await Promise.all([
      import('../storage/jsonStore.js'),
      import('../app.js'),
    ])
    await connectJsonStorage()
    server = app.listen(0)
    await new Promise<void>((resolveListen, rejectListen) => {
      server!.once('listening', resolveListen)
      server!.once('error', rejectListen)
    })
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const baseUrl = `http://127.0.0.1:${address.port}/api`

    const request = async (path: string, token?: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      if (token) headers.set('Authorization', `Bearer ${token}`)
      if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
      return fetch(`${baseUrl}${path}`, { ...init, headers })
    }
    const jsonRequest = (path: string, token: string, method: string, body: unknown) =>
      request(path, token, { method, body: JSON.stringify(body) })
    const unauthenticated = await request('/applications')
    assert.equal(unauthenticated.status, 401)

    const login = async (email: string, password = 'JanaSevaDemo#2026') => {
      const response = await request('/auth/login', undefined, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      assert.equal(response.status, 200)
      const result = await response.json() as { token: string; user: { id: string; [key: string]: unknown } }
      assert.ok(!JSON.stringify(result).includes('passwordHash'))
      return result
    }
    const revenueSession = await login('revenue@janaseva.local')
    const fieldSession = await login('field@janaseva.local')
    const adminSession = await login('admin@janaseva.local')
    const revenue = revenueSession.token
    const field = fieldSession.token
    const admin = adminSession.token
    const whoAmI = await request('/auth/me', revenue)
    assert.equal(whoAmI.status, 200)

    const userList = await request('/users', admin)
    assert.equal(userList.status, 200)
    assert.ok(!(await userList.text()).includes('passwordHash'))
    assert.equal((await request('/users', field)).status, 403)
    assert.equal((await request('/users', revenue)).status, 403)
    const createdUser = await jsonRequest('/users', admin, 'POST', {
      name: 'Fictional QA Officer',
      email: `qa-${randomUUID()}@janaseva.local`,
      password: 'Fictional-QA-Password-2026',
      role: 'FIELD_OFFICER',
      district: 'Khordha',
    })
    assert.equal(createdUser.status, 201)
    const createdUserPayload = await createdUser.json() as { user: { id: string; passwordHash?: string } }
    assert.equal(createdUserPayload.user.passwordHash, undefined)
    const updatedUser = await jsonRequest(`/users/${createdUserPayload.user.id}`, admin, 'PATCH', { active: false })
    assert.equal(updatedUser.status, 200)
    assert.equal((await request('/users', field)).status, 403)
    const unassignedFieldEmail = `unassigned-${randomUUID()}@janaseva.local`
    assert.equal((await jsonRequest('/users', admin, 'POST', {
      name: 'Fictional Unassigned QA Officer',
      email: unassignedFieldEmail,
      password: 'Fictional-QA-Password-2026',
      role: 'FIELD_OFFICER',
      district: 'Khordha',
    })).status, 201)
    const unassignedField = (await login(unassignedFieldEmail, 'Fictional-QA-Password-2026')).token

    const applicationInput = (fullName: string, documents: object[] = []) => ({
      applicant: { fullName, fatherOrGuardianName: 'Fictional QA Guardian', mobile: '+91 90000 10001' },
      address: { address: 'Fictional QA address, Ward 1', district: 'Khordha', block: 'Jatni', gramPanchayat: 'Jatni' },
      annualIncome: 96000,
      priority: 'Normal',
      documents,
    })
    const createApplication = async (fullName: string, documents: object[] = []) => {
      const response = await jsonRequest('/applications', revenue, 'POST', applicationInput(fullName, documents))
      assert.equal(response.status, 201)
      return (await response.json() as { application: { applicationId: string; documents: { _id: string }[] } }).application
    }
    const summaryBeforeApplication = await request('/applications/summary', revenue)
    assert.equal(summaryBeforeApplication.status, 200)
    const initialSummary = await summaryBeforeApplication.json() as { summary: { missingDocuments: number } }
    assert.ok(Number.isInteger(initialSummary.summary?.missingDocuments), JSON.stringify(initialSummary))
    const missingBefore = initialSummary.summary.missingDocuments
    await createApplication('Fictional Optional Document Applicant', [
      { documentType: 'supporting', applicable: true, required: false },
    ])
    const summaryWithOptionalMissing = await request('/applications/summary', revenue)
    assert.equal((await summaryWithOptionalMissing.json() as { summary: { missingDocuments: number } }).summary.missingDocuments, missingBefore)
    const approvalApplication = await createApplication('Fictional Approval Applicant', [
      { documentType: 'income', applicable: true, required: true },
      { documentType: 'supporting', applicable: false, required: false },
    ])
    const createdList = await request(`/applications?search=${encodeURIComponent(approvalApplication.applicationId)}&status=Application%20received`, revenue)
    assert.equal(createdList.status, 200)
    assert.equal((await createdList.json() as { items: unknown[] }).items.length, 1)
    assert.equal((await request(`/applications/${approvalApplication.applicationId}`, revenue)).status, 200)
    const summaryWithMissingRequired = await request('/applications/summary', revenue)
    assert.equal((await summaryWithMissingRequired.json() as { summary: { missingDocuments: number } }).summary.missingDocuments, missingBefore + 1)
    const incompleteApplication = await createApplication('Fictional Incomplete Verification Applicant', [
      { documentType: 'income', applicable: true, required: true },
    ])
    assert.equal((await jsonRequest(`/applications/${incompleteApplication.applicationId}/status`, revenue, 'PATCH', {
      action: 'start_verification',
      remarks: '',
    })).status, 200)
    assert.equal((await jsonRequest(`/applications/${incompleteApplication.applicationId}/status`, revenue, 'PATCH', {
      action: 'complete_document_verification',
      remarks: '',
    })).status, 409)
    const invalidUpdate = await jsonRequest(`/applications/${approvalApplication.applicationId}`, revenue, 'PATCH', { currentStatus: 'Approved' })
    assert.equal(invalidUpdate.status, 400)
    assert.equal((await jsonRequest(`/applications/${approvalApplication.applicationId}`, revenue, 'PATCH', { verificationRemarks: 'Fictional QA note.' })).status, 200)

    const fieldUsers = await request('/users/officers', revenue)
    assert.equal(fieldUsers.status, 200)
    const officers = (await fieldUsers.json() as { officers: { _id: string; role: string }[] }).officers
    const fieldUser = officers.find((officer) => officer.role === 'FIELD_OFFICER')
    assert.ok(fieldUser)
    assert.equal((await jsonRequest(`/applications/${approvalApplication.applicationId}/assign`, revenue, 'PATCH', { officerId: fieldUser._id })).status, 200)
    assert.equal((await jsonRequest(`/applications/${approvalApplication.applicationId}/status`, field, 'PATCH', { action: 'start_verification', remarks: '' })).status, 403)
    assert.equal((await jsonRequest(`/applications/${approvalApplication.applicationId}/status`, revenue, 'PATCH', { action: 'start_verification', remarks: '' })).status, 200)
    assert.equal((await jsonRequest('/ai/document-review', revenue, 'POST', { applicationId: approvalApplication.applicationId, language: 'en' })).status, 503)
    assert.equal((await jsonRequest('/ai/field-checklist', field, 'POST', { applicationId: approvalApplication.applicationId, language: 'en' })).status, 503)
    assert.equal((await jsonRequest('/ai/application-summary', revenue, 'POST', { applicationId: approvalApplication.applicationId, language: 'en' })).status, 503)
    assert.equal((await request('/ai/application-summary', undefined, { method: 'POST', body: JSON.stringify({ applicationId: approvalApplication.applicationId }) })).status, 401)

    const documentsResponse = await request(`/applications/${approvalApplication.applicationId}/documents`, revenue)
    assert.equal(documentsResponse.status, 200)
    const requiredDocument = approvalApplication.documents[0]!
    const uploadForm = new FormData()
    const fileBuffer = new ArrayBuffer(pdf.length)
    new Uint8Array(fileBuffer).set(pdf)
    uploadForm.set('documentId', requiredDocument._id)
    uploadForm.set('file', new Blob([fileBuffer], { type: 'application/pdf' }), 'fictional-qa-proof.pdf')
    const uploaded = await request(`/applications/${approvalApplication.applicationId}/documents`, revenue, { method: 'POST', body: uploadForm })
    assert.equal(uploaded.status, 201)
    const uploadedDocument = (await uploaded.json() as { document: { fileMetadata: { storageKey: string } } }).document
    assert.equal((await request(`/applications/${approvalApplication.applicationId}/documents/${requiredDocument._id}`, field, {
      method: 'PATCH',
      body: JSON.stringify({ verificationStatus: 'Verified' }),
    })).status, 403)
    assert.equal((await jsonRequest(`/applications/${approvalApplication.applicationId}/documents/${requiredDocument._id}`, revenue, 'PATCH', {
      verificationStatus: 'Verified',
      officerRemarks: 'Fictional QA document review.',
    })).status, 200)
    assert.equal((await request(`/documents/${requiredDocument._id}/download`, unassignedField)).status, 403)
    assert.equal((await request(`/documents/${requiredDocument._id}/download`, field)).status, 200)
    assert.equal((await request(`/documents/${requiredDocument._id}/download`, revenue)).status, 200)
    assert.equal((await request(`/documents/${requiredDocument._id}`, field, { method: 'DELETE' })).status, 403)
    assert.equal((await request(`/documents/${requiredDocument._id}`, revenue, { method: 'DELETE' })).status, 200)
    assert.equal((await request(`/documents/${requiredDocument._id}/download`, revenue)).status, 404)

    const reuploadedForm = new FormData()
    const reuploadedBytes = new ArrayBuffer(pdf.length)
    new Uint8Array(reuploadedBytes).set(pdf)
    reuploadedForm.set('documentId', requiredDocument._id)
    reuploadedForm.set('file', new Blob([reuploadedBytes], { type: 'application/pdf' }), 'fictional-qa-proof.pdf')
    assert.equal((await request(`/applications/${approvalApplication.applicationId}/documents`, revenue, { method: 'POST', body: reuploadedForm })).status, 201)
    assert.equal((await jsonRequest(`/applications/${approvalApplication.applicationId}/documents/${requiredDocument._id}`, revenue, 'PATCH', {
      verificationStatus: 'Verified',
      officerRemarks: 'Fictional QA document review.',
    })).status, 200)
    assert.equal((await jsonRequest(`/applications/${approvalApplication.applicationId}/documents/${approvalApplication.documents[1]!._id}`, revenue, 'PATCH', {
      verificationStatus: 'Verified',
      officerRemarks: '',
    })).status, 409)

    const completedDocuments = await jsonRequest(`/applications/${approvalApplication.applicationId}/status`, revenue, 'PATCH', {
      action: 'complete_document_verification',
      remarks: '',
    })
    assert.equal(completedDocuments.status, 200)
    const fieldObservations = 'Fictional QA field visit observation; no real applicant data.'
    assert.equal((await jsonRequest('/ai/field-summary', field, 'POST', {
      applicationId: approvalApplication.applicationId,
      observations: fieldObservations,
      language: 'en',
    })).status, 503)
    const observationsAfterAiFailure = await request(`/applications/${approvalApplication.applicationId}`, field)
    assert.equal((await observationsAfterAiFailure.json() as { application: { fieldObservations: string } }).application.fieldObservations, fieldObservations)
    assert.equal((await jsonRequest(`/applications/${approvalApplication.applicationId}/status`, field, 'PATCH', {
      action: 'complete_field_verification',
      remarks: 'Fictional QA field check completed.',
    })).status, 200)
    const finalReview = await request(`/applications/${approvalApplication.applicationId}`, revenue)
    assert.equal(finalReview.status, 200)
    const emptyApproval = await jsonRequest(`/applications/${approvalApplication.applicationId}/status`, revenue, 'PATCH', { action: 'approve', remarks: '   ' })
    assert.equal(emptyApproval.status, 400)
    assert.equal((await jsonRequest(`/applications/${approvalApplication.applicationId}/status`, field, 'PATCH', {
      action: 'approve',
      remarks: 'Unauthorized QA decision.',
    })).status, 403)
    const approval = await jsonRequest(`/applications/${approvalApplication.applicationId}/status`, revenue, 'PATCH', {
      action: 'approve',
      remarks: 'Fictional QA approval after reviewing evidence.',
    })
    assert.equal(approval.status, 200)
    assert.equal((await jsonRequest(`/applications/${approvalApplication.applicationId}/status`, revenue, 'PATCH', {
      action: 'reject',
      remarks: 'Duplicate QA decision.',
    })).status, 409)

    const correctionApplication = await createApplication('Fictional Correction Applicant')
    assert.equal((await jsonRequest(`/applications/${correctionApplication.applicationId}/assign`, revenue, 'PATCH', {
      officerId: fieldSession.user.id,
    })).status, 200)
    const startCorrection = await jsonRequest(`/applications/${correctionApplication.applicationId}/status`, revenue, 'PATCH', { action: 'start_verification', remarks: '' })
    assert.equal(startCorrection.status, 200)
    assert.equal((await jsonRequest(`/applications/${correctionApplication.applicationId}/status`, revenue, 'PATCH', { action: 'complete_document_verification', remarks: '' })).status, 200)
    assert.equal((await jsonRequest(`/applications/${correctionApplication.applicationId}/field-observations`, field, 'PATCH', {
      observations: 'Fictional QA correction scenario field observations.',
    })).status, 200)
    assert.equal((await jsonRequest(`/applications/${correctionApplication.applicationId}/status`, field, 'PATCH', {
      action: 'complete_field_verification',
      remarks: 'Fictional QA field check complete.',
    })).status, 200)
    const emptyReturn = await jsonRequest(`/applications/${correctionApplication.applicationId}/status`, revenue, 'PATCH', {
      action: 'return_for_correction',
      remarks: '',
    })
    assert.equal(emptyReturn.status, 400)
    assert.equal((await jsonRequest(`/applications/${correctionApplication.applicationId}/status`, revenue, 'PATCH', {
      action: 'return_for_correction',
      remarks: 'Fictional request: clarify the declared information.',
    })).status, 200)
    const resubmission = await jsonRequest(`/applications/${correctionApplication.applicationId}/status`, revenue, 'PATCH', { action: 'resubmit', remarks: '' })
    assert.equal(resubmission.status, 200)
    assert.equal((await resubmission.json() as { application: { currentStatus: string; fieldObservations: string } }).application.fieldObservations, 'Fictional QA correction scenario field observations.')
    assert.equal((await jsonRequest(`/applications/${correctionApplication.applicationId}/status`, revenue, 'PATCH', { action: 'complete_document_verification', remarks: '' })).status, 200)
    assert.equal((await jsonRequest(`/applications/${correctionApplication.applicationId}/field-observations`, field, 'PATCH', {
      observations: 'Fictional QA observations for rejection scenario.',
    })).status, 200)
    assert.equal((await jsonRequest(`/applications/${correctionApplication.applicationId}/status`, field, 'PATCH', {
      action: 'complete_field_verification',
      remarks: 'Fictional QA field verification complete.',
    })).status, 200)
    assert.equal((await jsonRequest(`/applications/${correctionApplication.applicationId}/status`, revenue, 'PATCH', {
      action: 'reject',
      remarks: '',
    })).status, 400)
    assert.equal((await jsonRequest(`/applications/${correctionApplication.applicationId}/status`, revenue, 'PATCH', {
      action: 'reject',
      remarks: 'Fictional QA rejection reason: required details remain outstanding.',
    })).status, 200)

    const historyResponse = await request(`/applications/${approvalApplication.applicationId}/history`, revenue)
    assert.equal(historyResponse.status, 200)
    const history = (await historyResponse.json() as { history: { action: string; remarks: string; actorRole?: string; previousStatus?: string; newStatus?: string }[] }).history
    const approvalAudit = history.find((entry) => entry.action === 'Application approved')
    assert.equal(approvalAudit?.actorRole, 'REVENUE_OFFICER')
    assert.equal(approvalAudit?.previousStatus, 'Final decision')
    assert.equal(approvalAudit?.newStatus, 'Approved')
    assert.equal(approvalAudit?.remarks, 'Fictional QA approval after reviewing evidence.')
    const correctionHistory = await request(`/applications/${correctionApplication.applicationId}/history`, revenue)
    const correctionEvents = (await correctionHistory.json() as { history: { action: string; remarks: string }[] }).history
    assert.ok(correctionEvents.some((entry) => entry.action === 'Application returned' && entry.remarks.includes('clarify')))
    assert.ok(correctionEvents.some((entry) => entry.action === 'Application resubmitted'))
    assert.ok(correctionEvents.some((entry) => entry.action === 'Application rejected' && entry.remarks.includes('required details')))

    await disconnectJsonStorage()
    await connectJsonStorage()
    assert.equal((await request(`/applications/${approvalApplication.applicationId}`, revenue)).status, 200)
    const persistedHistory = await request(`/applications/${approvalApplication.applicationId}/history`, revenue)
    assert.ok((await persistedHistory.text()).includes('Fictional QA approval after reviewing evidence.'))
    assert.equal((await request(`/applications/${correctionApplication.applicationId}`, revenue)).status, 200)
    assert.ok(uploadedDocument.fileMetadata.storageKey)

    const invalidPayload = await request('/applications/not-an-id', revenue)
    assert.equal(invalidPayload.status, 400)
    const invalidTransition = await jsonRequest(`/applications/${approvalApplication.applicationId}/status`, revenue, 'PATCH', {
      action: 'resubmit',
      remarks: '',
    })
    assert.equal(invalidTransition.status, 409)
    const finalState = await getJsonState()
    assert.ok(finalState.auditLogs.some((entry) => entry.applicationId ===
      finalState.applications.find((application) => application.applicationId === correctionApplication.applicationId)?._id
      && entry.action === 'Application rejected' && entry.actorRole === 'REVENUE_OFFICER'))
  } finally {
    if (server) await new Promise<void>((resolveClose, rejectClose) => server!.close((error) => error ? rejectClose(error) : resolveClose()))
    const storage = await import('../storage/jsonStore.js')
    await storage.disconnectJsonStorage()
    await rm(testDirectory, { recursive: true, force: true })
  }
})
