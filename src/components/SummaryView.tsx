'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import LoadingScreen from '@/components/LoadingScreen'

// ── Types ─────────────────────────────────────────────────────────────────────
type Section = { id: string; heading: string; bullets: string[] }
type HighlightMap = Record<string, string> // bulletKey → colorId

const HIGHLIGHT_COLORS = [
  { id: 'yellow', bg: '#FFF9C4', border: '#F0D800', dot: '#F0D800' },
  { id: 'green',  bg: '#DFFFD8', border: '#56C456', dot: '#56C456' },
  { id: 'pink',   bg: '#FFD6EC', border: '#E860A8', dot: '#E860A8' },
  { id: 'blue',   bg: '#D4EEFF', border: '#60A8E8', dot: '#60A8E8' },
  { id: 'orange', bg: '#FFE8CC', border: '#E8A060', dot: '#E8A060' },
]

// ── Parser ────────────────────────────────────────────────────────────────────
function parseSections(content: string): Section[] {
  const sections: Section[] = []
  let current: Section | null = null
  let idx = 0

  content.split('\n').forEach(line => {
    const t = line.trim()
    const hm = t.match(/^\*\*([^*]+)\*\*$/)
    if (hm) {
      if (current) sections.push(current)
      current = { id: `s${idx++}`, heading: hm[1], bullets: [] }
    } else if ((t.startsWith('- ') || t.startsWith('• ')) && current) {
      current.bullets.push(t.replace(/^[-•]\s+/, ''))
    } else if (t && current) {
      current.bullets.push(t)
    }
  })
  if (current) sections.push(current)
  return sections
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

// ── Floating toolbar ───────────────────────────────────────────────────────────
function FloatingToolbar({ onHighlight, onCopy, currentColor, visible }: {
  onHighlight: (colorId: string) => void
  onCopy: () => void
  currentColor: string | undefined
  visible: boolean
}) {
  if (!visible) return null
  return (
    <div style={{
      position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
      display: 'flex', alignItems: 'center', gap: 3,
      background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 8,
      padding: '3px 6px', boxShadow: '0 2px 8px rgba(58,46,34,0.12)',
      zIndex: 10, whiteSpace: 'nowrap',
    }}>
      {HIGHLIGHT_COLORS.map(c => (
        <button key={c.id} onClick={(e) => { e.stopPropagation(); onHighlight(c.id) }}
          title={c.id}
          style={{
            width: 14, height: 14, borderRadius: '50%', background: c.dot, border: currentColor === c.id ? '2px solid #3A2E22' : '2px solid transparent',
            cursor: 'pointer', padding: 0, flexShrink: 0,
          }}
        />
      ))}
      <div style={{ width: 1, height: 12, background: '#DFD2BC', margin: '0 2px' }} />
      <button onClick={(e) => { e.stopPropagation(); onCopy() }}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, padding: '0 2px', color: '#7A6B57', lineHeight: 1 }}
        title="Copy"
      >📋</button>
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
export default function SummaryView({ content, projectId, projectName, isDemo, loading, error, focus, onFocusChange, onRegenerate }: Props) {
  const [highlights, setHighlights] = useState<HighlightMap>({})
  const [showFocus, setShowFocus] = useState(false)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const sections = parseSections(content)

  // Load highlights
  useEffect(() => {
    if (!content || isDemo) return
    supabase.from('summaries').select('highlights').eq('project_id', projectId).single()
      .then(({ data }) => {
        if (data?.highlights && typeof data.highlights === 'object')
          setHighlights(data.highlights as HighlightMap)
      })
  }, [content, projectId, isDemo])

  async function saveHighlights(next: HighlightMap) {
    if (isDemo) return
    await supabase.from('summaries').update({ highlights: next }).eq('project_id', projectId)
  }

  function toggleHighlight(key: string, colorId: string) {
    setHighlights(prev => {
      const next = { ...prev }
      if (next[key] === colorId) delete next[key]
      else next[key] = colorId
      saveHighlights(next)
      return next
    })
  }

  function copyBullet(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  function copySection(section: Section) {
    const text = `${section.heading}\n${section.bullets.map(b => `- ${b}`).join('\n')}`
    navigator.clipboard.writeText(text)
    setCopiedKey(`section-${section.id}`)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function downloadTxt() {
    const plain = content.replace(/\*\*/g, '')
    const blob = new Blob([plain], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${projectName}-summary.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function downloadPdf() {
    const win = window.open('', '_blank')
    if (!win) return
    const body = sections.map(s => `
      <div class="section">
        <h2>${s.heading}</h2>
        <ul>${s.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
      </div>`).join('')
    win.document.write(`<!DOCTYPE html><html><head><title>${projectName} — Summary</title>
      <style>
        body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 24px;color:#3A2E22;line-height:1.75;font-size:14px}
        h1{font-size:22px;color:#A8693F;border-bottom:2px solid #DFD2BC;padding-bottom:10px;margin-bottom:28px}
        .section{margin-bottom:22px;page-break-inside:avoid}
        h2{font-size:14px;font-weight:700;color:#A8693F;margin:0 0 6px}
        ul{margin:0;padding-left:20px}li{margin-bottom:4px}
        @media print{body{margin:20px}}
      </style></head>
      <body><h1>${projectName} — Summary</h1>${body}</body></html>`)
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

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (!content && !loading) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div style={{ fontSize: 36 }}>📝</div>
      <div style={{ fontWeight: 600, color: '#7A6B57', fontSize: 14 }}>Generate a Summary</div>
      <div style={{ fontSize: 12, color: '#A8997E', maxWidth: 300, textAlign: 'center' }}>
        Concise exam-ready bullet notes from your selected sources. Saved automatically.
      </div>
      {showFocus && (
        <textarea autoFocus value={focus} onChange={e => onFocusChange(e.target.value)}
          placeholder="e.g. 'Focus only on Chapter 3' or 'Emphasise definitions and formulas'"
          rows={3}
          style={{ width: 320, background: '#F5EFE6', border: '1px solid #DFD2BC', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#3A2E22', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
        />
      )}
      {error && <div style={{ fontSize: 12, color: '#A8453F' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setShowFocus(v => !v)} style={btnStyle(false, showFocus)}>🎯 {showFocus ? 'Hide Focus' : 'Add Focus'}</button>
        <button onClick={onRegenerate} style={btnStyle(true)}>Generate Summary</button>
      </div>
    </div>
  )

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen tool="summary" />

  // ── Content ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid #DFD2BC', background: '#FFFEFB', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: '#A8997E' }}>💡 Hover any bullet to <strong style={{ color: '#9C7A1F' }}>highlight</strong> or <strong style={{ color: '#7A6B57' }}>copy</strong></div>
        {showFocus && (
          <input autoFocus value={focus} onChange={e => onFocusChange(e.target.value)}
            placeholder="Focus on specific topics before regenerating…"
            style={{ flex: 1, minWidth: 180, background: '#F5EFE6', border: '1px solid #DFD2BC', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#3A2E22', outline: 'none' }}
          />
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setShowFocus(v => !v)} style={btnStyle(false, showFocus)}>🎯 Focus</button>
          <button onClick={downloadTxt} style={btnStyle()}>⬇ .txt</button>
          <button onClick={downloadPdf} style={btnStyle()}>⬇ PDF</button>
          <button onClick={onRegenerate} style={btnStyle()}>↻ Regenerate</button>
        </div>
      </div>

      {/* TOC + Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* TOC */}
        <div style={{ width: 196, borderRight: '1px solid #DFD2BC', overflowY: 'auto', flexShrink: 0, background: '#FFFEFB', padding: '12px 0' }}>
          <div style={{ fontSize: 10, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 14px 8px' }}>
            {sections.length} Sections
          </div>
          {sections.map(s => (
            <div key={s.id} onClick={() => scrollTo(s.id)}
              style={{ padding: '5px 14px', fontSize: 11, color: '#5C4A3A', cursor: 'pointer', lineHeight: 1.45, borderRadius: 6, margin: '0 6px 1px' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0E8DC')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {s.heading}
            </div>
          ))}
        </div>

        {/* Main */}
        <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {sections.map(s => (
            <div key={s.id} id={s.id} style={{ marginBottom: 26 }}>

              {/* Section heading with hover copy */}
              <div
                style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #EDE3D3' }}
                onMouseEnter={() => setHoveredSection(s.id)}
                onMouseLeave={() => setHoveredSection(null)}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: '#A8693F', flex: 1 }}>{s.heading}</div>
                {hoveredSection === s.id && (
                  <button onClick={() => copySection(s)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: copiedKey === `section-${s.id}` ? '#3D6B3D' : '#A8997E', padding: '2px 6px', flexShrink: 0 }}>
                    {copiedKey === `section-${s.id}` ? '✓ Copied' : '📋 Copy section'}
                  </button>
                )}
              </div>

              {/* Bullets */}
              {s.bullets.map((bullet, bi) => {
                const key = `${s.id}-${bi}`
                const hl = HIGHLIGHT_COLORS.find(c => c.id === highlights[key])
                const isHovered = hoveredKey === key
                return (
                  <div key={bi}
                    style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 8px', borderRadius: 6, marginBottom: 3, background: hl ? hl.bg : isHovered ? '#F5EFE6' : 'transparent', border: hl ? `1px solid ${hl.border}` : '1px solid transparent', transition: 'background 0.1s', paddingRight: isHovered ? 120 : 8 }}
                    onMouseEnter={() => setHoveredKey(key)}
                    onMouseLeave={() => setHoveredKey(null)}
                  >
                    <span style={{ color: '#A8693F', fontSize: 12, marginTop: 3, flexShrink: 0 }}>•</span>
                    <span style={{ fontSize: 13, color: '#3A2E22', lineHeight: 1.65, flex: 1 }}>{renderInline(bullet)}</span>

                    {/* Floating toolbar on hover */}
                    <FloatingToolbar
                      visible={isHovered}
                      currentColor={highlights[key]}
                      onHighlight={(colorId) => toggleHighlight(key, colorId)}
                      onCopy={() => copyBullet(bullet, key)}
                    />
                    {copiedKey === key && (
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#3D6B3D', background: '#DFFFD8', borderRadius: 4, padding: '2px 6px' }}>✓ Copied</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}