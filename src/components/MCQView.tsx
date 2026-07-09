'use client'
import { useState, useEffect } from 'react'
import LoadingScreen from '@/components/LoadingScreen'

// ── Types ─────────────────────────────────────────────────────────────────────
type Question = {
  id: string
  type: 'mcq' | 'truefalse'
  question: string
  options: string[]
  correct: number
  explanation: string
}

type UserAnswers = Record<string, number> // questionId → selected option index

type Props = {
  projectId: string
  isDemo: boolean
  loading: boolean
  error: string
  questions: Question[]
  lastAnswers: UserAnswers
  onGenerate: () => void
  onSaveAnswers: (answers: UserAnswers, score: number) => void
}

// ── Option button ──────────────────────────────────────────────────────────────
function OptionButton({
  label, text, selected, correct, revealed, onClick,
}: {
  label: string
  text: string
  selected: boolean
  correct: boolean
  revealed: boolean
  onClick: () => void
}) {
  let bg = '#FFFEFB'
  let border = '1.5px solid #DFD2BC'
  let color = '#3A2E22'

  if (revealed) {
    if (correct) {
      bg = '#DFFFD8'; border = '2px solid #56C456'; color = '#1A5C1A'
    } else if (selected && !correct) {
      bg = '#FFD6D6'; border = '2px solid #E85050'; color = '#8C1A1A'
    } else {
      bg = '#FFFEFB'; border = '1.5px solid #DFD2BC'; color = '#A8997E'
    }
  } else if (selected) {
    bg = '#F5E8D8'; border = '2px solid #A8693F'; color = '#A8693F'
  }

  return (
    <button
      onClick={onClick}
      disabled={revealed}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderRadius: 10, border, background: bg,
        color, cursor: revealed ? 'default' : 'pointer',
        textAlign: 'left', fontSize: 14, lineHeight: 1.5,
        transition: 'all 0.15s', marginBottom: 8,
      }}
    >
      <span style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: revealed && correct ? '#56C456' : revealed && selected ? '#E85050' : selected ? '#A8693F' : '#F0E8DC',
        color: revealed && correct ? 'white' : revealed && selected ? 'white' : selected ? 'white' : '#7A6B57',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
      }}>
        {revealed && correct ? '✓' : revealed && selected && !correct ? '✕' : label}
      </span>
      <span>{text}</span>
    </button>
  )
}

// ── Review screen ──────────────────────────────────────────────────────────────
function ReviewScreen({
  questions, answers, onRetry, onRegenerate,
}: {
  questions: Question[]
  answers: UserAnswers
  onRetry: () => void
  onRegenerate: () => void
}) {
  const score = questions.filter(q => answers[q.id] === q.correct).length
  const pct   = Math.round((score / questions.length) * 100)

  const scoreColor = pct >= 80 ? '#27AE60' : pct >= 50 ? '#E8A060' : '#E85050'

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

      {/* Score header */}
      <div style={{
        background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 16,
        padding: '24px', marginBottom: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>
          {pct >= 80 ? '🎯' : pct >= 50 ? '📚' : '💪'}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor, marginBottom: 4 }}>
          {score}/{questions.length}
        </div>
        <div style={{ fontSize: 15, color: '#7A6B57', marginBottom: 16 }}>
          {pct}% — {pct >= 80 ? 'Excellent!' : pct >= 50 ? 'Good effort!' : 'Keep studying!'}
        </div>

        {/* Score bar */}
        <div style={{ width: '100%', height: 8, background: '#EDE3D3', borderRadius: 99, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{
            height: '100%', borderRadius: 99, background: scoreColor,
            width: `${pct}%`, transition: 'width 0.6s ease',
          }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onRetry} style={{
            background: 'transparent', border: '1.5px solid #C9B896',
            borderRadius: 10, padding: '10px 20px', fontSize: 13,
            color: '#7A6B57', cursor: 'pointer', fontWeight: 600,
          }}>
            ↻ Try Again
          </button>
          <button onClick={onRegenerate} style={{
            background: '#A8693F', border: 'none',
            borderRadius: 10, padding: '10px 20px', fontSize: 13,
            color: 'white', cursor: 'pointer', fontWeight: 700,
          }}>
            ✦ New Questions
          </button>
        </div>
      </div>

      {/* Question review */}
      <div style={{ fontSize: 12, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
        Review All Questions
      </div>

      {questions.map((q, idx) => {
        const userAnswer  = answers[q.id]
        const isCorrect   = userAnswer === q.correct
        const wasAnswered = userAnswer !== undefined

        return (
          <div key={q.id} style={{
            background: '#FFFEFB', border: `1.5px solid ${isCorrect ? '#90D8A0' : '#E8A0A0'}`,
            borderRadius: 12, padding: '16px', marginBottom: 12,
          }}>
            {/* Question */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: isCorrect ? '#DFFFD8' : '#FFD6D6',
                color: isCorrect ? '#27AE60' : '#E85050',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
              }}>
                {isCorrect ? '✓' : '✕'}
              </span>
              <div>
                <div style={{ fontSize: 11, color: '#A8997E', marginBottom: 3 }}>
                  Q{idx + 1} · {q.type === 'truefalse' ? 'True / False' : 'Multiple Choice'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#3A2E22', lineHeight: 1.5 }}>
                  {q.question}
                </div>
              </div>
            </div>

            {/* Answers */}
            <div style={{ paddingLeft: 34, fontSize: 13, lineHeight: 1.6 }}>
              {wasAnswered && !isCorrect && (
                <div style={{ color: '#E85050', marginBottom: 4 }}>
                  ✕ Your answer: <strong>{q.options[userAnswer]}</strong>
                </div>
              )}
              <div style={{ color: '#27AE60', marginBottom: 8 }}>
                ✓ Correct: <strong>{q.options[q.correct]}</strong>
              </div>
              {!wasAnswered && (
                <div style={{ color: '#A8997E', marginBottom: 8 }}>
                  — Not answered
                </div>
              )}
              {/* Explanation */}
              <div style={{
                background: '#F5EFE6', borderRadius: 8,
                padding: '8px 12px', fontSize: 12,
                color: '#7A6B57', lineHeight: 1.6,
              }}>
                💡 {q.explanation}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MCQView({
  projectId, isDemo, loading, error,
  questions, lastAnswers, onGenerate, onSaveAnswers,
}: Props) {
  const [currentIndex, setCurrentIndex]   = useState(0)
  const [answers, setAnswers]             = useState<UserAnswers>({})
  const [revealed, setRevealed]           = useState(false)
  const [showReview, setShowReview]       = useState(false)

  const currentQ   = questions[currentIndex]
  const totalCount = questions.length
  const answered   = Object.keys(answers).length
  const score      = questions.filter(q => answers[q.id] === q.correct).length

  // Load last answers when questions load
  useEffect(() => {
    if (Object.keys(lastAnswers).length > 0 && questions.length > 0) {
      setAnswers(lastAnswers)
      setShowReview(true)
    }
  }, [questions])

  // Reset when new questions generated
  useEffect(() => {
    setCurrentIndex(0)
    setAnswers({})
    setRevealed(false)
    setShowReview(false)
  }, [questions.length])

  function selectAnswer(optionIndex: number) {
    if (revealed) return
    const next = { ...answers, [currentQ.id]: optionIndex }
    setAnswers(next)
    setRevealed(true)
  }

  function goNext() {
    setRevealed(false)
    if (currentIndex < totalCount - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      // Last question — save and show review
      const finalScore = questions.filter(q => answers[q.id] === q.correct).length
      onSaveAnswers(answers, finalScore)
      setShowReview(true)
    }
  }

  function handleRetry() {
    setAnswers({})
    setRevealed(false)
    setCurrentIndex(0)
    setShowReview(false)
    onSaveAnswers({}, 0)
  }

  const optionLabels = ['A', 'B', 'C', 'D']

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!questions.length && !loading) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 40 }}>✅</div>
      <div style={{ fontWeight: 700, color: '#3A2E22', fontSize: 15 }}>Generate MCQ Questions</div>
      <div style={{ fontSize: 13, color: '#A8997E', maxWidth: 320, textAlign: 'center' }}>
        AI generates multiple choice and true/false questions from your sources. Answer one by one and get instant feedback.
      </div>
      {error && <div style={{ fontSize: 12, color: '#A8453F' }}>{error}</div>}
      <button onClick={onGenerate} style={{
        background: '#A8693F', color: 'white', border: 'none',
        borderRadius: 10, padding: '11px 28px', fontSize: 14,
        fontWeight: 700, cursor: 'pointer',
      }}>
        Generate Questions
      </button>
    </div>
  )

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen tool="mcq" />

  // ── Review screen ────────────────────────────────────────────────────────────
  if (showReview) return (
    <ReviewScreen
      questions={questions}
      answers={answers}
      onRetry={handleRetry}
      onRegenerate={onGenerate}
    />
  )

  // ── Question view ────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        padding: '10px 20px', borderBottom: '1px solid #DFD2BC',
        background: '#FFFEFB', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#3A2E22' }}>
            Question {currentIndex + 1} of {totalCount}
          </span>
          <span style={{ fontSize: 12, color: '#7A6B57' }}>
            Score: <strong style={{ color: '#27AE60' }}>{score}</strong>/{answered}
          </span>
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={onGenerate} style={{
              background: 'transparent', border: '1px solid #C9B896',
              borderRadius: 8, padding: '5px 12px', fontSize: 12,
              color: '#7A6B57', cursor: 'pointer',
            }}>
              ↻ New Questions
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', height: 5, background: '#EDE3D3', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99, background: '#A8693F',
            width: `${((currentIndex + (revealed ? 1 : 0)) / totalCount) * 100}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Main question area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', maxWidth: 680, width: '100%', margin: '0 auto' }}>

        {/* Question type badge */}
        <div style={{
          display: 'inline-block', fontSize: 11, fontWeight: 600,
          color: currentQ.type === 'truefalse' ? '#5C4A8C' : '#3D5C3D',
          background: currentQ.type === 'truefalse' ? '#E8DCF5' : '#DCE8DC',
          borderRadius: 6, padding: '3px 10px', marginBottom: 14,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {currentQ.type === 'truefalse' ? 'True / False' : 'Multiple Choice'}
        </div>

        {/* Question text */}
        <div style={{
          background: '#FFFEFB', border: '1.5px solid #DFD2BC',
          borderRadius: 12, padding: '20px 24px', marginBottom: 20,
          fontSize: 16, fontWeight: 600, color: '#3A2E22', lineHeight: 1.6,
        }}>
          {currentQ.question}
        </div>

        {/* Options */}
        <div>
          {currentQ.options.map((opt, i) => (
            <OptionButton
              key={i}
              label={optionLabels[i] || String(i + 1)}
              text={opt}
              selected={answers[currentQ.id] === i}
              correct={i === currentQ.correct}
              revealed={revealed}
              onClick={() => selectAnswer(i)}
            />
          ))}
        </div>

        {/* Feedback + explanation */}
        {revealed && (
          <div style={{
            marginTop: 8, padding: '14px 16px',
            background: answers[currentQ.id] === currentQ.correct ? '#DFFFD8' : '#FFD6D6',
            border: `1.5px solid ${answers[currentQ.id] === currentQ.correct ? '#90D8A0' : '#E8A0A0'}`,
            borderRadius: 10,
          }}>
            <div style={{
              fontSize: 14, fontWeight: 700, marginBottom: 6,
              color: answers[currentQ.id] === currentQ.correct ? '#1A5C1A' : '#8C1A1A',
            }}>
              {answers[currentQ.id] === currentQ.correct ? '✅ Correct!' : `❌ Wrong — correct answer: ${currentQ.options[currentQ.correct]}`}
            </div>
            <div style={{ fontSize: 13, color: '#3A2E22', lineHeight: 1.6 }}>
              💡 {currentQ.explanation}
            </div>
          </div>
        )}

        {/* Next button */}
        {revealed && (
          <button
            onClick={goNext}
            style={{
              marginTop: 16, width: '100%',
              background: '#A8693F', color: 'white', border: 'none',
              borderRadius: 10, padding: '13px', fontSize: 14,
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            {currentIndex < totalCount - 1 ? 'Next Question →' : 'See Results →'}
          </button>
        )}
      </div>
    </div>
  )
}