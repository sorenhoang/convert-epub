import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { epubcheck } from '../test/epubcheck'
import { makeBook } from '../test/fixtures/book'

const encrypted = readFileSync(new URL('../test/fixtures/encrypted.pdf', import.meta.url))

test('converts a PDF locally: progress, download, valid EPUB, no data leaves the origin', async ({ page, baseURL }) => {
  await page.goto('/')
  const origin = new URL(baseURL!).origin
  const offOrigin: string[] = []
  const withBody: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith('blob:') && !r.url().startsWith('data:') && new URL(r.url()).origin !== origin) offOrigin.push(r.url())
    if (['POST', 'PUT', 'PATCH'].includes(r.method()) || r.postData()) withBody.push(`${r.method()} ${r.url()}`)
  })
  // record every status text the page shows, to prove progress updates while the worker runs
  await page.evaluate(() => {
    const w = window as unknown as { statuses: string[] }
    w.statuses = []
    const el = document.querySelector('#status')!
    new MutationObserver(() => w.statuses.push(el.textContent ?? '')).observe(el, { childList: true, characterData: true, subtree: true })
  })

  await page.locator('input[type=file]').setInputFiles({ name: 'fixture.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await makeBook()) })

  const link = page.locator('a#download')
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('download', 'Fixture Book.epub')
  const statuses = await page.evaluate(() => (window as unknown as { statuses: string[] }).statuses)
  expect(new Set(statuses.filter((s) => /\d+\s*\/\s*30/.test(s))).size).toBeGreaterThanOrEqual(2)

  const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
  const file = await download.path()
  expect(epubcheck(new Uint8Array(readFileSync(file))).messages).toEqual([])

  expect(offOrigin).toEqual([])
  expect(withBody).toEqual([])
})

test('shows the password error for an encrypted PDF and offers no download', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles({ name: 'enc.pdf', mimeType: 'application/pdf', buffer: encrypted })
  await expect(page.locator('#status')).toHaveText('This PDF is password-protected')
  await expect(page.locator('a#download')).toBeHidden()
})
