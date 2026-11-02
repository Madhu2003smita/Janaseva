import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pagePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/FinalReview.tsx')

test('final review exposes its decision actions in English and Odia', async () => {
  const page = await readFile(pagePath, 'utf8')
  for (const label of [
    "approve: 'Approve'",
    "reject: 'Reject'",
    "return: 'Return for Correction'",
    "title: 'Final Review'",
    "history: 'Decision History'",
    "approve: 'ଅନୁମୋଦନ'",
    "reject: 'ପ୍ରତ୍ୟାଖ୍ୟାନ'",
    "return: 'ସଂଶୋଧନ ପାଇଁ ଫେରାନ୍ତୁ'",
    "title: 'ଚୂଡ଼ାନ୍ତ ସମୀକ୍ଷା'",
    "history: 'ନିଷ୍ପତ୍ତି ଇତିହାସ'",
  ]) {
    assert.ok(page.includes(label), `Expected bilingual Final Review label: ${label}`)
  }
})
