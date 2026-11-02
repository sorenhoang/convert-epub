import type { Line, Page, Paragraph, TextItem } from './types'

// Heuristic thresholds, all relative to font size or page metrics.
const SAME_LINE = 0.5 // baseline tolerance, × font size
const WORD_GAP = 0.2 // gap between items that implies a space, × font size
const PARA_GAP = 1.5 // vertical gap that starts a paragraph, × typical line spacing
// Typical spacing = lower quartile of same-size line steps. The median fails on block-paragraph
// layouts, where blank-line gaps can outnumber in-paragraph steps on a page.
const SPACING_QUANTILE = 0.25
const INDENT = 1 // first-line indent that starts a paragraph, × font size
const SIZE_CHANGE = 0.15 // relative size change that starts a paragraph (heading → body)
const COLUMN_SHARE = 0.3 // each column must hold this share of lines to count as two-column

interface RawLine extends Line {
  end: number
}

function toLines(items: TextItem[]): RawLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const groups: TextItem[][] = []
  for (const item of sorted) {
    const g = groups[groups.length - 1]
    if (g && Math.abs(g[0].y - item.y) <= SAME_LINE * Math.max(g[0].height, item.height)) g.push(item)
    else groups.push([item])
  }
  return groups.map((g) => {
    g.sort((a, b) => a.x - b.x)
    let text = ''
    let end = g[0].x
    for (const i of g) {
      if (text && i.x - end > WORD_GAP * i.height && !text.endsWith(' ')) text += ' '
      text += i.str
      end = Math.max(end, i.x + i.width)
    }
    return { text: text.replace(/\s+/g, ' ').trim(), x: g[0].x, y: g[0].y, size: Math.max(...g.map((i) => i.height)), end }
  })
}

// ponytail: splits at the page midpoint only; pages with 3+ columns or uneven gutters read interleaved.
function columns(items: TextItem[], width: number): TextItem[][] {
  const mid = width / 2
  const left = items.filter((i) => i.x + i.width <= mid)
  const right = items.filter((i) => i.x >= mid)
  const isTwoCol =
    left.length >= COLUMN_SHARE * items.length &&
    right.length >= COLUMN_SHARE * items.length &&
    left.length + right.length === items.length
  return isTwoCol ? [left, right] : [items]
}

// Most common x among lines: the body's left edge, robust to a single outlier line.
function leftEdge(lines: RawLine[]): number {
  const counts = new Map<number, number>()
  for (const l of lines) counts.set(Math.round(l.x), (counts.get(Math.round(l.x)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
}

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length * q)] : 0
}

function paragraphs(lines: RawLine[]): Paragraph[] {
  if (lines.length === 0) return []
  // Spacing per font size: headings have their own leading, so body spacing must not judge them.
  const steps = new Map<number, number[]>()
  lines.slice(1).forEach((l, i) => {
    if (l.size !== lines[i].size || lines[i].y <= l.y) return
    const s = steps.get(l.size) ?? []
    s.push(lines[i].y - l.y)
    steps.set(l.size, s)
  })
  const spacing = new Map([...steps].map(([size, s]) => [size, quantile(s, SPACING_QUANTILE)]))
  const edge = leftEdge(lines)
  const out: Paragraph[] = []
  let prev: RawLine | undefined
  for (const l of lines) {
    const cur = out[out.length - 1]
    const startsNew =
      !cur ||
      !prev ||
      prev.y - l.y >= PARA_GAP * (spacing.get(l.size) ?? Infinity) ||
      l.x - edge >= INDENT * l.size ||
      Math.abs(l.size - cur.size) / cur.size > SIZE_CHANGE
    if (startsNew) out.push({ lines: [l.text], size: l.size, y: l.y })
    else cur.lines.push(l.text)
    prev = l
  }
  return out
}

export function layoutPage(page: Page): Paragraph[] {
  const items = page.items.filter((i) => i.str.trim() !== '' && i.height > 0)
  return columns(items, page.width).map(toLines).flatMap(paragraphs)
}
