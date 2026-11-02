import { getDocument, type PDFDocumentLoadingTask, type PDFDocumentProxy } from 'pdfjs-dist'
import { ConvertError, MESSAGES } from './errors'
import type { OutlineEntry } from './structure'
import type { Page } from './types'

export interface LoadedPdf {
  pages: Page[]
  title?: string
  author?: string
  outline: OutlineEntry[] | null
}

async function open(task: PDFDocumentLoadingTask): Promise<PDFDocumentProxy> {
  try {
    return await task.promise
  } catch (e) {
    const name = (e as { name?: string }).name
    if (name === 'PasswordException') throw new ConvertError(MESSAGES.password)
    if (name === 'InvalidPDFException') throw new ConvertError(MESSAGES.invalid)
    throw e
  }
}

async function outline(pdf: PDFDocumentProxy): Promise<OutlineEntry[] | null> {
  const items = await pdf.getOutline()
  if (!items?.length) return null
  const out: OutlineEntry[] = []
  for (const item of items) {
    const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest
    const ref = dest?.[0]
    if (!ref) continue
    const page = typeof ref === 'number' ? ref : await pdf.getPageIndex(ref)
    out.push({ title: item.title, page })
  }
  return out.length ? out : null
}

export async function loadPdf(bytes: Uint8Array, onPage?: (page: number, total: number) => void): Promise<LoadedPdf> {
  // pdf.js transfers the buffer to its worker; pass a copy so callers keep theirs.
  const task = getDocument({ data: bytes.slice(), verbosity: 0 })
  try {
    const pdf = await open(task)
    const pages: Page[] = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      const { width, height } = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      const items = content.items.flatMap((i) =>
        'str' in i ? [{ str: i.str, x: i.transform[4], y: i.transform[5], width: i.width, height: i.height }] : [],
      )
      pages.push({ width, height, items })
      page.cleanup()
      onPage?.(n, pdf.numPages)
    }
    const meta = (await pdf.getMetadata()).info as { Title?: string; Author?: string }
    // The outline is optional: a malformed one should not sink the whole conversion.
    const toc = await outline(pdf).catch((e) => {
      console.warn('Ignoring unreadable PDF outline', e)
      return null
    })
    return { pages, title: meta.Title, author: meta.Author, outline: toc }
  } finally {
    await task.destroy()
  }
}
