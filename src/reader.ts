import { isOwnBlobUrl, openBook, READER_MESSAGES, ReaderError, type OpenedBook } from './reader-core'
import './style.css'

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
const input = $<HTMLInputElement>('#open')
const title = $<HTMLHeadingElement>('#title')
const toc = $<HTMLSelectElement>('#toc')
const location = $<HTMLSpanElement>('#location')
const status = $<HTMLParagraphElement>('#status')
const host = $<HTMLElement>('#book')

let book: OpenedBook | undefined
// The paginator drops a navigation that starts while a page turn is still animating; queue them.
let queue: Promise<unknown> = Promise.resolve()
const nav = (go: (b: OpenedBook) => Promise<unknown>) => {
  queue = queue.then(() => (book ? go(book) : undefined)).catch((e) => console.error(e))
}

async function show(file: File) {
  status.textContent = 'Opening…'
  try {
    book = await openBook(host, file, (d) => {
      location.textContent = d.tocItem?.label?.trim() ?? ''
      const current = book?.toc.findIndex((t) => t.href === d.tocItem?.href) ?? -1
      if (current >= 0) toc.selectedIndex = current
    })
  } catch (e) {
    book = undefined
    status.textContent = e instanceof ReaderError ? e.message : 'Could not open this book'
    if (!(e instanceof ReaderError)) console.error(e)
    return
  }
  status.textContent = ''
  title.textContent = book.title
  document.title = `${book.title} · Reader`
  toc.replaceChildren(...book.toc.map((t) => new Option(t.label, t.href)))
}

input.addEventListener('change', () => {
  const file = input.files?.[0]
  input.value = ''
  if (file) show(file)
})
toc.addEventListener('change', () => {
  const href = toc.value // capture now: a late relocate can reset the select before the queued jump runs
  nav((b) => b.goTo(href))
})
$('#prev').addEventListener('click', () => nav((b) => b.prev()))
$('#next').addEventListener('click', () => nav((b) => b.next()))
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
  if (e.key === 'ArrowLeft') nav((b) => b.prev())
  if (e.key === 'ArrowRight') nav((b) => b.next())
})

const src = new URLSearchParams(window.location.search).get('src')
if (src) {
  if (!isOwnBlobUrl(src, window.location.origin)) status.textContent = READER_MESSAGES.foreignSrc
  else
    fetch(src)
      .then((r) => r.blob())
      .then((b) => show(new File([b], 'book.epub', { type: 'application/epub+zip' })))
      .catch((e) => {
        console.error(e)
        status.textContent = 'This preview has expired. Convert the PDF again.'
      })
}
