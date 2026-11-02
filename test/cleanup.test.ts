import { describe, expect, it } from 'vitest'
import { cleanPages, normalizeText } from '../src/cleanup'
import type { PageParagraphs, Paragraph } from '../src/types'

const para = (lines: string[], y = 300, size = 11): Paragraph => ({ lines, y, size })
const pg = (paragraphs: Paragraph[]): PageParagraphs => ({ height: 600, paragraphs })
const texts = (pages: PageParagraphs[]) => cleanPages(pages).map((b) => b.text)

describe('F-3 cleanPages', () => {
  it('removes a line repeated at the same y (±2pt) on > 50% of pages', () => {
    const pages = [
      pg([para(['My Book'], 570), para(['Body one.'])]),
      pg([para(['My Book'], 571.5), para(['Body two.'])]),
      pg([para(['Body three.'])]),
    ]
    expect(texts(pages)).toEqual(['Body one.', 'Body two.', 'Body three.'])
  })

  it('keeps a line that repeats on only half the pages or fewer', () => {
    const pages = [pg([para(['Note'], 570), para(['A.'])]), pg([para(['Note'], 570), para(['B.'])]), pg([para(['C.'])]), pg([para(['D.'])])]
    expect(texts(pages)).toContain('Note')
  })

  it('removes bare page numbers (arabic or roman) in the top or bottom 10%', () => {
    const pages = [pg([para(['Text.']), para(['12'], 30)]), pg([para(['xiv'], 580), para(['More.'])]), pg([para(['42'])])]
    expect(texts(pages)).toEqual(['Text.', 'More.', '42'])
  })

  it('rejoins hyphenated line breaks: lowercase drops the hyphen, uppercase keeps it', () => {
    expect(texts([pg([para(['an exam-', 'ple of Jean-', 'Paul here.'])])])).toEqual(['an example of Jean-Paul here.'])
  })

  it('merges a paragraph that continues across a page break', () => {
    const pages = [pg([para(['First.']), para(['It was a dark'])]), pg([para(['and stormy night.']), para(['Next.'])])]
    expect(texts(pages)).toEqual(['First.', 'It was a dark and stormy night.', 'Next.'])
  })

  it('does not merge across a page break when the paragraph ended or the next starts uppercase', () => {
    expect(texts([pg([para(['Done.'])]), pg([para(['next one'])])])).toEqual(['Done.', 'next one'])
    expect(texts([pg([para(['no stop'])]), pg([para(['Capital start'])])])).toEqual(['no stop', 'Capital start'])
  })

  it('records the page a paragraph starts on', () => {
    expect(cleanPages([pg([para(['a.'])]), pg([para(['b.'])])]).map((b) => b.page)).toEqual([0, 1])
  })
})

describe('F-3 normalizeText', () => {
  it('normalizes to NFC and expands ligatures', () => {
    expect(normalizeText('Việt')).toBe('Việt')
    expect(normalizeText('Việt')).toHaveLength(4)
    expect(normalizeText('ﬁne ﬂow')).toBe('fine flow')
  })
})
