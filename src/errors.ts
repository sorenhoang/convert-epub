import type { Page } from './types'

export const MESSAGES = {
  password: 'This PDF is password-protected',
  scanned: 'This looks like a scanned PDF with no text layer',
  garbage: 'Text in this PDF could not be decoded',
  invalid: 'Not a valid PDF file',
} as const

// ponytail: 10% is a guess (unverified in G2); tune against real books with broken ToUnicode maps.
const GARBAGE_SHARE = 0.1
const GARBAGE = /[�-]|[^\P{Cc}\t\n\r]/u

export class ConvertError extends Error {}

export function assertHasText(pages: Page[]): void {
  if (!pages.some((p) => p.items.some((i) => i.str.trim() !== ''))) throw new ConvertError(MESSAGES.scanned)
}

export function assertDecodable(text: string): void {
  let total = 0
  let bad = 0
  for (const c of text) {
    if (/\s/.test(c)) continue
    total++
    if (GARBAGE.test(c)) bad++
  }
  if (total > 0 && bad / total > GARBAGE_SHARE) throw new ConvertError(MESSAGES.garbage)
}
