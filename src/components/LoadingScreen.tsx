'use client'
import { useState, useEffect } from 'react'

type ToolType = 'summary' | 'notes' | 'mindmap' | 'flashcards' | 'mcq' | 'quiz' | 'generic'

const TOOL_CONFIG: Record<ToolType, { icon: string; messages: string[] }> = {
  summary: {
    icon: '📝',
    messages: [
      'Reading your sources',
      'Identifying key topics',
      'Organising bullet points',
      'Writing exam-ready notes',
      'Working through the details',
    ],
  },
  notes: {
    icon: '📓',
    messages: [
      'Analysing your sources',
      'Structuring chapters',
      'Writing detailed explanations',
      'Adding definitions and key terms',
      'Working through the details',
    ],
  },
  mindmap: {
    icon: '🗺️',
    messages: [
      'Reading your sources',
      'Finding key concepts',
      'Building main branches',
      'Adding child nodes',
      'Working through the details',
    ],
  },
  flashcards: {
    icon: '🃏',
    messages: [
      'Reading your sources',
      'Picking important concepts',
      'Writing questions and answers',
      'Working through the details',
    ],
  },
  mcq: {
    icon: '✅',
    messages: [
      'Reading your sources',
      'Generating questions',
      'Building answer choices',
      'Working through the details',
    ],
  },
  quiz: {
    icon: '⏱️',
    messages: [
      'Reading your sources',
      'Building quiz questions',
      'Setting up scoring',
      'Working through the details',
    ],
  },
  generic: {
    icon: '⚙️',
    messages: [
      'Processing',
      'Working on it',
      'Handling the details',
      'Finalising',
    ],
  },
}

type Props = {
  tool: ToolType
}

export default function LoadingScreen({ tool }: Props) {
  const config = TOOL_CONFIG[tool] ?? TOOL_CONFIG.generic
  const [msgIndex, setMsgIndex] = useState(0)
  const [dot, setDot] = useState(0)

  // Cycle through messages every 2s
  useEffect(() => {
    const t = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % config.messages.length)
    }, 2000)
    return () => clearInterval(t)
  }, [config.messages.length])

  // Animate dots independently every 500ms
  useEffect(() => {
    const t = setInterval(() => {
      setDot(prev => (prev + 1) % 4) // 0 = '', 1 = '.', 2 = '..', 3 = '...'
    }, 500)
    return () => clearInterval(t)
  }, [])

  const dots = '.'.repeat(dot)

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      {/* Static emoji */}
      <div style={{ fontSize: 38 }}>{config.icon}</div>

      {/* Cycling message + pulsing dots */}
      <div style={{
        fontSize: 14, fontWeight: 600, color: '#7A6B57',
        minWidth: 260, textAlign: 'center',
      }}>
        {config.messages[msgIndex]}
        <span style={{
          display: 'inline-block', width: 24, textAlign: 'left',
          color: '#A8693F', letterSpacing: 2,
        }}>
          {dots}
        </span>
      </div>

      {/* Subtle sub-text */}
      <div style={{ fontSize: 11, color: '#A8997E', textAlign: 'center', maxWidth: 260 }}>
        Large documents are split into chunks — this may take a moment
      </div>

      {/* Animated progress bar */}
      <div style={{
        width: 200, height: 3, background: '#EDE3D3',
        borderRadius: 99, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: '#A8693F', borderRadius: 99,
          width: '40%',
          animation: 'loadingSlide 1.4s ease-in-out infinite',
        }} />
      </div>

      <style>{`
        @keyframes loadingSlide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(200%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  )
}