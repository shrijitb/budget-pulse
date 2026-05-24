import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { parsePDF } from '../utils/pdfParser'
import { useStore } from '../store/useStore'
import { CATEGORY_META } from '../utils/categorizer'

const CATEGORIES = Object.entries(CATEGORY_META).map(([id, meta]) => ({ id, ...meta }))

export default function PDFImporter({ onClose }) {
  const { dispatch } = useStore()
  const [phase, setPhase] = useState('drop') // drop | parsing | review | done
  const [txs, setTxs] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [error, setError] = useState(null)
  const [editCat, setEditCat] = useState({}) // txId -> category override
  const fileRef = useRef()

  useEffect(() => {
    if (!window.electronAPI) return
    // Main process parses the PDF and sends back transactions (or an error string)
    window.electronAPI.onPdfDetected(({ txs, error, path }) => {
      setError(null)
      if (error) {
        const name = path ? path.split('/').pop() : 'PDF'
        if (error === 'IMAGE_BASED') {
          setError('This PDF appears to be image-based (scanned). Please download your statement from your bank\'s website — choose the digital/text PDF option, not a scanned copy.')
        } else {
          setError(`Could not parse ${name}: ${error}`)
        }
        setPhase('drop')
        return
      }
      if (!txs || txs.length === 0) {
        const name = path ? path.split('/').pop() : 'the file'
        setError(`No transactions found in ${name}. Make sure it's a credit card or bank statement.`)
        setPhase('drop')
        return
      }
      setTxs(txs)
      setSelected(new Set(txs.map(t => t.id)))
      setPhase('review')
    })
    return () => window.electronAPI.offPdfDetected()
  }, [])

  async function handleFile(file) {
    if (!file || !file.name.endsWith('.pdf')) {
      setError('Please upload a PDF file.')
      return
    }
    setPhase('parsing')
    setError(null)
    try {
      const parsed = await parsePDF(file)
      if (parsed.length === 0) {
        setError('No transactions found. Try a different statement format.')
        setPhase('drop')
        return
      }
      setTxs(parsed)
      setSelected(new Set(parsed.map(t => t.id)))
      setPhase('review')
    } catch (e) {
      console.error('[PDFImporter] parse error:', e)
      if (e.message === 'IMAGE_BASED') {
        setError('This PDF is image-based (scanned). Download your statement from your bank\'s website as a digital PDF — Bank of America: Accounts → Statements & Documents → choose PDF.')
      } else {
        setError(`Could not parse this PDF: ${e.message || 'unknown error'}. Try a different statement format.`)
      }
      setPhase('drop')
    }
  }

  function onDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  function toggleTx(id) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function setCat(id, cat) {
    setEditCat(prev => ({ ...prev, [id]: cat }))
  }

  function importSelected() {
    const toImport = txs
      .filter(t => selected.has(t.id))
      .map(t => ({ ...t, category: editCat[t.id] || t.category }))
    dispatch({ type: 'IMPORT_TRANSACTIONS', txs: toImport })
    setPhase('done')
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-[480px] mx-auto rounded-t-2xl flex flex-col"
        style={{
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          maxHeight: '88vh',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-lg font-bold text-[var(--color-text-bright)]">Import PDF Statement</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <AnimatePresence mode="wait">
            {phase === 'drop' && (
              <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div
                  onDrop={onDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileRef.current.click()}
                  className="border-2 border-dashed rounded-2xl flex flex-col items-center justify-center py-16 gap-3 cursor-pointer transition-all"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <span className="text-5xl">📄</span>
                  <p className="font-semibold text-[var(--color-text-bright)]">Drop your statement here</p>
                  <p className="text-sm text-[var(--color-text-muted)]">or tap to select a PDF</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-2 px-6 text-center">
                    Works with Bank of America, Chase, Amex, Citi, and most digital bank statements
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => handleFile(e.target.files[0])}
                />
                {error && <p className="mt-3 text-sm text-[var(--color-red)] text-center">{error}</p>}
              </motion.div>
            )}

            {phase === 'parsing' && (
              <motion.div key="parsing" className="flex flex-col items-center justify-center py-20 gap-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div
                  className="w-12 h-12 rounded-full border-2 border-t-transparent"
                  style={{ borderColor: 'var(--color-accent)' }}
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                />
                <p className="text-[var(--color-text-muted)]">Parsing your statement…</p>
              </motion.div>
            )}

            {phase === 'review' && (
              <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-sm text-[var(--color-text-muted)] mb-3">
                  Found {txs.length} transactions. Tap to toggle, tap the category to change it.
                </p>
                <div className="space-y-2 mb-4">
                  {txs.map(tx => {
                    const cat = editCat[tx.id] || tx.category
                    const meta = CATEGORY_META[cat] || { icon: '💸', color: '#7c6af7' }
                    const isOn = selected.has(tx.id)
                    return (
                      <div
                        key={tx.id}
                        className="rounded-xl px-4 py-3 flex items-center gap-3 transition-all"
                        style={{
                          background: isOn ? 'var(--color-surface-3)' : 'var(--color-surface)',
                          opacity: isOn ? 1 : 0.4,
                          border: `1px solid ${isOn ? 'var(--color-border)' : 'transparent'}`,
                        }}
                      >
                        <button onClick={() => toggleTx(tx.id)} className="shrink-0">
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center text-xs"
                            style={{
                              background: isOn ? 'var(--color-accent)' : 'var(--color-surface-2)',
                              border: `1px solid ${isOn ? 'var(--color-accent)' : 'var(--color-border)'}`,
                            }}
                          >
                            {isOn && '✓'}
                          </div>
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--color-text)] truncate">{tx.merchant}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{new Date(tx.date).toLocaleDateString()}</p>
                        </div>
                        <select
                          value={cat}
                          onChange={e => setCat(tx.id, e.target.value)}
                          className="text-xs rounded-lg px-2 py-1 shrink-0"
                          style={{ background: 'var(--color-surface-2)', color: meta.color, border: `1px solid ${meta.color}40` }}
                          onClick={e => e.stopPropagation()}
                        >
                          {CATEGORIES.map(c => (
                            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                          ))}
                        </select>
                        <span className="text-sm font-semibold text-[var(--color-text-bright)] shrink-0">
                          ${tx.amount.toFixed(2)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={importSelected}
                  disabled={selected.size === 0}
                  className="btn-primary w-full disabled:opacity-40"
                >
                  Import {selected.size} transaction{selected.size !== 1 ? 's' : ''}
                </button>
              </motion.div>
            )}

            {phase === 'done' && (
              <motion.div key="done" className="flex flex-col items-center justify-center py-16 gap-4 text-center"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <span className="text-6xl">✅</span>
                <p className="text-xl font-bold text-[var(--color-text-bright)]">Imported!</p>
                <p className="text-[var(--color-text-muted)] text-sm">Transactions added to your dashboard.</p>
                <button onClick={onClose} className="btn-primary px-8 mt-2">Done</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
