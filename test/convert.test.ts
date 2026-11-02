import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { beforeAll, describe, expect, it } from 'vitest'
import { convert } from '../src/convert'
import { epubcheck } from './epubcheck'
import { CROSS_PAGE, HEADER, makeBook } from './fixtures/book'

let pdf: Uint8Array
let epub: Uint8Array
let progress: [number, number][]
let chapters: string[]

beforeAll(async () => {
  pdf = await makeBook()
  progress = []
  epub = (await convert(pdf, 'fixture.pdf', (p, t) => progress.push([p, t]))).epub
  const zip = await JSZip.loadAsync(epub)
  const names = Object.keys(zip.files).filter((n) => /ch\d+\.xhtml$/.test(n)).sort()
  chapters = await Promise.all(names.map((n) => zip.file(n)!.async('string')))
})

describe('F-6 convert', () => {
  it('produces an EPUB with 0 epubcheck errors', () => {
    expect(epubcheck(epub).messages).toEqual([])
  })

  it('splits into the 3 chapters', async () => {
    const zip = await JSZip.loadAsync(epub)
    const nav = await zip.file('OEBPS/nav.xhtml')!.async('string')
    expect([...nav.matchAll(/<li><a [^>]+>([^<]*)<\/a>/g)].map((m) => m[1])).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3'])
  })

  it('removes running headers and bare page numbers', () => {
    const all = chapters.join('\n')
    expect(all).not.toContain(HEADER)
    expect(all).not.toMatch(/<p>\d+<\/p>/)
  })

  it('rejoins the hyphenated line break', () => {
    const all = chapters.join('\n')
    expect(all).toContain('This is an example of hyphenation')
    expect(all).not.toContain('exam-')
  })

  it('keeps the cross-page paragraph as one <p>', () => {
    expect(chapters.join('\n')).toContain(`<p>${CROSS_PAGE}</p>`)
  })

  it('reports progress once per page, ending at (30, 30)', () => {
    expect(progress).toHaveLength(30)
    expect(progress.map(([p]) => p)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
    expect(progress.at(-1)).toEqual([30, 30])
  })

  it('rejects an encrypted PDF with the password error', async () => {
    const enc = new Uint8Array(readFileSync(new URL('./fixtures/encrypted.pdf', import.meta.url)))
    await expect(convert(enc, 'enc.pdf')).rejects.toThrow('This PDF is password-protected')
  })
})
