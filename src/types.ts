// Raw text run from pdf.js, normalized to plain data so heuristics are testable without pdf.js.
export interface TextItem {
  str: string
  x: number
  y: number // baseline, PDF units, origin bottom-left
  width: number
  height: number // ≈ font size
}

export interface Page {
  width: number
  height: number
  items: TextItem[]
}

export interface Line {
  text: string
  x: number
  y: number
  size: number
}

export interface Paragraph {
  lines: string[] // kept separate so cleanup can rejoin hyphenated line breaks
  size: number
  y: number // baseline of first line
}

export interface PageParagraphs {
  height: number
  paragraphs: Paragraph[]
}

export type Block = { kind: 'p' | 'h'; text: string }

export interface Chapter {
  title: string
  blocks: Block[]
}

export interface Book {
  title: string
  author: string
  chapters: Chapter[]
}

export interface TextBlock {
  text: string
  size: number
  page: number // 0-based index of the page the paragraph starts on
}
