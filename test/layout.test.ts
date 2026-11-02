import { describe, expect, it } from 'vitest'
import { layoutPage } from '../src/layout'
import type { Page, TextItem } from '../src/types'

const it_ = (str: string, x: number, y: number, size = 11, width = str.length * size * 0.5): TextItem => ({ str, x, y, width, height: size })
const page = (items: TextItem[]): Page => ({ width: 400, height: 600, items })
const texts = (p: Page) => layoutPage(p).map((para) => para.lines.join(' | '))

describe('F-2 layoutPage', () => {
  it('ignores empty items and zero-height items', () => {
    const items = [{ ...it_('', 50, 500), height: 0 }, it_('Hello', 50, 500), { ...it_('ghost', 50, 300), height: 0 }]
    expect(texts(page(items))).toEqual(['Hello'])
  })

  it('joins items on the same baseline (±0.5 × size) into one line, ordered by x', () => {
    const items = [it_('world', 100, 500.4), it_('Hello', 50, 500)]
    expect(texts(page(items))).toEqual(['Hello world'])
  })

  it('keeps lines 14pt apart at 11pt in one paragraph, splits at a gap ≥ 1.5 × median spacing', () => {
    const items = [
      it_('first line', 50, 500), it_('second line', 50, 486), it_('third line', 50, 472),
      it_('new para', 50, 444), it_('more', 50, 430),
    ]
    expect(texts(page(items))).toEqual(['first line | second line | third line', 'new para | more'])
  })

  it('starts a new paragraph on a line indented ≥ 1 × font size', () => {
    const items = [it_('end of para.', 50, 500), it_('Indented start', 62, 486), it_('continues', 50, 472)]
    expect(texts(page(items))).toEqual(['end of para.', 'Indented start | continues'])
  })

  it('reads a two-column page left column first', () => {
    const items: TextItem[] = []
    for (let i = 0; i < 4; i++) {
      items.push(it_(`L${i}`, 30, 500 - i * 14, 11, 150))
      items.push(it_(`R${i}`, 220, 500 - i * 14, 11, 150))
    }
    expect(texts(page(items))).toEqual(['L0 | L1 | L2 | L3', 'R0 | R1 | R2 | R3'])
  })
})
