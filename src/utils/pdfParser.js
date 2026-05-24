import { categorize } from './categorizer.js'

let pdfjsLib = null

async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib
  const mod = await import('pdfjs-dist')
  // Resolve worker URL relative to the loaded document so it works in both
  // dev (localhost) and production Electron (file://...asar/out/renderer/)
  const workerUrl = new URL('./pdf.worker.min.mjs', window.location.href).toString()
  mod.GlobalWorkerOptions.workerSrc = workerUrl
  pdfjsLib = mod
  return mod
}

// Reconstruct reading-order text from column-based PDFs (bank statements).
// Groups items by Y position, then sorts within each row by X — critical for
// tabular layouts where pdfjs returns items in column order instead of row order.
async function extractText(pdf) {
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    const rows = {}
    for (const item of content.items) {
      const str = item.str
      if (!str || !str.trim()) continue
      const y = Math.round(item.transform[5] / 4) * 4
      if (!rows[y]) rows[y] = []
      rows[y].push({ x: item.transform[4], text: str })
    }

    const sortedRows = Object.entries(rows)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.text).join(' '))

    fullText += sortedRows.join('\n') + '\n'
  }
  return fullText
}

export async function parsePDF(file) {
  const pdfjs = await getPdfjs()
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const text = await extractText(pdf)
  if (text.trim().length < 80) {
    throw new Error('IMAGE_BASED')
  }
  return parseTransactions(text)
}

export async function handleBuffer(buffer) {
  const pdfjs = await getPdfjs()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const text = await extractText(pdf)
  if (text.trim().length < 80) {
    throw new Error('IMAGE_BASED')
  }
  return parseTransactions(text)
}

// Anchored patterns applied per-line — no backtracking possible.
// Date at start, amount at end, merchant is everything in between.
const LEAD_DATE = /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+/
const POST_DATE = /^(\d{1,2}\/\d{1,2})\s+/
// Amount at end of line: optional sign (may have space after it, as BofA does: "- 408.08"),
// digits with optional commas, dot, 2 decimals, optional CR suffix.
// Capture group 1 = sign (may be undefined), group 2 = digits.
const TRAIL_AMT = /\s+([-+])?\s*([\d,]{1,10}\.\d{2})(?:\s*(?:CR|cr))?\s*$/
// BofA appends "REFNUM CARDLAST4" (two groups of 4 digits) before the amount
const BOA_REF_SUFFIX = /(\s+\d{4}){1,2}\s*$/
// Long pure-digit reference numbers embedded mid-description (9+ to preserve phone numbers)
const LONG_REF = /\b\d{9,}\b/g

function parseLine(line) {
  if (line.length < 10) return null

  // Must start with a date
  const dateM = LEAD_DATE.exec(line)
  if (!dateM) return null

  let rest = line.slice(dateM[0].length)
  const rawDate = dateM[1]

  // Skip optional posting date (Chase / BofA: "01/15 01/17 MERCHANT 25.00")
  const postM = POST_DATE.exec(rest)
  if (postM) rest = rest.slice(postM[0].length)

  // Amount must be at the end of the line
  const amtM = TRAIL_AMT.exec(rest)
  if (!amtM) return null

  // Skip payments/credits — BofA uses "- 408.08" (sign may be space-separated)
  if (amtM[1] === '-') return null

  const amount = parseFloat(amtM[2].replace(/,/g, ''))
  if (isNaN(amount) || amount <= 0 || amount > 50000) return null

  // Merchant is everything between the date(s) and the trailing amount
  let rawMerchant = rest.slice(0, rest.length - amtM[0].length).trim()
  if (!rawMerchant || rawMerchant.length < 2) return null

  // Must contain at least one letter (rules out pure-number header rows)
  if (!/[A-Za-z]/.test(rawMerchant)) return null

  // Strip BofA-style trailing reference digits: "MERCHANT CITY ST 9907 5378"
  rawMerchant = rawMerchant.replace(BOA_REF_SUFFIX, '').trim()

  // Strip any remaining long embedded reference numbers (9+ digits)
  const merchant = rawMerchant.replace(LONG_REF, '').replace(/\s+/g, ' ').trim()
  if (!merchant || merchant.length < 2) return null

  return { rawDate, merchant, amount }
}

function parseDate(raw) {
  const now = new Date()
  const year = now.getFullYear()
  const parts = raw.split('/')
  if (parts.length === 2) {
    return new Date(`${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`).toISOString()
  }
  if (parts.length === 3) {
    const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
    return new Date(`${y}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`).toISOString()
  }
  return now.toISOString()
}

function parseTransactions(text) {
  const seen = new Set()
  const results = []

  // One linear pass through lines — O(n), no backtracking
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    const tx = parseLine(line)
    if (!tx) continue

    const key = `${tx.rawDate}|${tx.merchant.toLowerCase()}|${tx.amount}`
    if (seen.has(key)) continue
    seen.add(key)

    results.push({
      id: `pdf_${Date.now()}_${results.length}`,
      date: parseDate(tx.rawDate),
      merchant: tx.merchant,
      amount: tx.amount,
      category: categorize(tx.merchant),
      source: 'pdf',
    })

    if (results.length >= 200) break
  }

  return results
}
