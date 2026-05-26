import { categorize } from './categorizer.js'

// Reconstruct reading-order text from column-based PDFs (bank statements).
// Groups items by Y position, then sorts within each row by X — critical for
// tabular layouts where pdfjs returns items in column order instead of row order.
// Exported so the main process can reuse this with its own pdfjs instance.
export async function extractText(pdf) {
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

// Browser-side entry point: delegates all parsing to the main process via IPC.
// The main process runs pdfjs without a web worker, which is dramatically faster.
export async function parsePDF(file) {
  const buffer = await file.arrayBuffer()
  return window.electronAPI.parsePdf(buffer)
}

// ── Merchant name cleanup ────────────────────────────────────────────────────
// BoA appends payment-processor domains, order refs, phone numbers, and the
// state code to merchant descriptions. Strip them so the display name is clean.
const _ORDER_REF     = /\*[A-Z0-9]{4,}/g
// All-caps .COM domains appended by BoA (GETSQUIRE.COMNY, ANTHROPIC.COMCA).
// Intentionally excludes mixed-case brands like "CLAUDE.AI".
const _APPENDED_COM  = /\b[A-Z0-9]{2,}\.COM[A-Z]{0,2}\b/g
// Mixed-case URL paths pasted after the merchant (Amzn.com/billWA).
const _URL_PATH      = /\b[A-Za-z0-9]+\.(?:com|net|org|io)\/\S*/gi
// Phone numbers: 703-3767036 | 844-646-2746 | 888 432-3299
const _PHONE         = /\b\d{3}[\s-]\d{3,7}(?:-\d{4})?\b/g
// Trailing US state code — explicit list so "CO" (Company) is never stripped.
const _TRAIL_STATE   = /\s+(?:AL|AK|AZ|AR|CA|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s*$/

function cleanMerchant(raw) {
  return raw
    .replace(_ORDER_REF, '')
    .replace(_APPENDED_COM, '')
    .replace(_URL_PATH, '')
    .replace(_PHONE, '')
    .replace(_TRAIL_STATE, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── Line-by-line transaction parser ─────────────────────────────────────────
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

export function parseTransactions(text) {
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

    const merchant = cleanMerchant(tx.merchant)
    results.push({
      id: `pdf_${Date.now()}_${results.length}`,
      date: parseDate(tx.rawDate),
      merchant,
      amount: tx.amount,
      category: categorize(merchant),
      source: 'pdf',
    })

    if (results.length >= 200) break
  }

  return results
}
