import { cleanPages } from './cleanup'
import { writeEpub } from './epub'
import { assertDecodable, assertHasText, ConvertError, MESSAGES } from './errors'
import { layoutPage } from './layout'
import { loadPdf } from './pdf'
import { buildBook } from './structure'

export interface Converted {
  epub: Uint8Array
  title: string
}

export async function convert(
  bytes: Uint8Array,
  filename: string,
  onProgress?: (page: number, total: number) => void,
): Promise<Converted> {
  const pdf = await loadPdf(bytes, onProgress)
  assertHasText(pdf.pages)
  const blocks = cleanPages(pdf.pages.map((p) => ({ height: p.height, paragraphs: layoutPage(p) })))
  // Text that was all running stamps ("Scanned by …") is gone after cleanup: still a scanned PDF.
  if (blocks.length === 0) throw new ConvertError(MESSAGES.scanned)
  assertDecodable(blocks.map((b) => b.text).join('\n'))
  const book = buildBook(blocks, { title: pdf.title, author: pdf.author, filename }, pdf.outline)
  return { epub: await writeEpub(book), title: book.title }
}
