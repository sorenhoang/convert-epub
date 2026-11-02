// Minimal typing for the parts of foliate-js (no bundled types) this app uses.
declare module 'foliate-js/view.js' {
  export interface TocItem {
    label: string
    href: string
    subitems?: TocItem[] | null
  }
  export interface FoliateBook {
    metadata?: { title?: string | Record<string, string> }
    toc?: TocItem[] | null
  }
  export interface RelocateDetail {
    fraction?: number
    tocItem?: { label?: string; href?: string }
  }
  export class View extends HTMLElement {
    book: FoliateBook
    open(file: File | Blob | string): Promise<void>
    init(opts: { lastLocation?: string; showTextStart?: boolean }): Promise<void>
    goTo(href: string): Promise<unknown>
    next(): Promise<void>
    prev(): Promise<void>
    close(): void
  }
}
