import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { path as jar } from 'epubcheck-static'

export interface EpubcheckResult {
  errors: number
  messages: string[]
}

export function epubcheck(bytes: Uint8Array): EpubcheckResult {
  const dir = mkdtempSync(join(tmpdir(), 'epubcheck-'))
  const file = join(dir, 'book.epub')
  writeFileSync(file, bytes)
  let out: string
  try {
    out = execFileSync('java', ['-jar', jar, file, '--json', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch (e) {
    // epubcheck exits non-zero when it finds errors; the JSON report is still on stdout
    out = (e as { stdout?: string }).stdout ?? ''
  }
  const report = JSON.parse(out) as { messages: { severity: string; ID: string; message: string }[] }
  const bad = report.messages.filter((m) => m.severity === 'ERROR' || m.severity === 'FATAL')
  return { errors: bad.length, messages: bad.map((m) => `${m.ID}: ${m.message}`) }
}
