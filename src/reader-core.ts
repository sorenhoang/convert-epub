import type { RelocateDetail, TocItem, View } from 'foliate-js/view.js'
import 'foliate-js/view.js'

export const READER_MESSAGES = {
  invalid: 'Not a valid EPUB file',
  foreignSrc: 'Can only preview files converted on this site',
} as const

export interface TocEntry {
  label: string
  href: string
}

export interface OpenedBook {
  title: string
  toc: TocEntry[]
  next(): Promise<void>
  prev(): Promise<void>
  goTo(href: string): Promise<unknown>
}

export class ReaderError extends Error {}

// Preview hands the converted EPUB over as a blob URL; anything else could pull a book from elsewhere.
export function isOwnBlobUrl(src: string, origin: string): boolean {
  return src.startsWith(`blob:${origin}/`)
}

const titleOf = (t: string | Record<string, string> | undefined) =>
  (typeof t === 'string' ? t : t ? Object.values(t)[0] : '')?.trim() || 'Untitled'

// foliate-js uses null (not undefined) for entries without sub-items.
const flatten = (items: TocItem[] | null | undefined): TocEntry[] =>
  (items ?? []).flatMap((i) => [{ label: i.label.trim(), href: i.href }, ...flatten(i.subitems)])

export async function openBook(host: HTMLElement, file: File, onLocation: (detail: RelocateDetail) => void): Promise<OpenedBook> {
  host.querySelector('foliate-view')?.remove()
  const view = document.createElement('foliate-view') as View
  host.append(view)
  try {
    await view.open(file)
  } catch (e) {
    console.error(e)
    view.remove()
    throw new ReaderError(READER_MESSAGES.invalid)
  }
  view.addEventListener('relocate', (e) => onLocation((e as CustomEvent<RelocateDetail>).detail))
  await view.init({ showTextStart: false })
  return {
    title: titleOf(view.book.metadata?.title),
    toc: flatten(view.book.toc),
    next: () => view.next(),
    prev: () => view.prev(),
    goTo: (href) => view.goTo(href),
  }
}
