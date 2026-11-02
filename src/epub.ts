import JSZip from 'jszip'
import type { Book } from './types'

// Characters outside the XML 1.0 Char production make the XHTML unparseable on readers.
const XML_ILLEGAL = /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu

const esc = (s: string) =>
  s.replace(XML_ILLEGAL, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const xhtml = (title: string, body: string, extraNs = '') => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"${extraNs}>
<head><meta charset="UTF-8"/><title>${esc(title)}</title><link rel="stylesheet" href="style.css"/></head>
<body>
${body}
</body>
</html>`

const CSS = 'body{margin:0 5%;line-height:1.5}h1,h2{text-align:center;page-break-before:always}p{text-indent:1.5em;margin:0 0 .3em}'

export async function writeEpub(book: Book): Promise<Uint8Array> {
  if (book.chapters.length === 0) throw new Error('book has no content')

  const zip = new JSZip()
  // EPUB OCF: mimetype must be the first entry and stored uncompressed.
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  )

  const chapters = book.chapters.map((c, i) => ({ ...c, file: `ch${String(i + 1).padStart(3, '0')}.xhtml` }))
  for (const c of chapters) {
    const body = c.blocks.map((b) => (b.kind === 'h' ? `<h2>${esc(b.text)}</h2>` : `<p>${esc(b.text)}</p>`)).join('\n')
    zip.file(`OEBPS/${c.file}`, xhtml(c.title, body || '<p></p>'))
  }

  const toc = chapters.map((c) => `<li><a href="${c.file}">${esc(c.title)}</a></li>`).join('\n')
  zip.file(
    'OEBPS/nav.xhtml',
    xhtml(book.title, `<nav epub:type="toc" id="toc"><h1>${esc(book.title)}</h1><ol>\n${toc}\n</ol></nav>`, ' xmlns:epub="http://www.idpf.org/2007/ops"'),
  )
  zip.file('OEBPS/style.css', CSS)

  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const manifest = chapters.map((c, i) => `<item id="c${i + 1}" href="${c.file}" media-type="application/xhtml+xml"/>`).join('\n')
  const spine = chapters.map((_, i) => `<itemref idref="c${i + 1}"/>`).join('\n')
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="en">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">urn:uuid:${crypto.randomUUID()}</dc:identifier>
<dc:title>${esc(book.title)}</dc:title>
<dc:creator>${esc(book.author)}</dc:creator>
<dc:language>en</dc:language>
<meta property="dcterms:modified">${modified}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="css" href="style.css" media-type="text/css"/>
${manifest}
</manifest>
<spine>
${spine}
</spine>
</package>`,
  )

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/epub+zip' })
}
