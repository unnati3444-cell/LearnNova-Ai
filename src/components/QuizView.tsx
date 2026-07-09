'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
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

type UserAnswers = Record<string, number>

type Props = {
  projectId: string
  isDemo: boolean
  loading: boolean
  error: string
  questions: Question[]
  lastAnswers: UserAnswers
  timePerQuestion: number
  onGenerate: () => void
  onTimeChange: (t: number) => void
  onSaveAnswers: (answers: UserAnswers, score: number) => void
}

// ── Timer bar ──────────────────────────────────────────────────────────────────
function TimerBar({ seconds, total }: { seconds: number; total: number }) {
  const pct = (seconds / total) * 100
  const color = seconds <= 10 ? '#E85050' : seconds <= 20 ? '#E8A060' : '#56C456'
  return (
    <div style={{ width: '100%', height: 6, background: '#EDE3D3', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 99, background: color,
        width: `${pct}%`,
        transition: 'width 1s linear, background 0.3s',
      }} />
    </div>
  )
}

// ── Review screen ──────────────────────────────────────────────────────────────
function QuizReviewScreen({
  questions, answers, totalTime, timeTaken,
  onRetry, onRegenerate,
}: {
  questions: Question[]
  answers: UserAnswers
  totalTime: number
  timeTaken: number
  onRetry: () => void
  onRegenerate: () => void
}) {
  const score = questions.filter(q => answers[q.id] === q.correct).length
  const pct   = Math.round((score / questions.length) * 100)
  const mins  = Math.floor(timeTaken / 60)
  const secs  = timeTaken % 60
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

  const scoreColor = pct >= 80 ? '#27AE60' : pct >= 50 ? '#E8A060' : '#E85050'

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

      {/* Score header */}
      <div style={{
        background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 16,
        padding: '24px', marginBottom: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>
          {pct >= 80 ? '🏆' : pct >= 50 ? '📚' : '💪'}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor, marginBottom: 4 }}>
          {score}/{questions.length}
        </div>
        <div style={{ fontSize: 15, color: '#7A6B57', marginBottom: 4 }}>
          {pct}% — {pct >= 80 ? 'Excellent!' : pct >= 50 ? 'Good effort!' : 'Keep studying!'}
        </div>
        <div style={{ fontSize: 12, color: '#A8997E', marginBottom: 16 }}>
          ⏱️ Completed in {timeStr}
        </div>

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
            ✦ New Quiz
          </button>
        </div>
      </div>

      {/* Review */}
      <div style={{ fontSize: 12, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
        Review All Questions
      </div>

      {questions.map((q, idx) => {
        const userAnswer  = answers[q.id]
        const isCorrect   = userAnswer === q.correct
        const wasAnswered = userAnswer !== undefined
        const timedOut    = !wasAnswered

        return (
          <div key={q.id} style={{
            background: '#FFFEFB',
            border: `1.5px solid ${isCorrect ? '#90D8A0' : timedOut ? '#DFD2BC' : '#E8A0A0'}`,
            borderRadius: 12, padding: '16px', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: isCorrect ? '#DFFFD8' : timedOut ? '#F5EFE6' : '#FFD6D6',
                color: isCorrect ? '#27AE60' : timedOut ? '#A8997E' : '#E85050',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
              }}>
                {isCorrect ? '✓' : timedOut ? '⏱' : '✕'}
              </span>
              <div>
                <div style={{ fontSize: 11, color: '#A8997E', marginBottom: 3 }}>
                  Q{idx + 1} · {q.type === 'truefalse' ? 'True / False' : 'Multiple Choice'}
                  {timedOut && <span style={{ color: '#E8A060', marginLeft: 8 }}>⏱ Time up</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#3A2E22', lineHeight: 1.5 }}>
                  {q.question}
                </div>
              </div>
            </div>

            <div style={{ paddingLeft: 34, fontSize: 13, lineHeight: 1.6 }}>
              {wasAnswered && !isCorrect && (
                <div style={{ color: '#E85050', marginBottom: 4 }}>
                  ✕ Your answer: <strong>{q.options[userAnswer]}</strong>
                </div>
              )}
              <div style={{ color: '#27AE60', marginBottom: 8 }}>
                ✓ Correct: <strong>{q.options[q.correct]}</strong>
              </div>
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
export default function QuizView({
  projectId, isDemo, loading, error,
  questions, lastAnswers, timePerQuestion,
  onGenerate, onTimeChange, onSaveAnswers,
}: Props) {
  const [quizStarted, setQuizStarted]     = useState(false)
  const [currentIndex, setCurrentIndex]   = useState(0)
  const [answers, setAnswers]             = useState<UserAnswers>({})
  const [timeLeft, setTimeLeft]           = useState(timePerQuestion)
  const [showReview, setShowReview]       = useState(false)
  const [timeTaken, setTimeTaken]         = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)

  const timerRef    = useRef<NodeJS.Timeout | null>(null)
  const startRef    = useRef<number>(Date.now())
  const currentQ    = questions[currentIndex]
  const totalCount  = questions.length

  // Load last session
  useEffect(() => {
    if (Object.keys(lastAnswers).length > 0 && questions.length > 0) {
      setAnswers(lastAnswers)
      setShowReview(true)
    }
  }, [questions])

  // Reset on new questions
  useEffect(() => {
    setQuizStarted(false)
    setCurrentIndex(0)
    setAnswers({})
    setTimeLeft(timePerQuestion)
    setShowReview(false)
    setSelectedOption(null)
  }, [questions.length])

  // Sync timer when timePerQuestion changes
  useEffect(() => {
    if (!quizStarted) setTimeLeft(timePerQuestion)
  }, [timePerQuestion])

  const finishQuiz = useCallback((finalAnswers: UserAnswers) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const taken = Math.floor((Date.now() - startRef.current) / 1000)
    setTimeTaken(taken)
    const finalScore = questions.filter(q => finalAnswers[q.id] === q.correct).length
    onSaveAnswers(finalAnswers, finalScore)
    setShowReview(true)
  }, [questions, onSaveAnswers])

  const advanceQuestion = useCallback((currentAnswers: UserAnswers) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setSelectedOption(null)

    setCurrentIndex(prev => {
      const next = prev + 1
      if (next >= totalCount) {
        finishQuiz(currentAnswers)
        return prev
      }
      setTimeLeft(timePerQuestion)
      return next
    })
  }, [totalCount, timePerQuestion, finishQuiz])

  // Timer
  useEffect(() => {
    if (!quizStarted || showReview) return
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up — advance without answer (counts as wrong)
          setAnswers(current => {
            advanceQuestion(current)
            return current
          })
          return timePerQuestion
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [quizStarted, currentIndex, showReview, advanceQuestion, timePerQuestion])

  function startQuiz() {
    setQuizStarted(true)
    setCurrentIndex(0)
    setAnswers({})
    setTimeLeft(timePerQuestion)
    setSelectedOption(null)
    startRef.current = Date.now()
  }

  function selectAnswer(optionIndex: number) {
    if (selectedOption !== null) return // already answered
    setSelectedOption(optionIndex)
    const next = { ...answers, [currentQ.id]: optionIndex }
    setAnswers(next)
    // Short delay then advance
    setTimeout(() => advanceQuestion(next), 800)
  }

  function handleRetry() {
    setAnswers({})
    setShowReview(false)
    setQuizStarted(false)
    setCurrentIndex(0)
    setSelectedOption(null)
    onSaveAnswers({}, 0)
  }

  const optionLabels = ['A', 'B', 'C', 'D']

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!questions.length && !loading) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 40 }}>⏱️</div>
      <div style={{ fontWeight: 700, color: '#3A2E22', fontSize: 15 }}>Quiz Mode</div>
      <div style={{ fontSize: 13, color: '#A8997E', maxWidth: 320, textAlign: 'center' }}>
        Timed questions from your sources. No immediate feedback — test yourself under pressure, then review at the end.
      </div>

      {/* Timer picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: '#7A6B57' }}>Time per question:</span>
        {[15, 30, 60].map(t => (
          <button key={t} onClick={() => onTimeChange(t)} style={{
            width: 48, height: 36, borderRadius: 8,
            border: timePerQuestion === t ? '2px solid #A8693F' : '1px solid #C9B896',
            background: timePerQuestion === t ? '#F5E8D8' : 'transparent',
            color: timePerQuestion === t ? '#A8693F' : '#7A6B57',
            fontWeight: timePerQuestion === t ? 700 : 400,
            fontSize: 13, cursor: 'pointer',
          }}>
            {t}s
          </button>
        ))}
      </div>

      {error && <div style={{ fontSize: 12, color: '#A8453F' }}>{error}</div>}
      <button onClick={onGenerate} style={{
        background: '#A8693F', color: 'white', border: 'none',
        borderRadius: 10, padding: '11px 28px', fontSize: 14,
        fontWeight: 700, cursor: 'pointer',
      }}>
        Generate Quiz
      </button>
    </div>
  )

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen tool="quiz" />

  // ── Review screen ────────────────────────────────────────────────────────────
  if (showReview) return (
    <QuizReviewScreen
      questions={questions}
      answers={answers}
      totalTime={questions.length * timePerQuestion}
      timeTaken={timeTaken}
      onRetry={handleRetry}
      onRegenerate={onGenerate}
    />
  )

  // ── Pre-start screen ─────────────────────────────────────────────────────────
  if (!quizStarted) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 40 }}>⏱️</div>
      <div style={{ fontWeight: 700, color: '#3A2E22', fontSize: 17 }}>Ready to start?</div>
      <div style={{
        background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 12,
        padding: '16px 24px', fontSize: 13, color: '#7A6B57', lineHeight: 1.8,
        maxWidth: 320, textAlign: 'center',
      }}>
        <div>📋 {totalCount} questions</div>
        <div>⏱️ {timePerQuestion} seconds per question</div>
        <div>🚫 No feedback during quiz</div>
        <div>📊 Full review at the end</div>
      </div>

      {/* Timer picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#7A6B57' }}>Change timer:</span>
        {[15, 30, 60].map(t => (
          <button key={t} onClick={() => onTimeChange(t)} style={{
            width: 44, height: 32, borderRadius: 8,
            border: timePerQuestion === t ? '2px solid #A8693F' : '1px solid #C9B896',
            background: timePerQuestion === t ? '#F5E8D8' : 'transparent',
            color: timePerQuestion === t ? '#A8693F' : '#7A6B57',
            fontWeight: timePerQuestion === t ? 700 : 400,
            fontSize: 12, cursor: 'pointer',
          }}>
            {t}s
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onGenerate} style={{
          background: 'transparent', border: '1.5px solid #C9B896',
          borderRadius: 10, padding: '10px 18px', fontSize: 13,
          color: '#7A6B57', cursor: 'pointer',
        }}>
          ↻ New Questions
        </button>
        <button onClick={startQuiz} style={{
          background: '#A8693F', color: 'white', border: 'none',
          borderRadius: 10, padding: '11px 28px', fontSize: 14,
          fontWeight: 700, cursor: 'pointer',
        }}>
          Start Quiz →
        </button>
      </div>
    </div>
  )

  // ── Quiz question view ───────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid #DFD2BC', background: '#FFFEFB', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#3A2E22' }}>
            ⏱️ Quiz Mode
          </span>
          <span style={{ fontSize: 12, color: '#7A6B57' }}>
            Question {currentIndex + 1} of {totalCount}
          </span>
          <div style={{
            marginLeft: 'auto', fontSize: 16, fontWeight: 800,
            color: timeLeft <= 10 ? '#E85050' : timeLeft <= 20 ? '#E8A060' : '#3A2E22',
            minWidth: 48, textAlign: 'right',
          }}>
            {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>
        <TimerBar seconds={timeLeft} total={timePerQuestion} />
      </div>

      {/* Question area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', maxWidth: 680, width: '100%', margin: '0 auto' }}>

        {/* Type badge */}
        <div style={{
          display: 'inline-block', fontSize: 11, fontWeight: 600,
          color: currentQ.type === 'truefalse' ? '#5C4A8C' : '#3D6B8C',
          background: currentQ.type === 'truefalse' ? '#E8DCF5' : '#D8E4EC',
          borderRadius: 6, padding: '3px 10px', marginBottom: 14,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {currentQ.type === 'truefalse' ? 'True / False' : 'Multiple Choice'}
        </div>

        {/* Question */}
        <div style={{
          background: '#FFFEFB', border: '1.5px solid #DFD2BC',
          borderRadius: 12, padding: '20px 24px', marginBottom: 20,
          fontSize: 16, fontWeight: 600, color: '#3A2E22', lineHeight: 1.6,
        }}>
          {currentQ.question}
        </div>

        {/* Options — no color feedback during quiz */}
        {currentQ.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => selectAnswer(i)}
            disabled={selectedOption !== null}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderRadius: 10, marginBottom: 8,
              border: selectedOption === i ? '2px solid #A8693F' : '1.5px solid #DFD2BC',
              background: selectedOption === i ? '#F5E8D8' : '#FFFEFB',
              color: '#3A2E22', cursor: selectedOption !== null ? 'default' : 'pointer',
              textAlign: 'left', fontSize: 14, lineHeight: 1.5,
              transition: 'all 0.12s',
            }}
          >
            <span style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: selectedOption === i ? '#A8693F' : '#F0E8DC',
              color: selectedOption === i ? 'white' : '#7A6B57',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>
              {optionLabels[i] || String(i + 1)}
            </span>
            <span>{opt}</span>
          </button>
        ))}

        {/* No feedback hint */}
        <div style={{ fontSize: 11, color: '#C9B896', textAlign: 'center', marginTop: 12 }}>
          Results shown after all questions
        </div>
      </div>
    </div>
  )
}