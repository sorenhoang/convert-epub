import { makePdf } from './make-pdf'

export const HEADER = 'Running Header Of The Fixture'
export const CROSS_PAGE = 'It was a dark and stormy night that never ended.'

// 30 pages, 3 chapters (pages 1, 11, 21), header + page numbers on every page,
// one hyphenated line break, one paragraph crossing from page 5 to page 6.
export function bookPages(): string[][] {
  const pages: string[][] = []
  for (let p = 0; p < 30; p++) {
    const lines: string[] = []
    if (p % 10 === 0) lines.push(`# Chapter ${p / 10 + 1}`)
    lines.push(`Page ${p + 1} opens with a sentence that runs`, 'onto a second line and ends here.', '')
    if (p === 2) lines.push('This is an exam-', 'ple of hyphenation in a paragraph.', '')
    lines.push('A closing paragraph sits on this page too.')
    if (p === 4) lines.push('', 'It was a dark and')
    if (p === 5) lines.unshift('stormy night that never ended.', '')
    pages.push(lines)
  }
  return pages
}

export const makeBook = () =>
  makePdf({ title: 'Fixture Book', author: 'Test Author', pages: bookPages(), runningHeader: HEADER, pageNumbers: true })
