import type { PageParagraphs, Paragraph, TextBlock } from './types'

const REPEAT_SHARE = 0.5 // from design.md: repeats on > 50% of pages → running header/footer
const REPEAT_Y_TOLERANCE = 2 // pt
const MARGIN_BAND = 0.1 // top/bottom share of page height where page numbers live
const PAGE_NUMBER = /^(\d+|(?=[ivxlcdm])m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3}))$/i
const SAME_SIZE = 0.15 // relative size difference still treated as the same paragraph style
const TERMINAL = /[.!?…"”)]$/
const LOWER_START = /^\p{Ll}/u
const HYPHEN_END = /\p{L}-$/u

const LIGATURES: Record<string, string> = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' }

export const normalizeText = (s: string) => s.replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c]).normalize('NFC')

// Joins b onto a, rejoining a hyphenated break: "exam-"+"ple" → "example", "Jean-"+"Paul" → "Jean-Paul".
function join(a: string, b: string): string {
  if (!HYPHEN_END.test(a)) return `${a} ${b}`
  return LOWER_START.test(b) ? a.slice(0, -1) + b : a + b
}

function runningLines(pages: PageParagraphs[]): Set<string> {
  const seen = new Map<string, { page: number; y: number }[]>()
  pages.forEach((p, page) =>
    p.paragraphs.forEach((para) => {
      if (para.lines.length !== 1) return
      const key = para.lines[0]
      const hits = seen.get(key) ?? []
      hits.push({ page, y: para.y })
      seen.set(key, hits)
    }),
  )
  const out = new Set<string>()
  for (const [text, hits] of seen) {
    const ys = hits.map((h) => h.y).sort((a, b) => a - b)
    const mid = ys[Math.floor(ys.length / 2)]
    const pagesHit = new Set(hits.filter((h) => Math.abs(h.y - mid) <= REPEAT_Y_TOLERANCE).map((h) => h.page))
    if (pagesHit.size >= 2 && pagesHit.size > REPEAT_SHARE * pages.length) out.add(text)
  }
  return out
}

const isPageNumber = (p: Paragraph, height: number) =>
  p.lines.length === 1 &&
  PAGE_NUMBER.test(p.lines[0]) &&
  (p.y <= MARGIN_BAND * height || p.y >= (1 - MARGIN_BAND) * height)

export function cleanPages(pages: PageParagraphs[]): TextBlock[] {
  const normalized = pages.map((p) => ({
    ...p,
    paragraphs: p.paragraphs.map((para) => ({ ...para, lines: para.lines.map(normalizeText) })),
  }))
  const running = runningLines(normalized)
  const out: TextBlock[] = []
  normalized.forEach((p, page) => {
    const kept = p.paragraphs.filter(
      (para) => !(para.lines.length === 1 && running.has(para.lines[0])) && !isPageNumber(para, p.height),
    )
    kept.forEach((para, i) => {
      const text = para.lines.reduce(join)
      const last = out[out.length - 1]
      const continues =
        i === 0 &&
        last &&
        last.page < page &&
        Math.abs(last.size - para.size) / last.size <= SAME_SIZE &&
        !TERMINAL.test(last.text) &&
        LOWER_START.test(text)
      if (continues) last.text = join(last.text, text)
      else out.push({ text, size: para.size, page })
    })
  })
  return out
}
