import type { Block, Book, Chapter, TextBlock } from './types'

const HEADING_RATIO = 1.3 // × body size
const HEADING_MAX_WORDS = 15
const SIZE_STEP = 0.5 // pt; sizes are bucketed so 11.0 and 11.02 count as the same

export interface Meta {
  title?: string
  author?: string
  filename: string
}

export interface OutlineEntry {
  title: string
  page: number
}

const bucket = (size: number) => Math.round(size / SIZE_STEP) * SIZE_STEP

function bodySize(blocks: TextBlock[]): number {
  const chars = new Map<number, number>()
  for (const b of blocks) chars.set(bucket(b.size), (chars.get(bucket(b.size)) ?? 0) + b.text.length)
  return [...chars].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
}

export function buildBook(blocks: TextBlock[], meta: Meta, outline: OutlineEntry[] | null): Book {
  const title = meta.title?.trim() || meta.filename.replace(/\.pdf$/i, '')
  const author = meta.author?.trim() || 'Unknown'
  const body = bodySize(blocks)
  const isHeading = (b: TextBlock) => b.size >= HEADING_RATIO * body && b.text.split(/\s+/).length <= HEADING_MAX_WORDS
  const toBlock = (b: TextBlock): Block => ({ kind: isHeading(b) ? 'h' : 'p', text: b.text })

  let chapters: Chapter[]
  if (outline?.length) {
    const entries = [...outline].sort((a, b) => a.page - b.page)
    chapters = entries.map((e, i) => ({
      title: e.title.trim() || `Chapter ${i + 1}`,
      // blocks before the first outline entry belong to the first chapter
      blocks: blocks
        .filter((b) => (i === 0 || b.page >= e.page) && (i === entries.length - 1 || b.page < entries[i + 1].page))
        .map(toBlock),
    }))
  } else {
    // Split at the largest heading size that recurs, so a one-off title page doesn't hide the chapters.
    const counts = new Map<number, number>()
    for (const b of blocks.filter(isHeading)) counts.set(bucket(b.size), (counts.get(bucket(b.size)) ?? 0) + 1)
    const sizes = [...counts.keys()].sort((a, b) => b - a)
    const top = sizes.find((s) => (counts.get(s) ?? 0) >= 2) ?? sizes[0] ?? 0
    chapters = []
    for (const b of blocks) {
      const splits = top > 0 && isHeading(b) && bucket(b.size) === top
      if (splits || chapters.length === 0) chapters.push({ title: splits ? b.text : title, blocks: [] })
      chapters[chapters.length - 1].blocks.push(toBlock(b))
    }
  }
  return { title, author, chapters: chapters.filter((c) => c.blocks.length > 0) }
}
