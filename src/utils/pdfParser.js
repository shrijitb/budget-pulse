import { categorize } from './categorizer.js'

let pdfjsLib = null

async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib
  const mod = await import('pdfjs-dist')
  mod.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs'
  pdfjsLib = mod
  return mod
}

async function extractText(pdf) {
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map(item => item.str).join(' ') + '\n'
  }
  return fullText
}

export async function parsePDF(file) {
  const pdfjs = await getPdfjs()
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  return parseTransactions(await extractText(pdf))
}

export async function handleBuffer(buffer) {
  const pdfjs = await getPdfjs()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  return parseTransactions(await extractText(pdf))
}

// Patterns for common credit card statement formats
const TX_PATTERNS = [
  // Chase: "01/15 01/17 MERCHANT NAME 123.45"
  /(\d{2}\/\d{2})\s+\d{2}\/\d{2}\s+([A-Z][^\d]{3,40?})\s+([\d,]+\.\d{2})/g,
  // Amex: "01/15/2024 MERCHANT NAME $123.45"
  /(\d{2}\/\d{2}\/\d{4})\s+([A-Z][^\d$]{3,40?})\s+\$?([\d,]+\.\d{2})/g,
  // Generic: date merchant amount
  /(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+([A-Za-z][^$\d\n]{4,45?}?)\s+\$?\s*([\d,]+\.\d{2})/g,
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

      const key = `${rawDate}|${name}|${amount}`
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

  // Deduplicate further by proximity
  return results.slice(0, 200)
}
