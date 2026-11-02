# ADR — PDF → EPUB converter for Kindle

## Problem

The user finds books online as PDF. Kindle renders PDF as fixed-page images: no reflow, no font resizing, unreadable on a 6" screen. They want a reflowable EPUB they can push via Send-to-Kindle (email / web / app), which has accepted EPUB natively since 2022 and converts it to KFX server-side.

The core question is "can it be frontend-only?" **Yes, for the conversion itself.** PDF parsing (pdf.js) and EPUB writing (zip of XHTML) both run in the browser. What cannot be FE-only is *delivering* to Kindle automatically (sending email needs a server); the user downloads the `.epub` and uses Send-to-Kindle themselves.

### Hidden constraints

- **PDF has no semantic structure.** It is positioned glyph runs. Paragraphs, headings, columns, running headers, footnotes and hyphenation all have to be *reconstructed by heuristics*. This is the whole difficulty; everything else is plumbing.
- **Scanned PDFs have no text layer.** They need OCR or must be rejected with a clear message.
- **Copyright / privacy.** Users will upload books they do not own the rights to redistribute. A client-side pipeline never uploads the file anywhere, which is both the simplest legal posture and the simplest architecture.
- **Kindle EPUB limits.** Send-to-Kindle: 50 MB per attachment by email, 200 MB via web/app. XHTML must be well-formed (escape `& < >`), EPUB 3 with a nav document.
- **Browser limits.** Large PDFs (500+ pages) need a Web Worker to keep the UI alive; pdf.js already runs its parser in a worker. Tesseract.js (WASM OCR) runs at ~2–5 s/page and downloads ~15 MB of language data per language.
- **Vietnamese text.** pdf.js returns Unicode; combining diacritics can come back decomposed. Normalize to NFC. Ligatures (ﬁ, ﬂ) also need normalizing.
- **Broken ToUnicode maps.** Some PDFs with subset fonts yield garbage text (private-use codepoints). Detect by ratio of non-printable chars and warn.

### Ambiguities (assumed, flag if wrong)

- Target is **personal use, one PDF at a time**, not a batch service.
- Input is mostly **single-column prose** (novels, non-fiction). Two-column academic papers and textbooks with heavy figures/tables are *best-effort*, not a goal.
- "FE-only" means **a static site with zero backend**, deployable to GitHub Pages / Vercel static.

## Approaches

### A. Frontend-only static web app (pdf.js → heuristics → JSZip)

**Summary.** One page: drop a PDF, get an EPUB. Everything runs in the browser.

**How it works.**
1. `pdfjs-dist` loads the PDF (its own worker). Per page, `getTextContent()` returns text items with position matrix, font size and font name; `getOutline()` gives bookmarks; `getMetadata()` gives title/author.
2. Pure TypeScript heuristics, in a Web Worker, turn items into a document model:
   - group items into lines by baseline y; lines into blocks by vertical gap / indent;
   - drop running headers/footers/page numbers: text at the same y that repeats on >50 % of pages, or is a bare number;
   - rejoin end-of-line hyphenation; merge blocks that continue across a page break;
   - classify headings by font size relative to body-mode size; map PDF outline to chapter splits when present;
   - NFC-normalize, replace ligatures, detect garbage-text ratio.
3. Emit EPUB 3 with `jszip`: `mimetype` (stored, first), `META-INF/container.xml`, `content.opf`, `nav.xhtml`, one XHTML per chapter, minimal CSS. Download via Blob URL.
4. Optional (phase 2): if a page has no text layer, run `tesseract.js` on the rendered canvas.

**Pros.** No server, no hosting cost, no upload of copyrighted files, works offline once loaded, trivially deployable. The heuristic core is pure functions → easy to TDD with JSON fixtures.
**Cons.** Heuristics will lose to Calibre on hard layouts (multi-column, tables, footnotes). Images/figures need extra work (pdf.js can render pages to canvas but extracting individual embedded images is fiddly). OCR in-browser is slow.
**Best when.** Personal tool, privacy matters, input is mostly prose. This matches the stated use.

### B. Thin frontend + backend wrapping Calibre `ebook-convert`

**Summary.** Same upload UI, but the file is POSTed to a Docker container running Calibre headless; `ebook-convert in.pdf out.epub --enable-heuristics` does the work.

**How it works.** Node/Kotlin API receives multipart upload, writes to a temp dir, shells out to `ebook-convert`, streams the EPUB back, deletes temp files. Could also email the result to the user's `@kindle.com` address (needs the sender to be on the user's approved list).

**Pros.** Calibre's PDF input is the most battle-tested open-source PDF→EPUB path (poppler + 15 years of heuristics). Can also do the Send-to-Kindle email step. Handles images.
**Cons.** Not FE-only. Hosting cost and cold starts (Calibre image is ~1 GB). You run a server that receives other people's copyrighted books. Upload limits, timeouts on big files, need auth/rate-limiting if public.
**Best when.** You need the best possible quality on messy PDFs, or want one-click delivery to Kindle, and are fine running infrastructure.

### C. No app: use Calibre locally (or Amazon's own converter)

**Summary.** Install Calibre; `ebook-convert book.pdf book.epub --enable-heuristics`, then Send-to-Kindle. Alternatively email the PDF to your Kindle address with subject `Convert` and Amazon reflows it (quality is poor but zero effort).

**Pros.** Zero code. Best quality available today.
**Cons.** Not a project. Calibre's GUI is heavy; on-the-go (phone) it doesn't work.
**Best when.** You just want the books on the Kindle this week. Honest baseline to compare A against: if A isn't noticeably more convenient than this, it shouldn't exist.

## Edge cases (any approach)

- Scanned / image-only PDF → detect (zero text items) and either OCR or fail with a message; never emit an empty EPUB.
- Encrypted / password PDF → reject with message.
- Running headers, footers, page numbers → must be stripped or every chapter is littered with them.
- End-of-line hyphenation → rejoin only when the joined word is not itself hyphenated (`self-\naware` stays `self-aware`; `exam-\nple` becomes `example`). Simple rule: join if the second fragment starts lowercase.
- Paragraph continuation across page breaks.
- Multi-column pages → at minimum detect (two x-clusters) and read column-by-column instead of interleaving lines.
- Headings vs. body: use the *mode* of font sizes as body size; larger = heading, don't trust absolute numbers.
- Garbage text from bad font encodings → warn user, don't silently produce junk.
- Missing metadata → title from first heading or filename; author "Unknown".
- Very large PDF → progress bar, worker, don't block the main thread; cap at Send-to-Kindle size and warn.
- XHTML well-formedness → escape text; EPUB fails to open on Kindle otherwise.
- Vietnamese diacritics → NFC normalize before output.

## Recommendation

**A — frontend-only static app.** The single most important reason: the user's own constraint ("can it only FE?") is satisfiable, and FE-only removes the hardest non-technical problem (hosting a server that receives copyrighted books) along with all hosting cost. Quality will be below Calibre on hard layouts, so scope v1 to single-column prose, make the heuristics pure functions tested against fixtures, and keep OCR and images as phase 2.

Suggested stack (lazy version): Vite + TypeScript, `pdfjs-dist`, `jszip`, Vitest for the heuristic core. React/Tailwind only if you want it to match your usual stack; a drop zone and a progress bar don't need it.

## Decision

**A — frontend-only static app.** User, 2026-11-02: "i prefer option A. please help me next phase /sr:plan".
UI framework was not specified; defaulting to plain TypeScript + Vite (no React) per the recommendation. Revisit if the user wants React.
(No `.sr/harness.json` in repo, so the `approve G1` hook was not run.)
