import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthUser } from '../middleware/authenticate.js'
import { resolveWorkflowTransition } from './workflowService.js'

const revenueOfficer: AuthUser = {
  id: '000000000000000000000001',
  name: 'Ananya Mishra',
  email: 'revenue@janaseva.local',
  role: 'REVENUE_OFFICER',
  district: 'Khordha',
}
const fieldOfficer: AuthUser = {
  ...revenueOfficer,
  id: '000000000000000000000002',
  role: 'FIELD_OFFICER',
}

test('requires a new application before document verification starts', () => {
  assert.equal(resolveWorkflowTransition('Application received', 'start_verification', revenueOfficer, ''), 'Document verification')
  assert.throws(
    () => resolveWorkflowTransition('Field verification', 'start_verification', revenueOfficer, ''),
    { code: 'INVALID_TRANSITION' },
  )
})

test('does not complete document verification until required documents are verified', () => {
  assert.throws(
    () => resolveWorkflowTransition('Document verification', 'complete_document_verification', revenueOfficer, '', false),
    { code: 'DOCUMENTS_INCOMPLETE' },
  )
  assert.equal(resolveWorkflowTransition('Document verification', 'complete_document_verification', revenueOfficer, '', true), 'Field verification')
})

test('only revenue officers or administrators can make a final decision', () => {
  assert.equal(resolveWorkflowTransition('Final decision', 'approve', revenueOfficer, 'Review completed.'), 'Approved')
  assert.throws(
    () => resolveWorkflowTransition('Final decision', 'reject', fieldOfficer, 'Reason'),
    { code: 'FINAL_DECISION_FORBIDDEN' },
  )
})

test('requires decision remarks for both approval and rejection', () => {
  assert.throws(
    () => resolveWorkflowTransition('Final decision', 'approve', revenueOfficer, ''),
    { code: 'REMARKS_REQUIRED' },
  )
  assert.throws(
    () => resolveWorkflowTransition('Final decision', 'reject', revenueOfficer, ''),
    { code: 'REMARKS_REQUIRED' },
  )
  assert.equal(resolveWorkflowTransition('Final decision', 'approve', revenueOfficer, 'Evidence reviewed.'), 'Approved')
  assert.equal(resolveWorkflowTransition('Final decision', 'reject', revenueOfficer, 'Required details were not supplied.'), 'Rejected')
})

test('returns applications for correction only with instructions and preserves final-stage return', () => {
  assert.throws(
    () => resolveWorkflowTransition('Document verification', 'return_for_correction', revenueOfficer, ''),
    { code: 'REMARKS_REQUIRED' },
  )
  assert.equal(resolveWorkflowTransition('Document verification', 'request_missing_documents', revenueOfficer, 'Upload proof.'), 'Returned for correction')
  assert.equal(resolveWorkflowTransition('Final decision', 'return_for_correction', revenueOfficer, 'Clarify the submitted information.'), 'Returned for correction')
  assert.throws(
    () => resolveWorkflowTransition('Final decision', 'return_for_correction', fieldOfficer, 'Correction instructions.'),
    { code: 'FORBIDDEN' },
  )
})

test('resubmission is only valid from returned status', () => {
  assert.equal(resolveWorkflowTransition('Returned for correction', 'resubmit', revenueOfficer, ''), 'Document verification')
  assert.throws(
    () => resolveWorkflowTransition('Application received', 'resubmit', revenueOfficer, ''),
    { code: 'INVALID_TRANSITION' },
  )
  assert.throws(
    () => resolveWorkflowTransition('Returned for correction', 'resubmit', fieldOfficer, ''),
    { code: 'FORBIDDEN' },
  )
})

test('enforces role boundaries and final verification gates', () => {
  assert.throws(
    () => resolveWorkflowTransition('Application received', 'start_verification', fieldOfficer, ''),
    { code: 'FORBIDDEN' },
  )
  assert.throws(
    () => resolveWorkflowTransition('Field verification', 'complete_field_verification', revenueOfficer, 'Visit complete.'),
    { code: 'FORBIDDEN' },
  )
  assert.throws(
    () => resolveWorkflowTransition('Field verification', 'complete_field_verification', fieldOfficer, 'Visit complete.', true, false),
    { code: 'FIELD_VERIFICATION_INCOMPLETE' },
  )
  assert.equal(resolveWorkflowTransition('Field verification', 'start_field_verification', fieldOfficer, 'Visit started.'), 'Field verification')
  assert.equal(resolveWorkflowTransition('Field verification', 'complete_field_verification', fieldOfficer, 'Visit complete.', true, true), 'Final decision')
  assert.throws(
    () => resolveWorkflowTransition('Final decision', 'approve', revenueOfficer, 'Reviewed.', false, true),
    { code: 'DOCUMENTS_INCOMPLETE' },
  )
  assert.throws(
    () => resolveWorkflowTransition('Final decision', 'approve', revenueOfficer, 'Reviewed.', true, false),
    { code: 'FIELD_VERIFICATION_INCOMPLETE' },
  )
  assert.throws(
    () => resolveWorkflowTransition('Approved', 'reject', revenueOfficer, 'Second decision.'),
    { code: 'INVALID_TRANSITION' },
  )
})
