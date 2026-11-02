import JSZip from 'jszip'
import { expect, test, type Page } from '@playwright/test'
import { writeEpub } from '../src/epub'
import { makeBook } from '../test/fixtures/book'

const fixtureEpub = () =>
  writeEpub({
    title: 'Reader Fixture',
    author: 'Ann',
    chapters: ['One', 'Two', 'Three'].map((t, i) => ({
      title: t,
      blocks: [{ kind: 'h' as const, text: t }, { kind: 'p' as const, text: `Chapter ${i + 1} body text.` }],
    })),
  })

// foliate-js renders inside a closed shadow root, so read the book through its iframes.
async function bookText(page: Page): Promise<string> {
  const texts = await Promise.all(
    page.frames().filter((f) => f !== page.mainFrame()).map((f) => f.evaluate(() => document.body?.innerText ?? '').catch(() => '')),
  )
  return texts.join('\n')
}

const open = async (page: Page, buffer: Buffer, name = 'book.epub') =>
  page.locator('#open').setInputFiles({ name, mimeType: 'application/epub+zip', buffer })

test('reader opens a local EPUB: title, TOC, first chapter, next and TOC navigation', async ({ page }) => {
  await page.goto('/reader.html')
  await open(page, Buffer.from(await fixtureEpub()))
  await expect(page.locator('#title')).toHaveText('Reader Fixture')
  await expect(page.locator('#toc option')).toHaveText(['One', 'Two', 'Three'])
  await expect.poll(() => bookText(page)).toContain('Chapter 1 body text.')

  await page.locator('#next').click()
  await expect(page.locator('#location')).toHaveText('Two')
  await expect.poll(() => bookText(page)).toContain('Chapter 2 body text.')

  await page.locator('#toc').selectOption({ label: 'Three' })
  await expect(page.locator('#location')).toHaveText('Three')
  await expect.poll(() => bookText(page)).toContain('Chapter 3 body text.')

  await page.locator('#prev').click()
  await expect(page.locator('#location')).toHaveText('Two')
})

test('reader shows an error for a file that is not an EPUB', async ({ page }) => {
  await page.goto('/reader.html')
  await open(page, Buffer.from('not a zip at all'), 'x.epub')
  await expect(page.locator('#status')).toHaveText('Not a valid EPUB file')
})

test('scripts inside a book do not run', async ({ page }) => {
  const zip = await JSZip.loadAsync(await fixtureEpub())
  const ch = await zip.file('OEBPS/ch001.xhtml')!.async('string')
  zip.file('OEBPS/ch001.xhtml', ch.replace('</body>', '<script>window.top.__pwned = true</script></body>'))
  const evil = await zip.generateAsync({ type: 'nodebuffer' })

  await page.goto('/reader.html')
  await open(page, evil)
  await expect.poll(() => bookText(page)).toContain('Chapter 1 body text.')
  expect(await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBeUndefined()
})

test('reader refuses a src that is not a blob URL from this site, without fetching it', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('/reader.html?src=' + encodeURIComponent('https://example.com/book.epub'))
  await expect(page.locator('#status')).toHaveText('Can only preview files converted on this site')
  expect(requests.filter((u) => new URL(u).hostname === 'example.com')).toEqual([])
})

test('after converting, Preview opens the converted book in the reader', async ({ page, context }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles({ name: 'fixture.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await makeBook()) })
  const preview = page.locator('a#preview')
  await expect(preview).toBeVisible()
  await expect(page.locator('a#download')).toBeVisible()

  const [reader] = await Promise.all([context.waitForEvent('page'), preview.click()])
  await expect(reader.locator('#title')).toHaveText('Fixture Book')
  await expect(reader.locator('#toc option')).toHaveText(['Chapter 1', 'Chapter 2', 'Chapter 3'])
  await expect.poll(() => bookText(reader)).toContain('Page 1 opens with a sentence')
})
