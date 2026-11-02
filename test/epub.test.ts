import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { writeEpub } from '../src/epub'
import type { Book } from '../src/types'
import { epubcheck } from './epubcheck'

const book: Book = {
  title: 'Truyện Kiều',
  author: 'Nguyễn Du',
  chapters: [
    { title: 'One', blocks: [{ kind: 'h', text: 'One' }, { kind: 'p', text: 'Tom & Jerry say <hi> "there"' }] },
    { title: 'Two', blocks: [{ kind: 'p', text: 'Second chapter.' }] },
    { title: 'Three', blocks: [{ kind: 'p', text: 'Third chapter.' }] },
  ],
}

// Raw zip header: local file header of entry 0 starts at byte 0.
function firstEntry(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const method = view.getUint16(8, true)
  const nameLen = view.getUint16(26, true)
  const extraLen = view.getUint16(28, true)
  const name = new TextDecoder().decode(bytes.subarray(30, 30 + nameLen))
  const size = view.getUint32(18, true)
  const start = 30 + nameLen + extraLen
  const content = new TextDecoder().decode(bytes.subarray(start, start + size))
  return { method, name, content }
}

describe('F-1 writeEpub', () => {
  it('puts mimetype first, stored uncompressed', async () => {
    const bytes = await writeEpub(book)
    const e = firstEntry(bytes)
    expect(e.name).toBe('mimetype')
    expect(e.method).toBe(0)
    expect(e.content).toBe('application/epub+zip')
  })

  it('passes epubcheck with 0 errors, including escaped special characters', async () => {
    const result = epubcheck(await writeEpub(book))
    expect(result.messages).toEqual([])
    expect(result.errors).toBe(0)
  }, 60_000)

  it('escapes & < > " in XHTML', async () => {
    const zip = await JSZip.loadAsync(await writeEpub(book))
    const names = Object.keys(zip.files).filter((n) => n.endsWith('.xhtml') && !n.endsWith('nav.xhtml'))
    const all = (await Promise.all(names.map((n) => zip.file(n)!.async('string')))).join('\n')
    expect(all).toContain('Tom &amp; Jerry say &lt;hi&gt; &quot;there&quot;')
    expect(all).not.toContain('<hi>')
  })

  it('keeps a Vietnamese title in content.opf and nav.xhtml', async () => {
    const zip = await JSZip.loadAsync(await writeEpub(book))
    const opfPath = Object.keys(zip.files).find((n) => n.endsWith('.opf'))!
    const opf = await zip.file(opfPath)!.async('string')
    const nav = await zip.file(Object.keys(zip.files).find((n) => n.endsWith('nav.xhtml'))!)!.async('string')
    expect(opf).toMatch(/<dc:title[^>]*>Truyện Kiều<\/dc:title>/)
    expect(nav).toContain('Truyện Kiều')
  })

  it('lists one nav entry per chapter, in order', async () => {
    const zip = await JSZip.loadAsync(await writeEpub(book))
    const nav = await zip.file(Object.keys(zip.files).find((n) => n.endsWith('nav.xhtml'))!)!.async('string')
    const toc = nav.slice(nav.indexOf('epub:type="toc"'))
    const titles = [...toc.matchAll(/<li><a href="[^"]+">([^<]*)<\/a><\/li>/g)].map((m) => m[1])
    expect(titles).toEqual(['One', 'Two', 'Three'])
  })

  it('rejects a book with no chapters', async () => {
    await expect(writeEpub({ ...book, chapters: [] })).rejects.toThrow('book has no content')
  })
})
