import { GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { convert } from './convert'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type WorkerRequest = { bytes: Uint8Array; filename: string }
export type WorkerResponse =
  | { type: 'progress'; page: number; total: number }
  | { type: 'done'; epub: Uint8Array; title: string }
  | { type: 'error'; message: string }

const post = (msg: WorkerResponse, transfer: Transferable[] = []) => self.postMessage(msg, { transfer })

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  try {
    const { epub, title } = await convert(e.data.bytes, e.data.filename, (page, total) => post({ type: 'progress', page, total }))
    post({ type: 'done', epub, title }, [epub.buffer])
  } catch (err) {
    console.error(err)
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
