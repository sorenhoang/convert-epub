import { describe, expect, it } from 'vitest'
import { buildBook } from '../src/structure'
import type { TextBlock } from '../src/types'

const body = (text: string, page = 0): TextBlock => ({ text, size: 11, page })
const head = (text: string, page = 0, size = 20): TextBlock => ({ text, size, page })
const long = 'This is a long body paragraph with plenty of words in it so it dominates the size count.'

describe('F-4 buildBook', () => {
  it('detects headings: ≤ 15 words and ≥ 1.3 × the char-weighted body size', () => {
    const book = buildBook([head('Chapter One'), body(long), { text: 'Slightly big', size: 13, page: 0 }, { text: 'A big but very long line that has far more than fifteen words in it so it is not a heading at all', size: 20, page: 0 }, body(long), body(long)], { filename: 'x.pdf' }, null)
    const kinds = book.chapters.flatMap((c) => c.blocks.map((b) => b.kind))
    expect(kinds).toEqual(['h', 'p', 'p', 'p', 'p', 'p'])
  })

  it('uses body size from character count, not paragraph count', () => {
    // three short 15pt blocks outnumber one 11pt paragraph, but chars make body 11pt, so 15pt (≥ 1.3×) are headings
    const blocks = [{ text: 'a', size: 15, page: 0 }, { text: 'b', size: 15, page: 0 }, { text: 'c', size: 15, page: 0 }, body(long)]
    const kinds = buildBook(blocks, { filename: 'x.pdf' }, null).chapters.flatMap((c) => c.blocks.map((b) => b.kind))
    expect(kinds.slice(0, 3)).toEqual(['h', 'h', 'h'])
  })

  it('splits chapters at top-level outline pages, titled by the outline', () => {
    const blocks = [body(long, 0), body(long, 1), body(long, 2), body(long, 3), body(long, 4)]
    const outline = [{ title: 'Intro', page: 0 }, { title: 'Middle', page: 2 }, { title: 'End', page: 4 }]
    const book = buildBook(blocks, { filename: 'x.pdf' }, outline)
    expect(book.chapters.map((c) => c.title)).toEqual(['Intro', 'Middle', 'End'])
    expect(book.chapters.map((c) => c.blocks.length)).toEqual([2, 2, 1])
  })

  it('without outline, splits at headings of the largest heading size', () => {
    const blocks = [head('Part One', 0, 24), body(long), head('Section', 0, 16), body(long), head('Part Two', 1, 24), body(long, 1)]
    const book = buildBook(blocks, { filename: 'x.pdf' }, null)
    expect(book.chapters.map((c) => c.title)).toEqual(['Part One', 'Part Two'])
    expect(book.chapters[0].blocks.map((b) => b.text)).toEqual(['Part One', long, 'Section', long])
  })

  it('no outline and no headings → one chapter titled with the book title', () => {
    const book = buildBook([body(long), body(long)], { title: 'My Title', filename: 'x.pdf' }, null)
    expect(book.chapters).toHaveLength(1)
    expect(book.chapters[0].title).toBe('My Title')
  })

  it('takes title from metadata, else filename without .pdf; author defaults to Unknown', () => {
    expect(buildBook([body(long)], { title: 'Meta T', author: 'Ann', filename: 'f.pdf' }, null)).toMatchObject({ title: 'Meta T', author: 'Ann' })
    expect(buildBook([body(long)], { title: '  ', filename: 'Dune Book.PDF' }, null)).toMatchObject({ title: 'Dune Book', author: 'Unknown' })
  })
})
