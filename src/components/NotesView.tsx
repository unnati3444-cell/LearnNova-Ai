'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import LoadingScreen from '@/components/LoadingScreen'

// ── Types ─────────────────────────────────────────────────────────────────────
type BlockType = 'chapter' | 'subtopic' | 'important' | 'note' | 'definition' | 'keyterms' | 'paragraph'

type NoteBlock = {
  id: string
  type: BlockType
  content: string
  chapterId: string
}

type TocItem = {
  id: string
  label: string
  level: 'chapter' | 'subtopic'
}

type HighlightMap = Record<string, string> // blockId → colorId

// ── Constants ─────────────────────────────────────────────────────────────────
const HIGHLIGHT_COLORS = [
  { id: 'yellow', emoji: '🟡', bg: '#FFF9C4', border: '#F0D800' },
  { id: 'green',  emoji: '🟢', bg: '#DFFFD8', border: '#56C456' },
  { id: 'pink',   emoji: '🩷', bg: '#FFD6EC', border: '#E860A8' },
  { id: 'blue',   emoji: '🔵', bg: '#D4EEFF', border: '#60A8E8' },
  { id: 'orange', emoji: '🟠', bg: '#FFE8CC', border: '#E8A060' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function cleanHeading(text: string): string {
  return text
    .replace(/[📚📌⭐💡📝🔑]/g, '') // strip stray emojis Gemini adds
    .replace(/\*\*/g, '')            // strip ** bold markers
    .trim()
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

// ── Parser ────────────────────────────────────────────────────────────────────
function parseBlocks(content: string): NoteBlock[] {
  const blocks: NoteBlock[] = []
  let idx = 0
  let currentChapterId = 'c0'

  content.split('\n').forEach(line => {
    const t = line.trim()
    if (!t) return

    const id = `b${idx++}`

    if (t.startsWith('📚')) {
      currentChapterId = id
      blocks.push({ id, type: 'chapter', content: cleanHeading(t.replace(/^📚\s*/, '')), chapterId: id })
    } else if (t.startsWith('📌')) {
      blocks.push({ id, type: 'subtopic', content: cleanHeading(t.replace(/^📌\s*/, '')), chapterId: currentChapterId })
    } else if (t.startsWith('⭐')) {
      blocks.push({ id, type: 'important', content: t.replace(/^⭐\s*(Important:?\s*)?/i, '').trim(), chapterId: currentChapterId })
    } else if (t.startsWith('💡')) {
      blocks.push({ id, type: 'note', content: t.replace(/^💡\s*(Note:?\s*)?/i, '').trim(), chapterId: currentChapterId })
    } else if (t.startsWith('📝')) {
      blocks.push({ id, type: 'definition', content: t.replace(/^📝\s*(Definition:?\s*)?/i, '').trim(), chapterId: currentChapterId })
    } else if (t.startsWith('🔑')) {
      blocks.push({ id, type: 'keyterms', content: t.replace(/^🔑\s*(Key Terms:?\s*)?/i, '').trim(), chapterId: currentChapterId })
    } else {
      blocks.push({ id, type: 'paragraph', content: t, chapterId: currentChapterId })
    }
  })

  return blocks
}

function buildToc(blocks: NoteBlock[]): TocItem[] {
  return blocks
    .filter(b => b.type === 'chapter' || b.type === 'subtopic')
    .map(b => ({ id: b.id, label: b.content, level: b.type as 'chapter' | 'subtopic' }))
}

// ── Block renderer ────────────────────────────────────────────────────────────
function renderBlock(block: NoteBlock, hlColor: string | undefined, activeColor: string, onToggle: (id: string) => void) {
  const hl = HIGHLIGHT_COLORS.find(c => c.id === hlColor)
  const active = HIGHLIGHT_COLORS.find(c => c.id === activeColor)!

  const clickStyle: React.CSSProperties = {
    cursor: 'pointer',
    borderRadius: 6,
    transition: 'background 0.12s',
  }

  const hlStyle: React.CSSProperties = hl
    ? { background: hl.bg, border: `1px solid ${hl.border}`, borderRadius: 6, padding: '4px 8px' }
    : {}

  const hoverIn = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hl) e.currentTarget.style.background = '#F5EFE6'
  }
  const hoverOut = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hl) e.currentTarget.style.background = 'transparent'
  }

  if (block.type === 'chapter') {
    return (
      <div
        id={block.id} key={block.id}
        onClick={() => onToggle(block.id)}
        onMouseEnter={hoverIn} onMouseLeave={hoverOut}
        style={{ ...clickStyle, ...hlStyle, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, marginTop: 28, padding: hl ? '6px 10px' : '6px 0' }}
      >
        <span style={{ fontSize: 18 }}>📚</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#3A2E22', letterSpacing: '-0.01em' }}>{block.content}</span>
      </div>
    )
  }

  if (block.type === 'subtopic') {
    return (
      <div
        id={block.id} key={block.id}
        onClick={() => onToggle(block.id)}
        onMouseEnter={hoverIn} onMouseLeave={hoverOut}
        style={{ ...clickStyle, ...hlStyle, display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, marginTop: 16, padding: hl ? '5px 8px' : '4px 0' }}
      >
        <span style={{ fontSize: 15 }}>📌</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#A8693F' }}>{block.content}</span>
      </div>
    )
  }

  if (block.type === 'important') {
    return (
      <div
        key={block.id}
        onClick={() => onToggle(block.id)}
        onMouseEnter={hoverIn} onMouseLeave={hoverOut}
        style={{ ...clickStyle, display: 'flex', gap: 8, padding: '8px 12px', marginBottom: 6, borderLeft: '3px solid #E8A060', background: hl ? hl.bg : '#FFF5EC', borderRadius: '0 8px 8px 0', border: hl ? `1px solid ${hl.border}` : undefined, borderLeftColor: '#E8A060' }}
      >
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⭐</span>
        <span style={{ fontSize: 13, color: '#3A2E22', lineHeight: 1.65, fontWeight: 500 }}><strong style={{ color: '#C2562F' }}>Important: </strong>{renderInline(block.content)}</span>
      </div>
    )
  }

  if (block.type === 'note') {
    return (
      <div
        key={block.id}
        onClick={() => onToggle(block.id)}
        onMouseEnter={hoverIn} onMouseLeave={hoverOut}
        style={{ ...clickStyle, display: 'flex', gap: 8, padding: '8px 12px', marginBottom: 6, background: hl ? hl.bg : '#F0F8FF', borderRadius: 8, border: hl ? `1px solid ${hl.border}` : '1px solid #B8D8F0' }}
      >
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
        <span style={{ fontSize: 13, color: '#3A2E22', lineHeight: 1.65 }}><strong style={{ color: '#2C6E8C' }}>Note: </strong>{renderInline(block.content)}</span>
      </div>
    )
  }

  if (block.type === 'definition') {
    return (
      <div
        key={block.id}
        onClick={() => onToggle(block.id)}
        onMouseEnter={hoverIn} onMouseLeave={hoverOut}
        style={{ ...clickStyle, display: 'flex', gap: 8, padding: '8px 12px', marginBottom: 6, background: hl ? hl.bg : '#F0FFF4', borderRadius: 8, border: hl ? `1px solid ${hl.border}` : '1px solid #90D8A0' }}
      >
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>📝</span>
        <span style={{ fontSize: 13, color: '#3A2E22', lineHeight: 1.65 }}><strong style={{ color: '#3D6B3D' }}>Definition: </strong>{renderInline(block.content)}</span>
      </div>
    )
  }

  if (block.type === 'keyterms') {
    return (
      <div
        key={block.id}
        onClick={() => onToggle(block.id)}
        onMouseEnter={hoverIn} onMouseLeave={hoverOut}
        style={{ ...clickStyle, display: 'flex', gap: 8, padding: '8px 12px', marginBottom: 6, background: hl ? hl.bg : '#FAF0FF', borderRadius: 8, border: hl ? `1px solid ${hl.border}` : '1px solid #C8A0E0' }}
      >
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>🔑</span>
        <span style={{ fontSize: 13, color: '#3A2E22', lineHeight: 1.65 }}><strong style={{ color: '#5C4A8C' }}>Key Terms: </strong>{renderInline(block.content)}</span>
      </div>
    )
  }

  // paragraph
  return (
    <div
      key={block.id}
      onClick={() => onToggle(block.id)}
      onMouseEnter={hoverIn} onMouseLeave={hoverOut}
      style={{ ...clickStyle, ...hlStyle, padding: hl ? '5px 8px' : '3px 8px', marginBottom: 5, fontSize: 13, color: '#3A2E22', lineHeight: 1.75 }}
    >
      {renderInline(block.content)}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  content: string
  projectId: string
  projectName: string
  isDemo: boolean
  loading: boolean
  error: string
  focus: string
  onFocusChange: (v: string) => void
  onRegenerate: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NotesView({ content, projectId, projectName, isDemo, loading, error, focus, onFocusChange, onRegenerate }: Props) {
  const [highlights, setHighlights] = useState<HighlightMap>({})
  const [activeColor, setActiveColor] = useState('yellow')
  const [showFocus, setShowFocus] = useState(false)
  const [copied, setCopied] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const blocks = parseBlocks(content)
  const toc = buildToc(blocks)

  // Load highlights from Supabase
  useEffect(() => {
    if (!content || isDemo) return
    supabase.from('notes').select('highlights').eq('project_id', projectId).single()
      .then(({ data }) => {
        if (data?.highlights && typeof data.highlights === 'object')
          setHighlights(data.highlights as HighlightMap)
      })
  }, [content, projectId, isDemo])

  async function saveHighlights(next: HighlightMap) {
    if (isDemo) return
    await supabase.from('notes').update({ highlights: next }).eq('project_id', projectId)
  }

  function toggleHighlight(blockId: string) {
    setHighlights(prev => {
      const next = { ...prev }
      if (next[blockId] === activeColor) {
        delete next[blockId] // click same color → remove
      } else {
        next[blockId] = activeColor
      }
      saveHighlights(next)
      return next
    })
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function copyAll() {
    const plain = content.replace(/📚|📌|⭐|💡|📝|🔑/g, '').replace(/^\s+/gm, '')
    navigator.clipboard.writeText(plain)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function downloadTxt() {
    const plain = content.replace(/📚|📌|⭐|💡|📝|🔑/g, '')
    const blob = new Blob([plain], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${projectName}-notes.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function downloadPdf() {
    const win = window.open('', '_blank')
    if (!win) return
    const body = blocks.map(b => {
      if (b.type === 'chapter')   return `<h1>📚 ${b.content}</h1>`
      if (b.type === 'subtopic')  return `<h2>📌 ${b.content}</h2>`
      if (b.type === 'important') return `<div class="important">⭐ <strong>Important:</strong> ${b.content}</div>`
      if (b.type === 'note')      return `<div class="note">💡 <strong>Note:</strong> ${b.content}</div>`
      if (b.type === 'definition')return `<div class="definition">📝 <strong>Definition:</strong> ${b.content}</div>`
      if (b.type === 'keyterms')  return `<div class="keyterms">🔑 <strong>Key Terms:</strong> ${b.content}</div>`
      return `<p>${b.content}</p>`
    }).join('\n')

    win.document.write(`<!DOCTYPE html><html><head><title>${projectName} — Notes</title>
      <style>
        body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 24px;color:#3A2E22;line-height:1.8;font-size:14px}
        h1{font-size:20px;color:#3A2E22;border-bottom:2px solid #DFD2BC;padding-bottom:8px;margin-top:32px}
        h2{font-size:16px;color:#A8693F;margin-top:20px}
        p{margin:6px 0}
        .important{background:#FFF5EC;border-left:3px solid #E8A060;padding:8px 12px;border-radius:0 6px 6px 0;margin:6px 0}
        .note{background:#F0F8FF;border:1px solid #B8D8F0;padding:8px 12px;border-radius:6px;margin:6px 0}
        .definition{background:#F0FFF4;border:1px solid #90D8A0;padding:8px 12px;border-radius:6px;margin:6px 0}
        .keyterms{background:#FAF0FF;border:1px solid #C8A0E0;padding:8px 12px;border-radius:6px;margin:6px 0}
        @media print{body{margin:20px}}
      </style></head>
      <body><h1 style="font-size:24px;color:#A8693F">${projectName} — Notes</h1>${body}</body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }

  const btnStyle = (accent = false, active = false): React.CSSProperties => ({
    background: accent ? '#A8693F' : active ? '#F5E8C8' : 'transparent',
    color: accent ? 'white' : active ? '#9C7A1F' : '#7A6B57',
    border: accent ? 'none' : '1px solid #C9B896',
    borderRadius: 8, padding: '7px 11px', fontSize: 12,
    fontWeight: accent ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0,
  })

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!content && !loading) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div style={{ fontSize: 36 }}>📓</div>
      <div style={{ fontWeight: 600, color: '#7A6B57', fontSize: 14 }}>Generate Detailed Notes</div>
      <div style={{ fontSize: 12, color: '#A8997E', maxWidth: 300, textAlign: 'center' }}>
        Full explanations of every concept, structured like a textbook chapter with definitions, key terms, and important points.
      </div>
      {showFocus && (
        <textarea autoFocus value={focus} onChange={e => onFocusChange(e.target.value)}
          placeholder="e.g. 'Focus only on Chapter 3' or 'Cover all philosophers in detail'"
          rows={3}
          style={{ width: 320, background: '#F5EFE6', border: '1px solid #DFD2BC', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#3A2E22', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
        />
      )}
      {error && <div style={{ fontSize: 12, color: '#A8453F' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setShowFocus(v => !v)} style={btnStyle(false, showFocus)}>🎯 {showFocus ? 'Hide Focus' : 'Add Focus'}</button>
        <button onClick={onRegenerate} style={btnStyle(true)}>Generate Notes</button>
      </div>
    </div>
  )

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen tool="notes" />

  // ── Content state ────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid #DFD2BC', background: '#FFFEFB', flexShrink: 0 }}>

        {/* Highlighter palette */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F5EFE6', borderRadius: 8, padding: '4px 8px', border: '1px solid #DFD2BC' }}>
          <span style={{ fontSize: 10, color: '#A8997E', marginRight: 2 }}>🖊</span>
          {HIGHLIGHT_COLORS.map(c => (
            <button key={c.id} onClick={() => setActiveColor(c.id)} title={c.id}
              style={{ fontSize: 14, background: 'transparent', border: activeColor === c.id ? '2px solid #3A2E22' : '2px solid transparent', borderRadius: 4, cursor: 'pointer', padding: '0 2px', lineHeight: 1, opacity: activeColor === c.id ? 1 : 0.6 }}>
              {c.emoji}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 10, color: '#A8997E' }}>Click any block to highlight</div>

        {showFocus && (
          <input autoFocus value={focus} onChange={e => onFocusChange(e.target.value)}
            placeholder="Focus on specific topics before regenerating…"
            style={{ flex: 1, minWidth: 180, background: '#F5EFE6', border: '1px solid #DFD2BC', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#3A2E22', outline: 'none' }}
          />
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setShowFocus(v => !v)} style={btnStyle(false, showFocus)}>🎯 Focus</button>
          <button onClick={copyAll} style={btnStyle()}>{copied ? '✓ Copied' : '📋 Copy'}</button>
          <button onClick={downloadTxt} style={btnStyle()}>⬇ .txt</button>
          <button onClick={downloadPdf} style={btnStyle()}>⬇ PDF</button>
          <button onClick={onRegenerate} style={btnStyle()}>↻ Regenerate</button>
        </div>
      </div>

      {/* TOC + Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* TOC sidebar — 2-level */}
        <div style={{ width: 210, borderRight: '1px solid #DFD2BC', overflowY: 'auto', flexShrink: 0, background: '#FFFEFB', padding: '12px 0' }}>
          <div style={{ fontSize: 10, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 14px 8px' }}>
            {toc.filter(t => t.level === 'chapter').length} Chapters
          </div>
          {toc.map(item => (
            <div key={item.id} onClick={() => scrollTo(item.id)}
              style={{ padding: item.level === 'chapter' ? '6px 14px' : '4px 14px 4px 26px', fontSize: item.level === 'chapter' ? 12 : 11, fontWeight: item.level === 'chapter' ? 600 : 400, color: item.level === 'chapter' ? '#3A2E22' : '#7A6B57', cursor: 'pointer', lineHeight: 1.4, borderRadius: 6, margin: '0 6px 1px', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0E8DC')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {item.level === 'chapter' ? '📚 ' : '📌 '}{item.label}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {blocks.map(block => (
            <div key={block.id}>
              {renderBlock(block, highlights[block.id], activeColor, toggleHighlight)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}