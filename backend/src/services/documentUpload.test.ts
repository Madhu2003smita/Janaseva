import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

function makePdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Length 35 >>\nstream\nBT /F1 12 Tf 10 50 Td (test) Tj ET\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let contents = '%PDF-1.4\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(contents))
    contents += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xrefOffset = Buffer.byteLength(contents)
  contents += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) contents += `${String(offset).padStart(10, '0')} 00000 n \n`
  contents += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(contents)
}

test('document API validates uploads, scopes access, audits actions and persists files and metadata', async () => {
  const testDirectory = resolve(tmpdir(), `janaseva-documents-${randomUUID()}`)
  const dataDirectory = resolve(testDirectory, 'data')
  const uploadsDirectory = resolve(testDirectory, 'uploads')
  const seedDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../data')
  const secret = 'document-upload-test-secret-with-at-least-32-characters'
  process.env.STORAGE_MODE = 'json'
  process.env.JSON_STORAGE_DIR = dataDirectory
  process.env.DOCUMENT_STORAGE_DIR = uploadsDirectory
  process.env.DOCUMENT_MAX_SIZE_BYTES = String(5 * 1024 * 1024)
  process.env.JWT_SECRET = secret
  process.env.NODE_ENV = 'test'
  process.env.FRONTEND_URL = 'http://localhost:5173'

  await mkdir(dataDirectory, { recursive: true })
  await Promise.all(['seed-users.json', 'seed-applications.json', 'seed-audit-logs.json'].map((file) =>
    copyFile(resolve(seedDirectory, file), resolve(dataDirectory, file))))

  let server: import('node:http').Server | undefined
  try {
    const [{ connectJsonStorage, disconnectJsonStorage, getJsonState }, { default: app }, { default: jwt }, { documentStorage }] = await Promise.all([
      import('../storage/jsonStore.js'),
      import('../app.js'),
      import('jsonwebtoken'),
      import('../storage/documentStorage.js'),
    ])
    await connectJsonStorage()
    const initial = await getJsonState()
    const admin = initial.users.find((user) => user.role === 'ADMIN')!
    const fieldOfficer = initial.users.find((user) => user.role === 'FIELD_OFFICER')!
    const application = initial.applications.find((record) => record.documents.some((item) => item.applicable && !item.fileMetadata?.storageKey))!
    const document = application.documents.find((item) => item.applicable && !item.fileMetadata?.storageKey)!
    const unauthorizedApplication = initial.applications.find((record) => record.assignedOfficer !== fieldOfficer._id)!
    const adminToken = jwt.sign({ sub: admin._id }, secret)
    const fieldToken = jwt.sign({ sub: fieldOfficer._id }, secret)

    server = app.listen(0)
    await new Promise<void>((resolveListen, rejectListen) => {
      server!.once('listening', resolveListen)
      server!.once('error', rejectListen)
    })
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const baseUrl = `http://127.0.0.1:${address.port}/api`

    const startVerification = await fetch(`${baseUrl}/applications/${application.applicationId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start_verification', remarks: '' }),
    })
    assert.equal(startVerification.status, 200)

    const sendFile = (token: string | undefined, targetApplicationId: string, targetDocumentId: string, name: string, mimeType: string, bytes: Buffer) => {
      const form = new FormData()
      form.set('documentId', targetDocumentId)
      const fileContents = new ArrayBuffer(bytes.length)
      new Uint8Array(fileContents).set(bytes)
      form.set('file', new Blob([fileContents], { type: mimeType }), name)
      return fetch(`${baseUrl}/applications/${targetApplicationId}/documents`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
    }

    const pdf = makePdf()
    const firstUpload = await sendFile(adminToken, application.applicationId, document._id, 'income-proof.pdf', 'application/pdf', pdf)
    assert.equal(firstUpload.status, 201)
    const firstPayload = await firstUpload.json() as { document: typeof document }
    assert.equal(firstPayload.document.fileMetadata?.originalName, 'income-proof.pdf')
    assert.equal(firstPayload.document.fileMetadata?.size, pdf.length)
    const firstStorageKey = firstPayload.document.fileMetadata?.storageKey
    assert.ok(firstStorageKey)

    const unauthenticatedUpload = await sendFile(undefined, application.applicationId, document._id, 'missing-auth.pdf', 'application/pdf', pdf)
    assert.equal(unauthenticatedUpload.status, 401)
    const unauthorizedUpload = await sendFile(fieldToken, unauthorizedApplication.applicationId, document._id, 'not-authorized.pdf', 'application/pdf', pdf)
    assert.equal(unauthorizedUpload.status, 403)

    const invalidUpload = await sendFile(adminToken, application.applicationId, document._id, 'bad.pdf', 'application/pdf', Buffer.from('not a PDF'))
    assert.equal(invalidUpload.status, 400)
    const mimeMismatch = await sendFile(adminToken, application.applicationId, document._id, 'bad.pdf', 'image/png', pdf)
    assert.equal(mimeMismatch.status, 400)
    const oversizedUpload = await sendFile(
      adminToken,
      application.applicationId,
      document._id,
      'oversized.pdf',
      'application/pdf',
      Buffer.concat([pdf, Buffer.alloc(5 * 1024 * 1024)]),
    )
    assert.equal(oversizedUpload.status, 413)

    const metadataResponse = await fetch(`${baseUrl}/documents/${document._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert.equal(metadataResponse.status, 200)
    const metadata = await metadataResponse.json() as { document: { fileMetadata?: { storageKey?: string } } }
    assert.ok(metadata.document.fileMetadata?.storageKey)
    assert.ok(!JSON.stringify(metadata).includes(uploadsDirectory))
    const downloaded = await fetch(`${baseUrl}/documents/${document._id}/download`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert.equal(downloaded.status, 200)
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), pdf)
    const unauthorizedDownload = await fetch(`${baseUrl}/documents/${document._id}/download`, {
      headers: { Authorization: `Bearer ${fieldToken}` },
    })
    assert.equal(unauthorizedDownload.status, 403)

    await disconnectJsonStorage()
    await connectJsonStorage()
    const persistedAfterRestart = await getJsonState()
    const restartedDocument = persistedAfterRestart.applications.find((record) => record._id === application._id)!
      .documents.find((record) => record._id === document._id)!
    assert.equal(restartedDocument.fileMetadata?.storageKey, firstStorageKey)
    assert.deepEqual(await readFile(resolve(uploadsDirectory, firstStorageKey)), pdf)

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')
    const replacement = await sendFile(adminToken, application.applicationId, document._id, 'replacement.png', 'image/png', png)
    assert.equal(replacement.status, 201)
    const replacementPayload = await replacement.json() as { document: typeof document }
    assert.equal(replacementPayload.document.fileMetadata?.originalName, 'replacement.png')
    await assert.rejects(documentStorage.open(firstStorageKey))

    const additionalDocumentForm = new FormData()
    additionalDocumentForm.set('documentType', 'address')
    additionalDocumentForm.set('applicable', 'false')
    additionalDocumentForm.set('required', 'false')
    const additionalFileContents = new ArrayBuffer(pdf.length)
    new Uint8Array(additionalFileContents).set(pdf)
    additionalDocumentForm.set('file', new Blob([additionalFileContents], { type: 'application/pdf' }), 'optional-address.pdf')
    const additionalDocumentResponse = await fetch(`${baseUrl}/applications/${application.applicationId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: additionalDocumentForm,
    })
    assert.equal(additionalDocumentResponse.status, 201)
    const addedDocument = (await additionalDocumentResponse.json() as { document: typeof document }).document
    assert.equal(addedDocument.documentType, 'address')
    assert.equal(addedDocument.applicable, false)
    assert.equal(addedDocument.required, false)

    const verified = await fetch(`${baseUrl}/applications/${application.applicationId}/documents/${document._id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationStatus: 'Verified', officerRemarks: 'Fictional test verification.' }),
    })
    assert.equal(verified.status, 200)
    const deleted = await fetch(`${baseUrl}/documents/${document._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert.equal(deleted.status, 200)
    const deletedAdditional = await fetch(`${baseUrl}/documents/${addedDocument._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert.equal(deletedAdditional.status, 200)

    const finalState = await getJsonState()
    const finalDocument = finalState.applications.find((record) => record._id === application._id)!
      .documents.find((record) => record._id === document._id)!
    assert.equal(finalDocument.fileMetadata, undefined)
    const actions = finalState.auditLogs.filter((entry) => entry.applicationId === application._id).map((entry) => entry.action)
    assert.ok(actions.includes('Document uploaded'))
    assert.ok(actions.includes('Document viewed'))
    assert.ok(actions.includes('Document replaced'))
    assert.ok(actions.includes('Document verified'))
    assert.ok(actions.includes('Document deleted'))
  } finally {
    if (server) await new Promise<void>((resolveClose, rejectClose) => server!.close((error) => error ? rejectClose(error) : resolveClose()))
    const storage = await import('../storage/jsonStore.js')
    await storage.disconnectJsonStorage()
    await rm(testDirectory, { recursive: true, force: true })
  }
})
