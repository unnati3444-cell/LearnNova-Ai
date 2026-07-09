'use client'
import { useState, useEffect, useCallback } from 'react'
import LoadingScreen from '@/components/LoadingScreen'

type Card = { id: string; front: string; back: string }

type Props = {
  projectId: string
  isDemo: boolean
  loading: boolean
  error: string
  cards: Card[]
  knownIds: Set<string>
  cardCount: number
  onCardCountChange: (n: number) => void
  onGenerate: () => void
  onMarkKnown: (id: string) => void
  onMarkUnknown: (id: string) => void
}

function FlipCard({ card, isFlipped, onClick }: { card: Card; isFlipped: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ width: '100%', maxWidth: 560, height: 280, perspective: 1200, cursor: 'pointer', userSelect: 'none' }}
    >
      <div style={{
        width: '100%', height: '100%', position: 'relative',
        transformStyle: 'preserve-3d',
        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* FRONT */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          background: '#FFFEFB', border: '2px solid #DFD2BC', borderRadius: 18,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '28px 32px',
          boxShadow: '0 4px 24px rgba(58,46,34,0.10)',
        }}>
          <div style={{ fontSize: 11, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18, fontWeight: 600 }}>
            Question / Term
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#3A2E22', textAlign: 'center', lineHeight: 1.5 }}>
            {card.front}
          </div>
          <div style={{ position: 'absolute', bottom: 16, fontSize: 11, color: '#C9B896' }}>
            click to reveal answer
          </div>
        </div>

        {/* BACK */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: '#F5EFE6', border: '2px solid #A8693F', borderRadius: 18,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '28px 32px',
          boxShadow: '0 4px 24px rgba(58,46,34,0.10)',
        }}>
          <div style={{ fontSize: 11, color: '#A8693F', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18, fontWeight: 600 }}>
            Answer
          </div>
          <div style={{ fontSize: 15, color: '#3A2E22', textAlign: 'center', lineHeight: 1.7 }}>
            {card.back}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FlashcardsView({
  projectId, isDemo, loading, error,
  cards, knownIds, cardCount,
  onCardCountChange, onGenerate, onMarkKnown, onMarkUnknown,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped]       = useState(false)
  const [showComplete, setShowComplete] = useState(false)

  const currentCard  = cards[currentIndex]
  const unknownCards = cards.filter(c => !knownIds.has(c.id))
  const knownCount   = knownIds.size
  const totalCount   = cards.length
  const progressPct  = totalCount > 0 ? Math.round((knownCount / totalCount) * 100) : 0

  useEffect(() => {
    if (cards.length > 0 && knownIds.size === cards.length) setShowComplete(true)
    else setShowComplete(false)
  }, [knownIds, cards])

  useEffect(() => { setIsFlipped(false) }, [currentIndex])

  function goNext() {
    setIsFlipped(false)
    setTimeout(() => setCurrentIndex(i => Math.min(i + 1, cards.length - 1)), isFlipped ? 180 : 0)
  }

  function goPrev() {
    setIsFlipped(false)
    setTimeout(() => setCurrentIndex(i => Math.max(i - 1, 0)), isFlipped ? 180 : 0)
  }

  function handleMarkKnown() {
    if (!currentCard) return
    onMarkKnown(currentCard.id)
    if (currentIndex < cards.length - 1) goNext()
  }

  function handleMarkUnknown() {
    if (!currentCard) return
    onMarkUnknown(currentCard.id)
    if (currentIndex < cards.length - 1) goNext()
  }

  function jumpToCard(cardId: string) {
    const idx = cards.findIndex(c => c.id === cardId)
    if (idx !== -1) { setIsFlipped(false); setCurrentIndex(idx) }
  }

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!cards.length) return
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setIsFlipped(v => !v) }
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev() }
    if (e.key === 'k' || e.key === 'K') handleMarkKnown()
    if (e.key === 'u' || e.key === 'U') handleMarkUnknown()
  }, [cards, currentIndex, isFlipped])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const btnStyle = (accent = false, danger = false, success = false): React.CSSProperties => ({
    background: accent ? '#A8693F' : danger ? '#FFF0F0' : success ? '#F0FFF4' : 'transparent',
    color: accent ? 'white' : danger ? '#C0392B' : success ? '#27AE60' : '#7A6B57',
    border: accent ? 'none' : danger ? '1.5px solid #E8A0A0' : success ? '1.5px solid #90D8A0' : '1px solid #C9B896',
    borderRadius: 10, padding: '10px 20px', fontSize: 13,
    fontWeight: accent || danger || success ? 700 : 400,
    cursor: 'pointer', flexShrink: 0,
  })

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!cards.length && !loading) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 40 }}>🃏</div>
      <div style={{ fontWeight: 700, color: '#3A2E22', fontSize: 15 }}>Generate Flashcards</div>
      <div style={{ fontSize: 13, color: '#A8997E', maxWidth: 300, textAlign: 'center' }}>
        AI-generated question & answer cards from your selected sources. Mark what you know, focus on what you don't.
      </div>
      {/* Card count picker in empty state */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <span style={{ fontSize: 13, color: '#7A6B57' }}>How many cards?</span>
        {[10, 20, 30].map(n => (
          <button key={n} onClick={() => onCardCountChange(n)} style={{
            width: 44, height: 36, borderRadius: 8,
            border: cardCount === n ? '2px solid #A8693F' : '1px solid #C9B896',
            background: cardCount === n ? '#F5E8D8' : 'transparent',
            color: cardCount === n ? '#A8693F' : '#7A6B57',
            fontWeight: cardCount === n ? 700 : 400,
            fontSize: 14, cursor: 'pointer',
          }}>{n}</button>
        ))}
      </div>
      {error && <div style={{ fontSize: 12, color: '#A8453F' }}>{error}</div>}
      <button onClick={onGenerate} style={{ ...btnStyle(true), padding: '11px 28px', fontSize: 14 }}>
        Generate {cardCount} Flashcards
      </button>
    </div>
  )

  if (loading) return <LoadingScreen tool="flashcards" />

  // ── Completion screen ────────────────────────────────────────────────────────
  if (showComplete) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🎉</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#3A2E22' }}>You know all {totalCount} cards!</div>
      <div style={{ fontSize: 13, color: '#7A6B57' }}>Great work. Ready for another round?</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={() => { cards.forEach(c => onMarkUnknown(c.id)); setCurrentIndex(0); setShowComplete(false) }} style={btnStyle()}>
          ↻ Review All Again
        </button>
        <button onClick={onGenerate} style={btnStyle(true)}>✦ Generate New Deck</button>
      </div>
    </div>
  )

  // ── Main card view ───────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Top bar — progress only, no card count picker */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid #DFD2BC', background: '#FFFEFB', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onGenerate} style={{ background: 'transparent', border: '1px solid #C9B896', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#7A6B57', cursor: 'pointer' }}>
            ↻ New Deck
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: '#EDE3D3', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, background: '#56C456', width: `${progressPct}%`, transition: 'width 0.4s ease' }} />
            </div>
            <span style={{ fontSize: 12, color: '#7A6B57', whiteSpace: 'nowrap', fontWeight: 600 }}>
              {knownCount}/{totalCount} known
            </span>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '20px 24px', overflowY: 'auto' }}>
        <div style={{ fontSize: 12, color: '#A8997E', fontWeight: 600 }}>
          Card {currentIndex + 1} of {totalCount}
          {knownIds.has(currentCard?.id) && <span style={{ marginLeft: 8, color: '#27AE60', fontWeight: 700 }}>✓ Known</span>}
        </div>

        {currentCard && <FlipCard card={currentCard} isFlipped={isFlipped} onClick={() => setIsFlipped(v => !v)} />}

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={goPrev} disabled={currentIndex === 0} style={{ width: 38, height: 38, borderRadius: '50%', border: '1.5px solid #C9B896', background: 'transparent', color: currentIndex === 0 ? '#C9B896' : '#7A6B57', fontSize: 18, cursor: currentIndex === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <button onClick={goNext} disabled={currentIndex === cards.length - 1} style={{ width: 38, height: 38, borderRadius: '50%', border: '1.5px solid #C9B896', background: 'transparent', color: currentIndex === cards.length - 1 ? '#C9B896' : '#7A6B57', fontSize: 18, cursor: currentIndex === cards.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</button>
        </div>

        {/* Known / Unknown */}
        <div style={{ display: 'flex', gap: 14 }}>
          <button onClick={handleMarkUnknown} style={{ ...btnStyle(false, true), padding: '11px 24px', fontSize: 14 }}>✕ Don't Know</button>
          <button onClick={handleMarkKnown}   style={{ ...btnStyle(false, false, true), padding: '11px 24px', fontSize: 14 }}>✓ I Know This</button>
        </div>

        {/* Unknown dots */}
        {unknownCards.length > 0 && unknownCards.length < totalCount && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 11, color: '#A8997E' }}>Still learning ({unknownCards.length}):</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 400 }}>
              {unknownCards.map(c => {
                const idx = cards.findIndex(card => card.id === c.id)
                const isActive = currentIndex === idx
                return (
                  <button key={c.id} onClick={() => jumpToCard(c.id)} title={`Card ${idx + 1}: ${c.front}`} style={{ width: 28, height: 28, borderRadius: '50%', background: isActive ? '#C0392B' : '#E8A0A0', border: isActive ? '2px solid #3A2E22' : '2px solid transparent', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                    {idx + 1}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: '#C9B896', textAlign: 'center' }}>
          Space = flip · ← → = navigate · K = know · U = unknown
        </div>
      </div>
    </div>
  )
}