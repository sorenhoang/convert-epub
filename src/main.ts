import { sizeWarning } from './limits'
import type { WorkerRequest, WorkerResponse } from './worker'
import './style.css'

const input = document.querySelector<HTMLInputElement>('#file')!
const drop = document.querySelector<HTMLLabelElement>('#drop')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const warning = document.querySelector<HTMLParagraphElement>('#warning')!
const link = document.querySelector<HTMLAnchorElement>('#download')!
const preview = document.querySelector<HTMLAnchorElement>('#preview')!

let worker: Worker | undefined

async function start(file: File) {
  worker?.terminate()
  if (link.href) URL.revokeObjectURL(link.href)
  link.hidden = true
  preview.hidden = true
  warning.textContent = ''
  status.textContent = 'Reading PDF…'

  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker = w
  w.onerror = (e) => {
    console.error(e)
    status.textContent = 'Conversion failed. The PDF may be too large or damaged.'
    w.terminate()
  }
  w.onmessage = (e: MessageEvent<WorkerResponse>) => {
    // pdf.js can post its own messages through this worker scope; act only on ours.
    const msg = e.data
    if (msg?.type === 'progress') status.textContent = `Reading page ${msg.page} / ${msg.total}`
    else if (msg?.type === 'error') {
      status.textContent = msg.message
      w.terminate()
    }
    else if (msg?.type === 'done') {
      const blob = new Blob([msg.epub as BlobPart], { type: 'application/epub+zip' })
      link.href = URL.createObjectURL(blob)
      link.download = `${msg.title}.epub`
      link.textContent = `Download ${msg.title}.epub`
      link.hidden = false
      // Same core as the reader page: it fetches this blob URL, valid while this tab stays open.
      preview.href = `/reader.html?src=${encodeURIComponent(link.href)}`
      preview.hidden = false
      status.textContent = 'Done.'
      warning.textContent = sizeWarning(blob.size) ?? ''
      w.terminate()
    }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (worker !== w) return // another file was chosen while this one was being read
  w.postMessage({ bytes, filename: file.name } satisfies WorkerRequest, [bytes.buffer])
}

input.addEventListener('change', () => {
  const file = input.files?.[0]
  input.value = '' // allow re-choosing the same file
  if (file) start(file)
})
drop.addEventListener('dragover', (e) => {
  e.preventDefault()
  drop.classList.add('over')
})
drop.addEventListener('dragleave', () => drop.classList.remove('over'))
drop.addEventListener('drop', (e) => {
  e.preventDefault()
  drop.classList.remove('over')
  const file = e.dataTransfer?.files[0]
  if (file) start(file)
})
