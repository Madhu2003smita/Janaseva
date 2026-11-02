import { randomBytes, randomUUID } from 'node:crypto'
import { access, mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { env } from '../config/env.js'
import { documentTypes } from '../models/Application.js'

const defaultDataDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../data')
const dataDirectory = env.JSON_STORAGE_DIR
  ? resolve(process.cwd(), env.JSON_STORAGE_DIR)
  : defaultDataDirectory
const storePath = resolve(dataDirectory, 'store.json')
const lockPath = resolve(dataDirectory, 'store.lock')
const lockWaitMilliseconds = 15_000
const staleLockMilliseconds = 60_000

const userSchema = z.object({
  _id: z.string().regex(/^[a-f\d]{24}$/i),
  name: z.string().min(2).max(120),
  email: z.email(),
  passwordHash: z.string().regex(/^\$2[aby]\$\d\d\$.{53}$/),
  role: z.enum(['ADMIN', 'REVENUE_OFFICER', 'FIELD_OFFICER']),
  district: z.string().min(2).max(100),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()

const documentSchema = z.object({
  _id: z.string().regex(/^[a-f\d]{24}$/i),
  documentType: z.enum(documentTypes),
  applicable: z.boolean(),
  required: z.boolean(),
  verificationStatus: z.enum(['Pending', 'Verified', 'Needs correction']),
  officerRemarks: z.string().max(2000),
  fileMetadata: z.object({
    originalName: z.string().max(255).optional(),
    mimeType: z.string().max(120).optional(),
    size: z.number().min(0).max(25 * 1024 * 1024).optional(),
    storageKey: z.string().max(500).optional(),
    uploadedAt: z.string().datetime().optional(),
  }).strict().optional(),
}).strict()

const applicationSchema = z.object({
  _id: z.string().regex(/^[a-f\d]{24}$/i),
  applicationId: z.string().regex(/^INC-\d{4}-\d{4,8}$/i),
  applicant: z.object({
    fullName: z.string().min(2).max(150),
    fatherOrGuardianName: z.string().min(2).max(150),
    mobile: z.string().regex(/^\+?[0-9 ]{10,16}$/),
  }).strict(),
  address: z.object({
    address: z.string().min(3).max(500),
    district: z.string().min(2).max(100),
    block: z.string().min(2).max(100),
    gramPanchayat: z.string().min(2).max(120),
  }).strict(),
  annualIncome: z.number().finite().min(0).max(100000000),
  submittedAt: z.string().datetime(),
  assignedOfficer: z.string().regex(/^[a-f\d]{24}$/i).nullable(),
  currentStatus: z.enum(['Application received', 'Document verification', 'Field verification', 'Final decision', 'Returned for correction', 'Approved', 'Rejected']),
  priority: z.enum(['Low', 'Normal', 'High', 'Urgent']),
  documents: z.array(documentSchema).max(20),
  verificationRemarks: z.string().max(5000),
  fieldObservations: z.string().max(5000).default(''),
  createdBy: z.string().regex(/^[a-f\d]{24}$/i),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()

const auditLogSchema = z.object({
  _id: z.string().regex(/^[a-f\d]{24}$/i),
  applicationId: z.string().regex(/^[a-f\d]{24}$/i),
  actor: z.string().regex(/^[a-f\d]{24}$/i),
  actorRole: z.enum(['ADMIN', 'REVENUE_OFFICER', 'FIELD_OFFICER']).optional(),
  action: z.string().min(1).max(120),
  previousStatus: z.enum(['Application received', 'Document verification', 'Field verification', 'Final decision', 'Returned for correction', 'Approved', 'Rejected']).nullable(),
  newStatus: z.enum(['Application received', 'Document verification', 'Field verification', 'Final decision', 'Returned for correction', 'Approved', 'Rejected']).nullable(),
  remarks: z.string().max(5000),
  timestamp: z.string().datetime(),
}).strict()

const storeSchema = z.object({
  schemaVersion: z.literal(1),
  users: z.array(userSchema),
  applications: z.array(applicationSchema),
  auditLogs: z.array(auditLogSchema),
}).strict().superRefine((state, context) => {
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) context.addIssue({ code: 'custom', message: `Duplicate ${label} values.` })
  }
  unique(state.users.map((user) => user._id), 'user ID')
  unique(state.users.map((user) => user.email.toLowerCase()), 'user email')
  unique(state.applications.map((application) => application._id), 'application ID')
  unique(state.applications.map((application) => application.applicationId), 'public application ID')
  unique(state.auditLogs.map((entry) => entry._id), 'audit log ID')
  for (const application of state.applications) {
    unique(application.documents.map((document) => document._id), `document ID in ${application.applicationId}`)
    if (!state.users.some((user) => user._id === application.createdBy)) {
      context.addIssue({ code: 'custom', message: `Application ${application.applicationId} references a missing creator.` })
    }
    if (application.assignedOfficer && !state.users.some((user) => user._id === application.assignedOfficer)) {
      context.addIssue({ code: 'custom', message: `Application ${application.applicationId} references a missing assigned officer.` })
    }
  }
  for (const log of state.auditLogs) {
    if (!state.applications.some((application) => application._id === log.applicationId)) {
      context.addIssue({ code: 'custom', message: `Audit log ${log._id} references a missing application.` })
    }
    if (!state.users.some((user) => user._id === log.actor)) {
      context.addIssue({ code: 'custom', message: `Audit log ${log._id} references a missing actor.` })
    }
  }
})

export type JsonUser = z.infer<typeof userSchema>
export type JsonDocument = z.infer<typeof documentSchema>
export type JsonApplication = z.infer<typeof applicationSchema>
export type JsonAuditLog = z.infer<typeof auditLogSchema>
export type JsonStoreState = z.infer<typeof storeSchema>

function storageError(message: string, cause?: unknown) {
  const error = new Error(message, { cause })
  error.name = 'JsonStorageError'
  return error
}

async function loadJsonFile<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  let contents: string
  try {
    contents = await readFile(path, 'utf8')
  } catch (error) {
    throw storageError(`Unable to read JSON storage file "${path}".`, error)
  }
  let raw: unknown
  try {
    raw = JSON.parse(contents)
  } catch (error) {
    throw storageError(`JSON storage file "${path}" contains invalid JSON.`, error)
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw storageError(`JSON storage file "${path}" failed validation: ${result.error.issues.map((issue) => issue.message).join('; ')}`)
  }
  return result.data
}

async function acquireLock() {
  const startedAt = Date.now()
  while (Date.now() - startedAt < lockWaitMilliseconds) {
    let handle: Awaited<ReturnType<typeof open>> | undefined
    try {
      handle = await open(lockPath, 'wx', 0o600)
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }))
      return handle
    } catch (error) {
      if (handle) {
        await handle.close()
        await rm(lockPath, { force: true })
      }
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw storageError('Unable to acquire the JSON storage write lock.', error)
      }
      try {
        const lockStat = await stat(lockPath)
        if (Date.now() - lockStat.mtimeMs > staleLockMilliseconds) {
          await rm(lockPath, { force: true })
          continue
        }
      } catch (lockError) {
        if ((lockError as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw storageError('Unable to inspect the JSON storage write lock.', lockError)
        }
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 40))
    }
  }
  throw storageError('Timed out waiting for the JSON storage write lock.')
}

async function atomicWrite(state: JsonStoreState) {
  const validated = storeSchema.safeParse(state)
  if (!validated.success) {
    throw storageError(`Refusing to persist invalid JSON storage state: ${validated.error.issues.map((issue) => issue.message).join('; ')}`)
  }
  const temporaryPath = resolve(dataDirectory, `.store-${process.pid}-${randomUUID()}.tmp`)
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(temporaryPath, 'wx', 0o600)
    await handle.writeFile(`${JSON.stringify(validated.data, null, 2)}\n`, 'utf8')
    await handle.sync()
    await handle.close()
    handle = undefined
    await rename(temporaryPath, storePath)
  } catch (error) {
    if (handle) await handle.close()
    await rm(temporaryPath, { force: true })
    throw storageError('Unable to atomically save JSON storage.', error)
  }
}

async function readStore() {
  return loadJsonFile(storePath, storeSchema)
}

export function newObjectId() {
  return randomBytes(12).toString('hex')
}

export async function connectJsonStorage() {
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 })
  try {
    await access(storePath)
    await readStore()
    return
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const [users, applications, auditLogs] = await Promise.all([
    loadJsonFile(resolve(dataDirectory, 'seed-users.json'), z.array(userSchema)),
    loadJsonFile(resolve(dataDirectory, 'seed-applications.json'), z.array(applicationSchema)),
    loadJsonFile(resolve(dataDirectory, 'seed-audit-logs.json'), z.array(auditLogSchema)),
  ])
  await atomicWrite({ schemaVersion: 1, users, applications, auditLogs })
}

export async function disconnectJsonStorage() {
  // All writes are completed before their request resolves; no persistent handles remain open.
}

export async function getJsonState() {
  return readStore()
}

export async function updateJsonState<T>(update: (state: JsonStoreState) => T | Promise<T>): Promise<T> {
  const lockHandle = await acquireLock()
  try {
    const state = await readStore()
    const result = await update(state)
    await atomicWrite(state)
    return result
  } finally {
    await lockHandle.close()
    await rm(lockPath, { force: true }).catch((error: unknown) => {
      throw storageError('Unable to release the JSON storage write lock.', error)
    })
  }
}

export function makeId() {
  return newObjectId()
}
