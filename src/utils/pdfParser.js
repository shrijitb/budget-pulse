import { categorize } from './categorizer.js'

let pdfjsLib = null

async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib
  const mod = await import('pdfjs-dist')
  mod.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs'
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

// Patterns for common credit card statement formats
const TX_PATTERNS = [
  // Chase / BofA: "01/15 01/17 MERCHANT NAME 123.45"
  /(\d{2}\/\d{2})\s+\d{2}\/\d{2}\s+([A-Za-z][^\d\n$]{2,45?}?)\s+([\d,]+\.\d{2})(?:\s|$)/g,
  // Amex: "01/15/2024 MERCHANT NAME $123.45"
  /(\d{2}\/\d{2}\/\d{4})\s+([A-Za-z][^\d$\n]{2,45?}?)\s+\$?([\d,]+\.\d{2})(?:\s|$)/g,
  // BofA single-date: "01/15 MERCHANT NAME 123.45"
  /(\d{2}\/\d{2})\s+([A-Za-z][A-Za-z0-9 &'.,*#-]{2,45?}?)\s+([\d,]+\.\d{2})(?:\s|$)/g,
  // Generic with optional $: date merchant amount
  /(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+([A-Za-z][^$\d\n]{3,45?}?)\s+\$?\s*([\d,]+\.\d{2})(?:\s|$)/g,
]

function parseDate(raw) {
  const now = new Date()
  const year = now.getFullYear()
  const cleaned = raw.replace(/-/g, '/')
  const parts = cleaned.split('/')
  if (parts.length === 2) return new Date(`${year}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`).toISOString()
  if (parts.length === 3) {
    const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
    return new Date(`${y}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`).toISOString()
  }
  return now.toISOString()
}

function parseTransactions(text) {
  const seen = new Set()
  const results = []

  for (const pattern of TX_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      const [, rawDate, merchant, rawAmount] = match
      const amount = parseFloat(rawAmount.replace(/,/g, ''))
      if (isNaN(amount) || amount <= 0 || amount > 50000) continue
      const name = merchant.trim().replace(/\s+/g, ' ')
      if (name.length < 3) continue

      const key = `${rawDate}|${name.toLowerCase()}|${amount}`
      if (seen.has(key)) continue
      seen.add(key)

      results.push({
        id: `pdf_${Date.now()}_${results.length}`,
        date: parseDate(rawDate),
        merchant: name,
        amount,
        category: categorize(name),
        source: 'pdf',
      })
    }
  }

  return results.slice(0, 200)
}
