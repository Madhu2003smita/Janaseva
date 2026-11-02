import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const apiUrl = process.env.JANASEVA_E2E_API_URL ?? 'http://127.0.0.1:5508/api'
const demoPassword = 'JanaSevaDemo#2026'

async function loginUi(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(demoPassword)
  await page.getByRole('button', { name: 'Sign in securely' }).click()
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible()
}

async function signOutUi(page: Page) {
  await page.getByRole('button', { name: /Ananya Mishra|Bikash Das|Admin/ }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByLabel('Email address')).toBeVisible()
}

async function apiLogin(request: APIRequestContext, email: string) {
  const response = await request.post(`${apiUrl}/auth/login`, { data: { email, password: demoPassword } })
  expect(response.status()).toBe(200)
  return (await response.json() as { token: string; user: { id: string } })
}

async function authorizedRequest(request: APIRequestContext, token: string, path: string, method: 'GET' | 'POST' | 'PATCH', data?: unknown) {
  return request.fetch(`${apiUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    ...(data === undefined ? {} : { data }),
  })
}

async function createApplication(request: APIRequestContext, includeRequiredDocument = false) {
  const revenue = await apiLogin(request, 'revenue@janaseva.local')
  const field = await apiLogin(request, 'field@janaseva.local')
  const officersResponse = await authorizedRequest(request, revenue.token, '/users/officers?district=Khordha', 'GET')
  expect(officersResponse.status()).toBe(200)
  const officers = (await officersResponse.json() as { officers: { _id: string; role: string }[] }).officers
  const fieldOfficer = officers.find((item) => item.role === 'FIELD_OFFICER')
  expect(fieldOfficer).toBeTruthy()
  const suffix = randomUUID().slice(0, 8)
  const created = await authorizedRequest(request, revenue.token, '/applications', 'POST', {
    applicant: {
      fullName: `Fictional E2E Applicant ${suffix}`,
      fatherOrGuardianName: 'Fictional E2E Guardian',
      mobile: '+91 90000 10001',
    },
    address: {
      address: 'Fictional E2E address, Ward 1',
      district: 'Khordha',
      block: 'Jatni',
      gramPanchayat: 'Jatni',
    },
    annualIncome: 96000,
    priority: 'Normal',
    documents: includeRequiredDocument ? [{ documentType: 'income', applicable: true, required: true }] : [],
  })
  expect(created.status()).toBe(201)
  const applicationId = (await created.json() as { application: { applicationId: string } }).application.applicationId
  const assign = await authorizedRequest(request, revenue.token, `/applications/${applicationId}/assign`, 'PATCH', { officerId: fieldOfficer!._id })
  expect(assign.status()).toBe(200)
  const start = await authorizedRequest(request, revenue.token, `/applications/${applicationId}/status`, 'PATCH', { action: 'start_verification', remarks: '' })
  expect(start.status()).toBe(200)
  if (!includeRequiredDocument) {
    const docs = await authorizedRequest(request, revenue.token, `/applications/${applicationId}/status`, 'PATCH', { action: 'complete_document_verification', remarks: '' })
    expect(docs.status()).toBe(200)
    const observations = await authorizedRequest(request, field.token, `/applications/${applicationId}/field-observations`, 'PATCH', {
      observations: 'Fictional E2E field verification observation.',
    })
    expect(observations.status()).toBe(200)
    const completeField = await authorizedRequest(request, field.token, `/applications/${applicationId}/status`, 'PATCH', {
      action: 'complete_field_verification',
      remarks: 'Fictional E2E field verification completed.',
    })
    expect(completeField.status()).toBe(200)
  }
  return { applicationId, revenue, field }
}

test('login, dashboard, search, details, language preferences, history and mobile navigation', async ({ page }) => {
  await loginUi(page, 'revenue@janaseva.local')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Total applications')).toBeVisible()
  await page.getByRole('button', { name: /^Applications/ }).click()
  await page.getByPlaceholder('Search applicant name or application ID').fill('INC-2026-0841')
  await expect(page.getByRole('row').filter({ hasText: 'INC-2026-0841' })).toBeVisible()
  await page.getByRole('button', { name: 'View details' }).first().click()
  await expect(page.getByText('Applicant information')).toBeVisible()
  await expect(page.getByText('Document verification')).toBeVisible()
  await page.getByRole('button', { name: 'ଓଡ଼ିଆ' }).click()
  await expect(page.getByText('ଆବେଦନକାରୀଙ୍କ ସୂଚନା')).toBeVisible()

  await page.getByRole('button', { name: 'ସେଟିଂସ' }).click()
  await page.getByLabel('ସଂକ୍ଷିପ୍ତ ତାଲିକା').check()
  expect(await page.evaluate(() => localStorage.getItem('janaseva.compactDisplay'))).toBe('true')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'ନାଭିଗେସନ୍ ଖୋଲନ୍ତୁ' }).click()
  await page.getByRole('button', { name: 'ଆବେଦନ ଇତିହାସ' }).click()
  await expect(page.getByRole('heading', { name: 'ଆବେଦନ ଇତିହାସ' })).toBeVisible()
  await page.getByLabel('ଆବେଦନ ID').fill('INC-2026-0841')
  await page.getByRole('button', { name: 'ଇତିହାସ ଖୋଜନ୍ତୁ' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'ପୂର୍ବ ସ୍ଥିତି → ନୂଆ ସ୍ଥିତି' })).toBeVisible()
  await page.locator('.history-filters input[type="date"]').nth(0).fill('2020-01-01')
  await page.locator('.history-filters input[type="date"]').nth(1).fill('2099-12-31')
  await page.locator('.history-filters select').nth(1).selectOption({ index: 1 })
  await expect(page.getByRole('table')).toBeVisible()
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
})

test('admin can manage team accounts and field officers cannot access team management', async ({ page, request }) => {
  await loginUi(page, 'admin@janaseva.local')
  await page.getByRole('button', { name: 'Team management' }).click()
  await expect(page.getByRole('heading', { name: 'Team management' })).toBeVisible()
  const email = `fictional-e2e-${randomUUID().slice(0, 8)}@janaseva.local`
  await page.getByRole('button', { name: 'Create officer account' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Full name').fill('Fictional Browser QA Officer')
  await dialog.getByLabel('Email address').fill(email)
  await dialog.getByLabel('Temporary password').fill('Fictional-E2E-Password-2026')
  await dialog.getByLabel('Officer role').selectOption({ label: 'Field Officer' })
  await dialog.getByLabel('District').selectOption('Khordha')
  await dialog.getByRole('button', { name: 'Create account' }).click()
  const row = page.getByRole('row').filter({ hasText: email })
  await expect(row).toBeVisible()
  await page.getByPlaceholder('Search name, email or district').fill(email)
  await page.locator('.workspace-filters select').nth(0).selectOption('FIELD_OFFICER')
  await page.locator('.workspace-filters select').nth(1).selectOption('Khordha')
  await expect(page.getByRole('row').filter({ hasText: email })).toBeVisible()
  await page.getByPlaceholder('Search name, email or district').fill('')
  await page.locator('.workspace-filters select').nth(0).selectOption('')
  await page.locator('.workspace-filters select').nth(1).selectOption('')
  await row.getByRole('button', { name: 'Edit: Fictional Browser QA Officer' }).click()
  const editDialog = page.getByRole('dialog')
  await editDialog.getByLabel('Officer role').selectOption({ label: 'Revenue Officer' })
  await editDialog.getByLabel('District').selectOption('Cuttack')
  await editDialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('row').filter({ hasText: email })).toContainText('Revenue Officer')
  const editedRow = page.getByRole('row').filter({ hasText: email })
  await editedRow.getByRole('button', { name: 'Inactive: Fictional Browser QA Officer' }).click()
  await expect(page.getByRole('row').filter({ hasText: email })).toContainText('Inactive')
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out securely' }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByLabel('Email address')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('janaseva.accessToken'))).toBeNull()
  await loginUi(page, 'field@janaseva.local')
  await page.goto('/team')
  await expect(page.getByText('Only administrators can manage user accounts.')).toBeVisible()
  const field = await apiLogin(request, 'field@janaseva.local')
  const userList = await authorizedRequest(request, field.token, '/users', 'GET')
  expect(userList.status()).toBe(403)
})

test('document review and assigned field verification lead to a human approval and audit history', async ({ page, request }) => {
  const { applicationId, field } = await createApplication(request, true)
  await loginUi(page, 'revenue@janaseva.local')
  await page.goto(`/applications/${applicationId}`)
  const pdfPath = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n')
  await page.locator('.document-row input[type="file"]').first().setInputFiles({
    name: 'fictional-e2e-income.pdf',
    mimeType: 'application/pdf',
    buffer: pdfPath,
  })
  await expect(page.getByText('Document uploaded.')).toBeVisible()
  await page.getByLabel('Verification').selectOption('Verified')
  await page.getByRole('button', { name: 'Complete document verification' }).click()
  await expect(page.locator('.management-status')).toContainText('Field verification')

  await signOutUi(page)
  await loginUi(page, 'field@janaseva.local')
  await page.goto(`/applications/${applicationId}/review`)
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0)
  await page.goto('/team')
  await expect(page.getByText('Only administrators can manage user accounts.')).toBeVisible()
  await page.goto(`/applications/${applicationId}`)
  await page.getByLabel('Field officer observations').fill('Fictional E2E field visit: observations recorded for test only.')
  await page.getByRole('button', { name: 'Save field observations' }).click()
  await page.getByLabel('Remarks or requested corrections').fill('Fictional E2E field verification complete.')
  await page.getByRole('button', { name: 'Complete field verification' }).click()
  await expect(page.locator('.management-status')).toContainText('Final decision')
  await signOutUi(page)

  await loginUi(page, 'revenue@janaseva.local')
  await page.goto(`/applications/${applicationId}/review`)
  await page.getByLabel('Decision remarks').fill('Fictional E2E approval after reviewing the evidence.')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('Application approved and decision recorded.')).toBeVisible()
  await page.goto('/history')
  await page.getByLabel('Application ID').fill(applicationId)
  await page.getByRole('button', { name: 'Search history' }).click()
  await expect(page.getByText('Fictional E2E approval after reviewing the evidence.')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Application approved' })).toBeVisible()
  const fieldApi = await authorizedRequest(request, field.token, `/applications/${applicationId}`, 'GET')
  expect(fieldApi.status()).toBe(200)
})

test('human rejection and correction return/resubmission persist in application history', async ({ page, request }) => {
  const rejected = await createApplication(request)
  const returned = await createApplication(request)
  await loginUi(page, 'revenue@janaseva.local')
  await page.goto(`/applications/${rejected.applicationId}/review`)
  await page.getByLabel('Decision remarks').fill('Fictional E2E rejection reason for test coverage.')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Reject' }).click()
  await expect(page.getByText('Application rejected and decision recorded.')).toBeVisible()

  await page.goto(`/applications/${returned.applicationId}/review`)
  await page.getByLabel('Missing information or correction instructions').fill('Fictional E2E correction request for test coverage.')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Return for Correction' }).click()
  await expect(page.getByText('Application returned for correction.')).toBeVisible()
  await page.goto(`/applications/${returned.applicationId}`)
  await page.getByRole('button', { name: 'Record applicant resubmission' }).click()
  await expect(page.locator('.history-timeline').getByText('Application resubmitted')).toBeVisible()

  await page.goto('/history')
  await page.getByLabel('Application ID').fill(returned.applicationId)
  await page.getByRole('button', { name: 'Search history' }).click()
  await expect(page.getByRole('cell', { name: 'Application returned' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Application resubmitted' })).toBeVisible()
  await page.getByLabel('Action').selectOption({ label: 'Application resubmitted' })
  await expect(page.getByRole('cell', { name: 'Application returned' })).toHaveCount(0)
  const rejectHistory = await authorizedRequest(request, rejected.revenue.token, `/applications/${rejected.applicationId}/history`, 'GET')
  expect(rejectHistory.status()).toBe(200)
  expect(await rejectHistory.text()).toContain('Fictional E2E rejection reason for test coverage.')
})