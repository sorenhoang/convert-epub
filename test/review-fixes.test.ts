// Gaps found by the independent review of F-1..F-7. Existing test files stay unchanged.
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { cleanPages } from '../src/cleanup'
import { convert } from '../src/convert'
import { writeEpub } from '../src/epub'
import { layoutPage } from '../src/layout'
import { buildBook } from '../src/structure'
import type { Page, Paragraph, TextItem } from '../src/types'
import { epubcheck } from './epubcheck'
import { makePdf } from './fixtures/make-pdf'

const item = (str: string, x: number, y: number, size = 11): TextItem => ({ str, x, y, width: str.length * size * 0.5, height: size })
const page = (items: TextItem[]): Page => ({ width: 400, height: 600, items })
const long = 'This is a long body paragraph with plenty of words in it so it dominates the size count.'

describe('goal-4 end to end through convert()', () => {
  it('scanned PDF → scanned message', async () => {
    await expect(convert(await makePdf({ pages: [[], []], noText: true }), 's.pdf')).rejects.toThrow('This looks like a scanned PDF with no text layer')
  })
  it('scanned PDF whose only text is a stamp on every page → scanned message, not a generic error', async () => {
    const pdf = await makePdf({ pages: [[], [], []], runningHeader: 'Scanned by SomeTool' })
    await expect(convert(pdf, 's.pdf')).rejects.toThrow('This looks like a scanned PDF with no text layer')
  })
  it('non-PDF bytes → invalid message', async () => {
    await expect(convert(new TextEncoder().encode('nope'), 'x.pdf')).rejects.toThrow('Not a valid PDF file')
  })
})

describe('F-4 through a real PDF', () => {
  it('top-level outline of 3 entries → 3 chapters titled by the outline; author from metadata', async () => {
    const pages = Array.from({ length: 5 }, (_, i) => [`Body text on page ${i + 1}.`])
    const pdf = await makePdf({ author: 'Ann Author', pages, outline: [{ title: 'Intro', page: 0 }, { title: 'Middle', page: 2 }, { title: 'End', page: 4 }] })
    const zip = await JSZip.loadAsync((await convert(pdf, 'o.pdf')).epub)
    const nav = await zip.file('OEBPS/nav.xhtml')!.async('string')
    expect([...nav.matchAll(/<li><a [^>]+>([^<]*)<\/a>/g)].map((m) => m[1])).toEqual(['Intro', 'Middle', 'End'])
    expect(await zip.file('OEBPS/content.opf')!.async('string')).toContain('<dc:creator>Ann Author</dc:creator>')
  })
  it('outline entry with a blank title → "Chapter N"', () => {
    const book = buildBook([{ text: long, size: 11, page: 0 }, { text: long, size: 11, page: 1 }], { filename: 'x.pdf' }, [{ title: 'A', page: 0 }, { title: '  ', page: 1 }])
    expect(book.chapters.map((c) => c.title)).toEqual(['A', 'Chapter 2'])
  })
  it('a one-off title larger than chapter headings does not stop chapter splits', () => {
    const blocks = [{ text: 'Big Title', size: 30, page: 0 }, ...['One', 'Two', 'Three'].flatMap((t, i) => [{ text: `Chapter ${t}`, size: 20, page: i + 1 }, { text: long, size: 11, page: i + 1 }])]
    const book = buildBook(blocks, { title: 'Book', filename: 'x.pdf' }, null)
    expect(book.chapters.map((c) => c.title)).toEqual(['Book', 'Chapter One', 'Chapter Two', 'Chapter Three'])
  })
})

describe('XML safety', () => {
  it('strips characters illegal in XML 1.0 so the EPUB stays valid', async () => {
    const epub = await writeEpub({ title: 'T', author: 'A', chapters: [{ title: 'C', blocks: [{ kind: 'p', text: 'bad\u0001char￿here\uD800x' }] }] })
    expect(epubcheck(epub).messages).toEqual([])
    const zip = await JSZip.loadAsync(epub)
    expect(await zip.file('OEBPS/ch001.xhtml')!.async('string')).toContain('<p>badcharherex</p>')
  })
})

describe('layout robustness', () => {
  it('one line further left than the body does not turn every body line into a paragraph', () => {
    const items = [item('Footnote-ish outlier', 20, 560), item('body one', 50, 500), item('body two', 50, 486), item('body three', 50, 472)]
    expect(layoutPage(page(items)).map((p) => p.lines.join(' | '))).toEqual(['Footnote-ish outlier', 'body one | body two | body three'])
  })
  it('a heading wrapped over two lines with its own larger leading stays one paragraph', () => {
    const items = [item('A Long Chapter', 50, 520, 20), item('Title Wraps', 50, 496, 20), item('body one', 50, 460), item('body two', 50, 446), item('body three', 50, 432)]
    expect(layoutPage(page(items)).map((p) => p.lines.join(' | '))).toEqual(['A Long Chapter | Title Wraps', 'body one | body two | body three'])
  })
})

describe('cleanup robustness', () => {
  const pg = (paragraphs: Paragraph[]) => ({ height: 600, paragraphs })
  it('keeps margin-band words made of roman letters that are not numerals', () => {
    const texts = cleanPages([pg([{ lines: ['Text.'], y: 300, size: 11 }, { lines: ['did'], y: 30, size: 11 }])]).map((b) => b.text)
    expect(texts).toEqual(['Text.', 'did'])
  })
  it('does not merge a body paragraph into a heading that ended the previous page', () => {
    const pages = [pg([{ lines: ['Chapter Two'], y: 80, size: 20 }]), pg([{ lines: ['it began quietly.'], y: 500, size: 11 }])]
    expect(cleanPages(pages).map((b) => b.text)).toEqual(['Chapter Two', 'it began quietly.'])
  })
})
