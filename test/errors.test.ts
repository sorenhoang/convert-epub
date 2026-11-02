import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assertDecodable, assertHasText, MESSAGES } from '../src/errors'
import { loadPdf } from '../src/pdf'
import { makePdf } from './fixtures/make-pdf'

const encrypted = new Uint8Array(readFileSync(new URL('./fixtures/encrypted.pdf', import.meta.url)))

describe('F-5 unconvertible input', () => {
  it('password-protected PDF → password message', async () => {
    await expect(loadPdf(encrypted)).rejects.toThrow('This PDF is password-protected')
  })

  it('PDF with no text on any page → scanned message', async () => {
    const pdf = await loadPdf(await makePdf({ pages: [[], []], noText: true }))
    expect(() => assertHasText(pdf.pages)).toThrow('This looks like a scanned PDF with no text layer')
  })

  it('PDF with text passes the scanned check', async () => {
    const pdf = await loadPdf(await makePdf({ pages: [['Hello there.']] }))
    expect(() => assertHasText(pdf.pages)).not.toThrow()
  })

  it('> 10% replacement / private-use / control characters → decode message', () => {
    const bad = 'abcdefgh' + '�' // 2 of 10 visible chars are garbage
    expect(() => assertDecodable(bad)).toThrow('Text in this PDF could not be decoded')
    expect(() => assertDecodable('Mostly fine text here\u0001')).not.toThrow()
    expect(() => assertDecodable('Tiếng Việt có dấu\n\tvà tab')).not.toThrow()
  })

  it('bytes that are not a PDF → invalid message', async () => {
    await expect(loadPdf(new TextEncoder().encode('hello, not a pdf'))).rejects.toThrow('Not a valid PDF file')
  })

  it('exposes the messages as constants', () => {
    expect(MESSAGES).toMatchObject({
      password: 'This PDF is password-protected',
      scanned: 'This looks like a scanned PDF with no text layer',
      garbage: 'Text in this PDF could not be decoded',
      invalid: 'Not a valid PDF file',
    })
  })
})
