import { env } from '../config/env.js'
import * as jsonService from './jsonApplicationService.js'
import * as mongoService from './mongoApplicationService.js'

export function listApplications(...args: Parameters<typeof mongoService.listApplications>) {
  return env.STORAGE_MODE === 'json' ? jsonService.listApplications(...args) : mongoService.listApplications(...args)
}

export function getSummary(...args: Parameters<typeof mongoService.getSummary>) {
  return env.STORAGE_MODE === 'json' ? jsonService.getSummary(...args) : mongoService.getSummary(...args)
}

export function getApplication(...args: Parameters<typeof mongoService.getApplication>) {
  return env.STORAGE_MODE === 'json' ? jsonService.getApplication(...args) : mongoService.getApplication(...args)
}

export function createApplication(...args: Parameters<typeof mongoService.createApplication>) {
  return env.STORAGE_MODE === 'json' ? jsonService.createApplication(...args) : mongoService.createApplication(...args)
}

export function updateApplication(...args: Parameters<typeof mongoService.updateApplication>) {
  return env.STORAGE_MODE === 'json' ? jsonService.updateApplication(...args) : mongoService.updateApplication(...args)
}

export function saveFieldObservations(...args: Parameters<typeof mongoService.saveFieldObservations>) {
  return env.STORAGE_MODE === 'json' ? jsonService.saveFieldObservations(...args) : mongoService.saveFieldObservations(...args)
}

export function recordAiAssistAction(...args: Parameters<typeof mongoService.recordAiAssistAction>) {
  return env.STORAGE_MODE === 'json' ? jsonService.recordAiAssistAction(...args) : mongoService.recordAiAssistAction(...args)
}

export function transitionApplication(...args: Parameters<typeof mongoService.transitionApplication>) {
  return env.STORAGE_MODE === 'json' ? jsonService.transitionApplication(...args) : mongoService.transitionApplication(...args)
}

export function assignApplication(...args: Parameters<typeof mongoService.assignApplication>) {
  return env.STORAGE_MODE === 'json' ? jsonService.assignApplication(...args) : mongoService.assignApplication(...args)
}

export function listDocuments(...args: Parameters<typeof mongoService.listDocuments>) {
  return env.STORAGE_MODE === 'json' ? jsonService.listDocuments(...args) : mongoService.listDocuments(...args)
}

export function updateDocument(...args: Parameters<typeof mongoService.updateDocument>) {
  return env.STORAGE_MODE === 'json' ? jsonService.updateDocument(...args) : mongoService.updateDocument(...args)
}

export function attachDocument(...args: Parameters<typeof mongoService.attachDocument>) {
  return env.STORAGE_MODE === 'json' ? jsonService.attachDocument(...args) : mongoService.attachDocument(...args)
}

export function getDocumentById(...args: Parameters<typeof mongoService.getDocumentById>) {
  return env.STORAGE_MODE === 'json' ? jsonService.getDocumentById(...args) : mongoService.getDocumentById(...args)
}

export function deleteDocument(...args: Parameters<typeof mongoService.deleteDocument>) {
  return env.STORAGE_MODE === 'json' ? jsonService.deleteDocument(...args) : mongoService.deleteDocument(...args)
}

export function recordDocumentViewed(...args: Parameters<typeof mongoService.recordDocumentViewed>) {
  return env.STORAGE_MODE === 'json' ? jsonService.recordDocumentViewed(...args) : mongoService.recordDocumentViewed(...args)
}

export function listHistory(...args: Parameters<typeof mongoService.listHistory>) {
  return env.STORAGE_MODE === 'json' ? jsonService.listHistory(...args) : mongoService.listHistory(...args)
}
