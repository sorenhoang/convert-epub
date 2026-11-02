import { PDFDocument, PDFName, PDFNumber, PDFString, StandardFonts, type PDFRef } from 'pdf-lib'

export interface FixtureOptions {
  title?: string
  author?: string
  pages: string[][] // per page: lines of body text; a line starting with '# ' is drawn as a 20pt heading
  runningHeader?: string
  pageNumbers?: boolean
  outline?: { title: string; page: number }[]
  noText?: boolean // draw only shapes: simulates a scanned PDF
}

const W = 400
const H = 600
const LEADING = 14
const BODY = 11

export async function makePdf(o: FixtureOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.TimesRoman)
  if (o.title) doc.setTitle(o.title)
  if (o.author) doc.setAuthor(o.author)
  o.pages.forEach((lines, i) => {
    const page = doc.addPage([W, H])
    if (o.noText) {
      page.drawRectangle({ x: 50, y: 100, width: 300, height: 400 })
      return
    }
    if (o.runningHeader) page.drawText(o.runningHeader, { x: 50, y: 570, size: 9, font })
    if (o.pageNumbers) page.drawText(String(i + 1), { x: 195, y: 30, size: 9, font })
    let y = 530
    for (const line of lines) {
      if (line.startsWith('# ')) {
        y -= 10
        page.drawText(line.slice(2), { x: 50, y, size: 20, font })
        y -= 34
      } else if (line === '') {
        y -= LEADING // blank line → paragraph gap
      } else {
        page.drawText(line, { x: 50, y, size: BODY, font })
        y -= LEADING
      }
    }
  })
  if (o.outline?.length) addOutline(doc, o.outline)
  return doc.save()
}

function addOutline(doc: PDFDocument, entries: { title: string; page: number }[]) {
  const ctx = doc.context
  const outlinesRef = ctx.nextRef()
  const refs: PDFRef[] = entries.map(() => ctx.nextRef())
  entries.forEach((e, i) => {
    const dict = ctx.obj({
      Title: PDFString.of(e.title),
      Parent: outlinesRef,
      Dest: ctx.obj([doc.getPage(e.page).ref, PDFName.of('XYZ'), null, null, null]),
    })
    if (i > 0) dict.set(PDFName.of('Prev'), refs[i - 1])
    if (i < entries.length - 1) dict.set(PDFName.of('Next'), refs[i + 1])
    ctx.assign(refs[i], dict)
  })
  ctx.assign(
    outlinesRef,
    ctx.obj({ Type: 'Outlines', First: refs[0], Last: refs[refs.length - 1], Count: PDFNumber.of(entries.length) }),
  )
  doc.catalog.set(PDFName.of('Outlines'), outlinesRef)
}
