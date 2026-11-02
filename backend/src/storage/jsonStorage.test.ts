import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

test('JSON storage seeds, serializes concurrent updates, and persists workflow and audit changes', async () => {
  const testDirectory = resolve(tmpdir(), `janaseva-json-${randomUUID()}`)
  const seedDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../data')
  process.env.STORAGE_MODE = 'json'
  process.env.JSON_STORAGE_DIR = testDirectory
  process.env.JWT_SECRET = 'json-storage-test-secret-with-at-least-32-characters'

  await mkdir(testDirectory, { recursive: true })
  await Promise.all(['seed-users.json', 'seed-applications.json', 'seed-audit-logs.json'].map((file) =>
    copyFile(resolve(seedDirectory, file), resolve(testDirectory, file))))

  try {
    const storage = await import('./jsonStore.js')
    const service = await import('../services/jsonApplicationService.js')
    await storage.connectJsonStorage()
    const initial = await storage.getJsonState()
    assert.equal(initial.users.length, 3)
    assert.equal(initial.applications.length, 3)
    assert.ok(initial.users.every((user) => user.passwordHash.startsWith('$2')))
    assert.ok(initial.users.every((user) => !user.passwordHash.includes('JanaSevaDemo#2026')))

    const admin = {
      id: initial.users[0]!._id,
      name: initial.users[0]!.name,
      email: initial.users[0]!.email,
      role: initial.users[0]!.role,
      district: initial.users[0]!.district,
    }
    const revenueOfficerRecord = initial.users.find((user) => user.role === 'REVENUE_OFFICER')!
    const revenueOfficer = {
      id: revenueOfficerRecord._id,
      name: revenueOfficerRecord.name,
      email: revenueOfficerRecord.email,
      role: revenueOfficerRecord.role,
      district: revenueOfficerRecord.district,
    }
    const fieldOfficerRecord = initial.users.find((user) => user.role === 'FIELD_OFFICER')!
    const fieldOfficer = {
      id: fieldOfficerRecord._id,
      name: fieldOfficerRecord.name,
      email: fieldOfficerRecord.email,
      role: fieldOfficerRecord.role,
      district: fieldOfficerRecord.district,
    }
    const updated = await service.transitionApplication('INC-2026-0840', 'start_verification', '', admin)
    assert.equal(updated.currentStatus, 'Document verification')

    const documentApplication = initial.applications.find((application) => application.applicationId === 'INC-2026-0842')!
    const document = documentApplication.documents.find((item) => item.documentType === 'aadhaar')!
    const fieldApplication = initial.applications.find((application) => application.applicationId === 'INC-2026-0841')!
    const fieldDocument = fieldApplication.documents[0]!
    await assert.rejects(
      service.updateDocument('INC-2026-0841', fieldDocument._id, {
        verificationStatus: 'Verified',
        officerRemarks: 'Unauthorized fictional verification.',
      }, fieldOfficer),
      { code: 'FORBIDDEN' },
    )
    const recordedObservations = await service.saveFieldObservations(
      'INC-2026-0841',
      'Fictional field observations submitted by the assigned field officer.',
      fieldOfficer,
    )
    assert.equal(recordedObservations.fieldObservations, 'Fictional field observations submitted by the assigned field officer.')
    await service.updateDocument('INC-2026-0842', document._id, {
      verificationStatus: 'Verified',
      officerRemarks: 'Fictional test verification.',
    }, { ...admin, role: 'REVENUE_OFFICER' })

    await Promise.all(Array.from({ length: 10 }, (_, index) =>
      service.updateApplication('INC-2026-0840', { verificationRemarks: `Concurrent update ${index}` }, admin)))

    const persisted = await storage.getJsonState()
    const persistedApplication = persisted.applications.find((application) => application.applicationId === 'INC-2026-0840')!
    const persistedDocuments = persisted.applications.find((application) => application.applicationId === 'INC-2026-0842')!
    assert.equal(persistedApplication.currentStatus, 'Document verification')
    assert.match(persistedApplication.verificationRemarks, /^Concurrent update \d$/)
    assert.equal(persistedDocuments.documents.find((item) => item._id === document._id)?.verificationStatus, 'Verified')
    assert.equal(persisted.auditLogs.filter((entry) => entry.applicationId === persistedApplication._id).length, 12)

    const returnedApplication = await service.transitionApplication(
      'INC-2026-0841',
      'return_for_correction',
      'Fictional correction instructions for persistence testing.',
      revenueOfficer,
    )
    assert.equal(returnedApplication.currentStatus, 'Returned for correction')
    const resubmittedApplication = await service.transitionApplication('INC-2026-0841', 'resubmit', '', revenueOfficer)
    assert.equal(resubmittedApplication.currentStatus, 'Document verification')
    assert.equal(resubmittedApplication.fieldObservations, 'Fictional field observations submitted by the assigned field officer.')
    assert.deepEqual(
      resubmittedApplication.documents.map((item) => [item._id, item.verificationStatus]),
      persisted.applications.find((application) => application.applicationId === 'INC-2026-0841')!.documents
        .map((item) => [item._id, item.verificationStatus]),
    )

    const decisionApplication = persisted.applications.find((application) => application.applicationId === 'INC-2026-0842')!
    await storage.updateJsonState((state: typeof persisted) => {
      const application = state.applications.find((item) => item.applicationId === 'INC-2026-0842')!
      application.currentStatus = 'Final decision'
      application.fieldObservations = 'Fictional field visit observations for persistence testing.'
      for (const requiredDocument of application.documents.filter((item) => item.applicable && item.required)) {
        requiredDocument.verificationStatus = 'Verified'
      }
    })
    const approvedApplication = await service.transitionApplication(
      'INC-2026-0842',
      'approve',
      'Fictional approval remarks for persistence testing.',
      revenueOfficer,
    )
    assert.equal(approvedApplication.currentStatus, 'Approved')
    await assert.rejects(
      service.transitionApplication('INC-2026-0842', 'reject', 'A duplicate decision.', revenueOfficer),
      { code: 'INVALID_TRANSITION' },
    )
    const decisionAudit = (await storage.getJsonState()).auditLogs.find((entry) =>
      entry.applicationId === decisionApplication._id && entry.action === 'Application approved',
    )
    assert.equal(decisionAudit?.actor, revenueOfficer.id)
    assert.equal(decisionAudit?.actorRole, 'REVENUE_OFFICER')
    assert.equal(decisionAudit?.previousStatus, 'Final decision')
    assert.equal(decisionAudit?.newStatus, 'Approved')
    assert.equal(decisionAudit?.remarks, 'Fictional approval remarks for persistence testing.')
    assert.ok(decisionAudit?.timestamp)

    await storage.disconnectJsonStorage()
    const afterRestart = await storage.getJsonState()
    assert.equal(afterRestart.applications.find((application) => application.applicationId === 'INC-2026-0840')?.currentStatus, 'Document verification')
    assert.equal(afterRestart.auditLogs.filter((entry) => entry.applicationId === persistedApplication._id).length, 12)
    assert.equal(afterRestart.applications.find((application) => application.applicationId === 'INC-2026-0842')?.currentStatus, 'Approved')
    assert.ok(afterRestart.auditLogs.some((entry) =>
      entry.applicationId === decisionApplication._id && entry.actorRole === 'REVENUE_OFFICER'
        && entry.remarks === 'Fictional approval remarks for persistence testing.',
    ))
    const returnedAudit = afterRestart.auditLogs.find((entry) =>
      entry.applicationId === fieldApplication._id && entry.action === 'Application returned',
    )
    const resubmissionAudit = afterRestart.auditLogs.find((entry) =>
      entry.applicationId === fieldApplication._id && entry.action === 'Application resubmitted',
    )
    assert.equal(returnedAudit?.previousStatus, 'Field verification')
    assert.equal(returnedAudit?.newStatus, 'Returned for correction')
    assert.equal(returnedAudit?.remarks, 'Fictional correction instructions for persistence testing.')
    assert.equal(resubmissionAudit?.previousStatus, 'Returned for correction')
    assert.equal(resubmissionAudit?.newStatus, 'Document verification')
    assert.equal(afterRestart.applications.find((application) => application._id === fieldApplication._id)?.fieldObservations, 'Fictional field observations submitted by the assigned field officer.')
  } finally {
    await rm(testDirectory, { recursive: true, force: true })
  }
})
