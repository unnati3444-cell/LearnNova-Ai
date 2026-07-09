'use client'
import { useState, useEffect, use, type ReactElement } from 'react'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'

const MindMapView    = dynamic(() => import('@/components/MindMapView'), { ssr: false })
import SummaryView    from '@/components/SummaryView'
import NotesView      from '@/components/NotesView'
import FlashcardsView from '@/components/FlashcardsView'
import MCQView        from '@/components/MCQView'
import QuizView       from '@/components/QuizView'
import LoadingScreen  from '@/components/LoadingScreen'

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderMarkdown(text: string): ReactElement {
  const lines = text.split('\n')
  const elements: ReactElement[] = []
  let listBuffer: string[] = []
  let listType: 'ul' | 'ol' | null = null

  function flushList() {
    if (listBuffer.length === 0) return
    const items = [...listBuffer]
    const type = listType
    listBuffer = []
    listType = null
    if (type === 'ol') {
      elements.push(
        <ol key={elements.length} style={{ margin: '4px 0 8px', paddingLeft: 20 }}>
          {items.map((item, i) => <li key={i} style={{ marginBottom: 3, lineHeight: 1.55 }}>{renderInline(item)}</li>)}
        </ol>
      )
    } else {
      elements.push(
        <ul key={elements.length} style={{ margin: '4px 0 8px', paddingLeft: 20 }}>
          {items.map((item, i) => <li key={i} style={{ marginBottom: 3, lineHeight: 1.55 }}>{renderInline(item)}</li>)}
        </ul>
      )
    }
  }

  function renderInline(str: string): ReactElement {
    const parts = str.split(/(\*\*[^*]+\*\*)/g)
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

  lines.forEach((line) => {
    const trimmed = line.trim()
    const bulletMatch   = trimmed.match(/^[-*]\s+(.*)/)
    const numberedMatch = trimmed.match(/^\d+\.\s+(.*)/)
    if (bulletMatch) {
      if (listType !== 'ul') flushList()
      listType = 'ul'; listBuffer.push(bulletMatch[1])
    } else if (numberedMatch) {
      if (listType !== 'ol') flushList()
      listType = 'ol'; listBuffer.push(numberedMatch[1])
    } else {
      flushList()
      if (trimmed.length > 0)
        elements.push(<p key={elements.length} style={{ margin: '0 0 6px', lineHeight: 1.6 }}>{renderInline(trimmed)}</p>)
    }
  })
  flushList()
  return <>{elements}</>
}

// ── Friendly error messages ───────────────────────────────────────────────────
function friendlyError(raw: string, tool: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('select at least one source')) return 'Please select at least one source first.'
  if (lower.includes('all ai providers failed') || lower.includes('503') || lower.includes('unavailable'))
    return `AI is currently busy. Please try again in a moment.`
  if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('429'))
    return `AI usage limit reached. Please wait a minute and try again.`
  if (lower.includes('parse') || lower.includes('json'))
    return `Couldn't generate your ${tool}. Please try again.`
  if (lower.includes('network') || lower.includes('fetch'))
    return `Network error. Please check your connection and try again.`
  return `Couldn't generate your ${tool}. Please try again.`
}

const TOOLS = [
  { id: 'chat',       label: 'AI Chat',    icon: '💬', bg: '#DDD3E8', text: '#5C4A8C' },
  { id: 'mindmap',    label: 'Mind Map',   icon: '🗺️', bg: '#DCE8DC', text: '#3D5C3D' },
  { id: 'summary',    label: 'Summary',    icon: '📝', bg: '#F5E8C8', text: '#9C7A1F' },
  { id: 'notes',      label: 'Notes',      icon: '📓', bg: '#E8DCF5', text: '#5C3A8C' },
  { id: 'flashcards', label: 'Flashcards', icon: '🃏', bg: '#F0DCC8', text: '#A8693F' },
  { id: 'mcq',        label: 'MCQs',       icon: '✅', bg: '#E8DCE4', text: '#8C5C72' },
  { id: 'quiz',       label: 'Quiz',       icon: '⏱️', bg: '#D8E4EC', text: '#3D6B8C' },
]

type Source = {
  id: string;
  type: string;
  name: string;
  url: string | null;
  content: string | null;
  generated_from_metadata?: boolean
}
type Message     = { role: 'user' | 'ai'; text: string }
type FlashCard   = { id: string; front: string; back: string }
type MCQQuestion = { id: string; type: 'mcq' | 'truefalse'; question: string; options: string[]; correct: number; explanation: string }
type UserAnswers = Record<string, number>
type Difficulty  = 'easy' | 'medium' | 'hard'

const DEMO_DATA: Record<string, { name: string; sources: Source[] }> = {
  'demo-1': {
    name: '2008 Financial Crisis',
    sources: [
      { id: 'd1-1', type: 'website', name: 'Causes of the 2008 Crisis', url: 'demo', content: 'The 2008 financial crisis was triggered by the collapse of the US housing bubble. Banks issued subprime mortgages to risky borrowers, then bundled these into mortgage-backed securities (MBS) sold to investors worldwide. When housing prices fell, defaults spiked, causing massive losses. Lehman Brothers, a major investment bank, filed for bankruptcy in September 2008, triggering a global credit freeze. Governments worldwide responded with bailouts: the US passed TARP (Troubled Asset Relief Program), injecting $700 billion into banks. The crisis led to the Dodd-Frank Act of 2010, which introduced stricter banking regulations including the Volcker Rule.' },
      { id: 'd1-2', type: 'pdf', name: 'Subprime Mortgage Notes.pdf', url: null, content: 'Subprime mortgages were loans given to borrowers with poor credit history, at higher interest rates. Mortgage originators sold these loans to banks, who repackaged them into Collateralized Debt Obligations (CDOs). Credit rating agencies gave many CDOs AAA ratings despite high risk, misleading investors. This created a systemic risk because losses spread across the entire global financial system once defaults began.' },
    ],
  },
  'demo-2': {
    name: 'Satyam Scam — Case Study',
    sources: [
      { id: 'd2-1', type: 'website', name: 'Satyam Scandal Overview', url: 'demo', content: "The Satyam scandal, revealed in January 2009, involved founder and chairman B. Ramalinga Raju confessing to falsifying the company accounts of Satyam Computer Services, an Indian IT firm. Raju inflated revenues and profits for several years, fabricating over ₹7,000 crore (around $1 billion) in fictitious assets. He confessed in a letter to the board, stating the company's balance sheet had been manipulated since the company went public. The scandal led to SEBI tightening corporate governance norms in India and prompted the Companies Act 2013 reforms, including mandatory rotation of auditors." },
      { id: 'd2-2', type: 'pdf', name: 'Corporate Governance Lessons.pdf', url: null, content: 'Key governance failures in the Satyam case included a weak independent board, auditors (Price Waterhouse) failing to detect the fraud despite years of audits, and lack of whistleblower mechanisms. The case is studied in CA and corporate law curricula as an example of why independent audits, internal controls, and board accountability are critical. Mahindra Group later acquired Satyam through a competitive bidding process approved by the government.' },
    ],
  },
  'demo-3': {
    name: 'World War II Timeline',
    sources: [
      { id: 'd3-1', type: 'website', name: 'WWII Key Events', url: 'demo', content: "World War II began on September 1, 1939, when Germany invaded Poland, prompting Britain and France to declare war. Key phases: 1939-41 Axis expansion (Germany, Italy, Japan), 1941 Germany invades the Soviet Union (Operation Barbarossa) and Japan attacks Pearl Harbor, bringing the US into the war. 1942-43 turning point: Battle of Stalingrad and Battle of Midway. 1944 D-Day landings in Normandy. The war in Europe ended May 1945 with Germany's surrender. The Pacific war ended after atomic bombs were dropped on Hiroshima and Nagasaki in August 1945, leading to Japan's surrender." },
      { id: 'd3-2', type: 'pdf', name: 'Causes and Aftermath.pdf', url: null, content: 'Long-term causes of WWII included the harsh Treaty of Versailles terms on Germany after WWI, the rise of fascism and Nazism, and failure of the League of Nations to prevent aggression. The aftermath led to the formation of the United Nations in 1945, the start of the Cold War between the US and Soviet Union, and decolonization movements across Asia and Africa as European powers weakened.' },
    ],
  },
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isDemo = id.startsWith('demo-')

  // ── Core state ───────────────────────────────────────────────────────────────
  const [projectName, setProjectName]       = useState('Loading...')
  const [activeTool, setActiveTool]         = useState('chat')
  const [sources, setSources]               = useState<Source[]>([])
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [messages, setMessages]             = useState<Message[]>([])
  const [input, setInput]                   = useState('')
  const [showAddSource, setShowAddSource]   = useState(false)
  const [addMode, setAddMode]               = useState<'menu'|'pdf'|'youtube'|'website'|'doc'>('menu')
  const [urlInput, setUrlInput]             = useState('')
  const [uploading, setUploading]           = useState(false)
  const [sending, setSending]               = useState(false)
  const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null)

  // ── Mobile drawer state ──────────────────────────────────────────────────────
  const [leftOpen, setLeftOpen]   = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [isMobile, setIsMobile]   = useState(false)

  // ── Desktop collapse state ───────────────────────────────────────────────────
  const [leftCollapsed, setLeftCollapsed]   = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // ── Mind Map ─────────────────────────────────────────────────────────────────
  const [mindMapData, setMindMapData]                   = useState<any>(null)
  const [mindMapLoading, setMindMapLoading]             = useState(false)
  const [mindMapError, setMindMapError]                 = useState('')
  const [mindMapInstructions, setMindMapInstructions]   = useState('')
  const [showMindMapOptions, setShowMindMapOptions]     = useState(false)

  // ── Summary ──────────────────────────────────────────────────────────────────
  const [summaryContent, setSummaryContent]         = useState('')
  const [summaryLoading, setSummaryLoading]         = useState(false)
  const [summaryError, setSummaryError]             = useState('')
  const [summaryFocus, setSummaryFocus]             = useState('')
  const [summarySourceIds, setSummarySourceIds]     = useState<Set<string>>(new Set())
  const [showSummaryOptions, setShowSummaryOptions] = useState(false)

  // ── Notes ────────────────────────────────────────────────────────────────────
  const [notesContent, setNotesContent]             = useState('')
  const [notesLoading, setNotesLoading]             = useState(false)
  const [notesError, setNotesError]                 = useState('')
  const [notesFocus, setNotesFocus]                 = useState('')
  const [notesSourceIds, setNotesSourceIds]         = useState<Set<string>>(new Set())
  const [showNotesOptions, setShowNotesOptions]     = useState(false)

  // ── Flashcards ───────────────────────────────────────────────────────────────
  const [flashCards, setFlashCards]             = useState<FlashCard[]>([])
  const [flashKnownIds, setFlashKnownIds]       = useState<Set<string>>(new Set())
  const [flashCardCount, setFlashCardCount]     = useState(10)
  const [flashLoading, setFlashLoading]         = useState(false)
  const [flashError, setFlashError]             = useState('')
  const [flashSourceIds, setFlashSourceIds]     = useState<Set<string>>(new Set())
  const [flashFocus, setFlashFocus]             = useState('')
  const [showFlashOptions, setShowFlashOptions] = useState(false)

  // ── MCQ ──────────────────────────────────────────────────────────────────────
  const [mcqQuestions, setMcqQuestions]         = useState<MCQQuestion[]>([])
  const [mcqLastAnswers, setMcqLastAnswers]     = useState<UserAnswers>({})
  const [mcqLoading, setMcqLoading]             = useState(false)
  const [mcqError, setMcqError]                 = useState('')
  const [mcqSourceIds, setMcqSourceIds]         = useState<Set<string>>(new Set())
  const [mcqFocus, setMcqFocus]                 = useState('')
  const [mcqDifficulty, setMcqDifficulty]       = useState<Difficulty>('medium')
  const [showMcqOptions, setShowMcqOptions]     = useState(false)

  // ── Quiz ─────────────────────────────────────────────────────────────────────
  const [quizQuestions, setQuizQuestions]       = useState<MCQQuestion[]>([])
  const [quizLastAnswers, setQuizLastAnswers]   = useState<UserAnswers>({})
  const [quizLoading, setQuizLoading]           = useState(false)
  const [quizError, setQuizError]               = useState('')
  const [quizSourceIds, setQuizSourceIds]       = useState<Set<string>>(new Set())
  const [quizFocus, setQuizFocus]               = useState('')
  const [quizDifficulty, setQuizDifficulty]     = useState<Difficulty>('medium')
  const [quizTimePerQ, setQuizTimePerQ]         = useState(30)
  const [showQuizOptions, setShowQuizOptions]   = useState(false)

  // ── Detect mobile ────────────────────────────────────────────────────────────
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth <= 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Close modals when switching tools ────────────────────────────────────────
  useEffect(() => {
    setShowMindMapOptions(false); setShowSummaryOptions(false)
    setShowNotesOptions(false);   setShowFlashOptions(false)
    setShowMcqOptions(false);     setShowQuizOptions(false)
  }, [activeTool])

  // ── Notes auto-clear when selected sources change ────────────────────────────
  useEffect(() => {
    if (!notesContent || notesSourceIds.size === 0) return
    const missing = [...notesSourceIds].some(sid => !selectedIds.has(sid))
    if (missing) {
      setNotesContent(''); setNotesSourceIds(new Set())
      if (!isDemo) supabase.from('notes').delete().eq('project_id', id)
    }
  }, [selectedIds])

  useEffect(() => {
    if (!notesContent || notesSourceIds.size === 0) return
    const sids = new Set(sources.map(s => s.id))
    const deleted = [...notesSourceIds].some(sid => !sids.has(sid))
    if (deleted) {
      setNotesContent(''); setNotesSourceIds(new Set())
      if (!isDemo) supabase.from('notes').delete().eq('project_id', id)
    }
  }, [sources])

  // ── Summary auto-clear ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!summaryContent || summarySourceIds.size === 0) return
    const missing = [...summarySourceIds].some(sid => !selectedIds.has(sid))
    if (missing) {
      setSummaryContent(''); setSummarySourceIds(new Set())
      if (!isDemo) supabase.from('summaries').delete().eq('project_id', id)
    }
  }, [selectedIds])

  useEffect(() => {
    if (!summaryContent || summarySourceIds.size === 0) return
    const sids = new Set(sources.map(s => s.id))
    const deleted = [...summarySourceIds].some(sid => !sids.has(sid))
    if (deleted) {
      setSummaryContent(''); setSummarySourceIds(new Set())
      if (!isDemo) supabase.from('summaries').delete().eq('project_id', id)
    }
  }, [sources])

  // ── Flashcards auto-clear ────────────────────────────────────────────────────
  useEffect(() => {
    if (!flashCards.length || flashSourceIds.size === 0) return
    const missing = [...flashSourceIds].some(sid => !selectedIds.has(sid))
    if (missing) { setFlashCards([]); setFlashKnownIds(new Set()); setFlashSourceIds(new Set()) }
  }, [selectedIds])

  useEffect(() => {
    if (!flashCards.length || flashSourceIds.size === 0) return
    const sids = new Set(sources.map(s => s.id))
    const deleted = [...flashSourceIds].some(sid => !sids.has(sid))
    if (deleted) { setFlashCards([]); setFlashKnownIds(new Set()); setFlashSourceIds(new Set()) }
  }, [sources])

  // ── MCQ auto-clear ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mcqQuestions.length || mcqSourceIds.size === 0) return
    const missing = [...mcqSourceIds].some(sid => !selectedIds.has(sid))
    if (missing) { setMcqQuestions([]); setMcqLastAnswers({}); setMcqSourceIds(new Set()) }
  }, [selectedIds])

  useEffect(() => {
    if (!mcqQuestions.length || mcqSourceIds.size === 0) return
    const sids = new Set(sources.map(s => s.id))
    const deleted = [...mcqSourceIds].some(sid => !sids.has(sid))
    if (deleted) { setMcqQuestions([]); setMcqLastAnswers({}); setMcqSourceIds(new Set()) }
  }, [sources])

  // ── Quiz auto-clear ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!quizQuestions.length || quizSourceIds.size === 0) return
    const missing = [...quizSourceIds].some(sid => !selectedIds.has(sid))
    if (missing) { setQuizQuestions([]); setQuizLastAnswers({}); setQuizSourceIds(new Set()) }
  }, [selectedIds])

  useEffect(() => {
    if (!quizQuestions.length || quizSourceIds.size === 0) return
    const sids = new Set(sources.map(s => s.id))
    const deleted = [...quizSourceIds].some(sid => !sids.has(sid))
    if (deleted) { setQuizQuestions([]); setQuizLastAnswers({}); setQuizSourceIds(new Set()) }
  }, [sources])

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isDemo) {
      const demo = DEMO_DATA[id]
      if (demo) {
        setProjectName(demo.name)
        setSources(demo.sources)
        setSelectedIds(new Set(demo.sources.map(s => s.id)))
        setMessages([{ role: 'ai', text: `I've processed ${demo.sources.length} demo sources on "${demo.name}". Ask me anything!` }])
      }
    } else {
      loadProject(); loadSources(); loadSummary()
      loadNotes(); loadFlashcards(); loadMCQ(); loadQuiz()
    }
  }, [id])

  async function loadProject() {
    const { data } = await supabase.from('projects').select('*').eq('id', id).single()
    if (data) setProjectName(data.name)
  }

  async function loadSources() {
    const { data } = await supabase.from('sources').select('*').eq('project_id', id).order('created_at')
    if (data) {
      setSources(data)
      setSelectedIds(new Set(data.map((s: Source) => s.id)))
      setMessages([{ role: 'ai', text: data.length === 0 ? "Upload sources to begin. I'll only answer from what's inside them." : `I've processed your ${data.length} source${data.length !== 1 ? 's' : ''}. Ask me anything!` }])
    }
  }

  async function loadSummary() {
    const { data } = await supabase.from('summaries').select('content, source_ids').eq('project_id', id).single()
    if (!data) return
    const { data: cs } = await supabase.from('sources').select('id').eq('project_id', id)
    const cids = new Set((cs || []).map((s: any) => s.id))
    const savedIds: string[] = data.source_ids || []
    if (savedIds.length === 0 || savedIds.some((sid: string) => !cids.has(sid))) {
      await supabase.from('summaries').delete().eq('project_id', id); return
    }
    setSummaryContent(data.content); setSummarySourceIds(new Set(savedIds))
  }

  async function loadNotes() {
    const { data } = await supabase.from('notes').select('content, source_ids').eq('project_id', id).single()
    if (!data) return
    // ── Stale check (same as summary) ──
    const { data: cs } = await supabase.from('sources').select('id').eq('project_id', id)
    const cids = new Set((cs || []).map((s: any) => s.id))
    const savedIds: string[] = data.source_ids || []
    if (savedIds.length > 0 && savedIds.some((sid: string) => !cids.has(sid))) {
      await supabase.from('notes').delete().eq('project_id', id); return
    }
    setNotesContent(data.content)
    if (savedIds.length > 0) setNotesSourceIds(new Set(savedIds))
  }

  async function loadFlashcards() {
    const { data } = await supabase.from('flashcards').select('cards, source_ids, known_ids').eq('project_id', id).single()
    if (!data) return
    const { data: cs } = await supabase.from('sources').select('id').eq('project_id', id)
    const cids = new Set((cs || []).map((s: any) => s.id))
    const savedIds: string[] = data.source_ids || []
    if (savedIds.length === 0 || savedIds.some((sid: string) => !cids.has(sid))) {
      await supabase.from('flashcards').delete().eq('project_id', id); return
    }
    setFlashCards(data.cards || []); setFlashKnownIds(new Set(data.known_ids || [])); setFlashSourceIds(new Set(savedIds))
  }

  async function loadMCQ() {
    const { data } = await supabase.from('mcqs').select('questions, source_ids, last_answers').eq('project_id', id).single()
    if (!data) return
    const { data: cs } = await supabase.from('sources').select('id').eq('project_id', id)
    const cids = new Set((cs || []).map((s: any) => s.id))
    const savedIds: string[] = data.source_ids || []
    if (savedIds.length === 0 || savedIds.some((sid: string) => !cids.has(sid))) {
      await supabase.from('mcqs').delete().eq('project_id', id); return
    }
    setMcqQuestions(data.questions || []); setMcqLastAnswers(data.last_answers || {}); setMcqSourceIds(new Set(savedIds))
  }

  async function loadQuiz() {
    const { data } = await supabase.from('quizzes').select('questions, source_ids, last_answers, time_per_question').eq('project_id', id).single()
    if (!data) return
    const { data: cs } = await supabase.from('sources').select('id').eq('project_id', id)
    const cids = new Set((cs || []).map((s: any) => s.id))
    const savedIds: string[] = data.source_ids || []
    if (savedIds.length === 0 || savedIds.some((sid: string) => !cids.has(sid))) {
      await supabase.from('quizzes').delete().eq('project_id', id); return
    }
    setQuizQuestions(data.questions || []); setQuizLastAnswers(data.last_answers || [])
    setQuizTimePerQ(data.time_per_question || 30); setQuizSourceIds(new Set(savedIds))
  }

  // ── Source handlers ──────────────────────────────────────────────────────────
  async function handleAddUrl(type: 'youtube' | 'website') {
    if (!urlInput.trim() || isDemo) return
    setUploading(true)
    try {
      const res  = await fetch('/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, url: urlInput.trim() }) })
      const data = await res.json()
      if (data.error) { alert('Error: ' + data.error); setUploading(false); return }
await supabase.from('sources').insert({
  project_id: id,
  type,
  name: data.title || urlInput,
  url: urlInput,
  content: data.content,
  generated_from_metadata: data.generatedFromMetadata || false
})
      setUrlInput(''); setShowAddSource(false); setAddMode('menu'); loadSources()
    } catch (err: any) { alert('Failed: ' + err.message) }
    setUploading(false)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || isDemo) return
    setUploading(true)
    try {
      const formData = new FormData(); formData.append('file', file)
      const res  = await fetch('/api/extract-pdf', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) { alert('Error: ' + data.error); setUploading(false); return }
      await supabase.from('sources').insert({ project_id: id, type: 'pdf', name: data.title || file.name, url: null, content: data.content })
      setShowAddSource(false); setAddMode('menu'); loadSources()
    } catch (err: any) { alert('Failed: ' + err.message) }
    setUploading(false)
  }

  function toggleSource(sourceId: string) {
    setSelectedIds(prev => { const next = new Set(prev); next.has(sourceId) ? next.delete(sourceId) : next.add(sourceId); return next })
  }

  function selectAll() {
    setSelectedIds(new Set(sources.map(s => s.id)))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  async function confirmDeleteSource() {
    if (!deleteSourceId) return
    await supabase.from('sources').delete().eq('id', deleteSourceId)
    setDeleteSourceId(null); loadSources()
  }

  // ── AI generators ────────────────────────────────────────────────────────────
  async function sendMessage() {
    const sel = sources.filter(s => selectedIds.has(s.id))
    if (!input.trim() || sending || sel.length === 0) return
    const userText = input.trim()
    setMessages(prev => [...prev, { role: 'user', text: userText }])
    setInput(''); setSending(true)
    try {
      const res  = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: userText, sources: sel.map(s => ({ name: s.name, content: s.content })) }) })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'ai', text: data.answer || 'Sorry, could not generate a response.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Something went wrong. Please try again.' }])
    }
    setSending(false)
  }

  async function generateMindMap() {
    const sel = sources.filter(s => selectedIds.has(s.id))
    if (sel.length === 0) { setMindMapError('Please select at least one source first.'); return }
    if (mindMapLoading) return
    setMindMapLoading(true); setMindMapError('')
    try {
      const res  = await fetch('/api/mindmap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources: sel.map(s => ({ name: s.name, content: s.content })), instructions: mindMapInstructions.trim() || undefined }) })
      const data = await res.json()
      if (data.error) setMindMapError(friendlyError(data.error, 'mind map'))
      else setMindMapData(data)
    } catch { setMindMapError(friendlyError('network', 'mind map')) }
    setMindMapLoading(false)
  }

  async function generateSummary() {
    const sel = sources.filter(s => selectedIds.has(s.id))
    if (sel.length === 0) { setSummaryError('Please select at least one source first.'); return }
    if (summaryLoading) return
    setSummaryLoading(true); setSummaryError('')
    try {
      const res  = await fetch('/api/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources: sel.map(s => ({ name: s.name, content: s.content })), focus: summaryFocus.trim() || undefined }) })
      const data = await res.json()
      if (data.error) { setSummaryError(friendlyError(data.error, 'summary')) } else {
        setSummaryContent(data.summary); setSummarySourceIds(new Set(sel.map(s => s.id)))
        if (!isDemo) await supabase.from('summaries').upsert({ project_id: id, content: data.summary, source_ids: sel.map(s => s.id) }, { onConflict: 'project_id' })
      }
    } catch { setSummaryError(friendlyError('network', 'summary')) }
    setSummaryLoading(false)
  }

  async function generateNotes() {
    const sel = sources.filter(s => selectedIds.has(s.id))
    if (sel.length === 0) { setNotesError('Please select at least one source first.'); return }
    if (notesLoading) return
    setNotesLoading(true); setNotesError('')
    try {
      const res  = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources: sel.map(s => ({ name: s.name, content: s.content })), focus: notesFocus.trim() || undefined }) })
      const data = await res.json()
      if (data.error) { setNotesError(friendlyError(data.error, 'notes')) } else {
        setNotesContent(data.notes); setNotesSourceIds(new Set(sel.map(s => s.id)))
        if (!isDemo) await supabase.from('notes').upsert({ project_id: id, content: data.notes, source_ids: sel.map(s => s.id) }, { onConflict: 'project_id' })
      }
    } catch { setNotesError(friendlyError('network', 'notes')) }
    setNotesLoading(false)
  }

  async function generateFlashcards() {
    const sel = sources.filter(s => selectedIds.has(s.id))
    if (sel.length === 0) { setFlashError('Please select at least one source first.'); return }
    if (flashLoading) return
    setFlashLoading(true); setFlashError('')
    try {
      const res  = await fetch('/api/flashcards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources: sel.map(s => ({ name: s.name, content: s.content })), count: flashCardCount, focus: flashFocus.trim() || undefined }) })
      const data = await res.json()
      if (data.error) { setFlashError(friendlyError(data.error, 'flashcards')) } else {
        setFlashCards(data.cards); setFlashKnownIds(new Set()); setFlashSourceIds(new Set(sel.map(s => s.id)))
        if (!isDemo) await supabase.from('flashcards').upsert({ project_id: id, cards: data.cards, source_ids: sel.map(s => s.id), known_ids: [] }, { onConflict: 'project_id' })
      }
    } catch { setFlashError(friendlyError('network', 'flashcards')) }
    setFlashLoading(false)
  }

  async function generateMCQ() {
    const sel = sources.filter(s => selectedIds.has(s.id))
    if (sel.length === 0) { setMcqError('Please select at least one source first.'); return }
    if (mcqLoading) return
    setMcqLoading(true); setMcqError('')
    try {
      const res  = await fetch('/api/mcq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources: sel.map(s => ({ name: s.name, content: s.content })), difficulty: mcqDifficulty, focus: mcqFocus.trim() || undefined }) })
      const data = await res.json()
      if (data.error) { setMcqError(friendlyError(data.error, 'questions')) } else {
        setMcqQuestions(data.questions); setMcqLastAnswers({}); setMcqSourceIds(new Set(sel.map(s => s.id)))
        if (!isDemo) await supabase.from('mcqs').upsert({ project_id: id, questions: data.questions, source_ids: sel.map(s => s.id), last_answers: {}, last_score: 0 }, { onConflict: 'project_id' })
      }
    } catch { setMcqError(friendlyError('network', 'questions')) }
    setMcqLoading(false)
  }

  async function generateQuiz() {
    const sel = sources.filter(s => selectedIds.has(s.id))
    if (sel.length === 0) { setQuizError('Please select at least one source first.'); return }
    if (quizLoading) return
    setQuizLoading(true); setQuizError('')
    try {
      const res  = await fetch('/api/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources: sel.map(s => ({ name: s.name, content: s.content })), difficulty: quizDifficulty, focus: quizFocus.trim() || undefined }) })
      const data = await res.json()
      if (data.error) { setQuizError(friendlyError(data.error, 'quiz')) } else {
        setQuizQuestions(data.questions); setQuizLastAnswers({}); setQuizSourceIds(new Set(sel.map(s => s.id)))
        if (!isDemo) await supabase.from('quizzes').upsert({ project_id: id, questions: data.questions, source_ids: sel.map(s => s.id), last_answers: {}, last_score: 0, time_per_question: quizTimePerQ }, { onConflict: 'project_id' })
      }
    } catch { setQuizError(friendlyError('network', 'quiz')) }
    setQuizLoading(false)
  }

  async function markCardKnown(cardId: string) {
    setFlashKnownIds(prev => { const next = new Set(prev); next.add(cardId); if (!isDemo) supabase.from('flashcards').update({ known_ids: [...next] }).eq('project_id', id); return next })
  }

  async function markCardUnknown(cardId: string) {
    setFlashKnownIds(prev => { const next = new Set(prev); next.delete(cardId); if (!isDemo) supabase.from('flashcards').update({ known_ids: [...next] }).eq('project_id', id); return next })
  }

  async function saveMCQAnswers(answers: UserAnswers, score: number) {
    setMcqLastAnswers(answers)
    if (!isDemo && mcqQuestions.length > 0) await supabase.from('mcqs').update({ last_answers: answers, last_score: score }).eq('project_id', id)
  }

  async function saveQuizAnswers(answers: UserAnswers, score: number) {
    setQuizLastAnswers(answers)
    if (!isDemo && quizQuestions.length > 0) await supabase.from('quizzes').update({ last_answers: answers, last_score: score, time_per_question: quizTimePerQ }).eq('project_id', id)
  }

  async function handleQuizTimeChange(t: number) {
    setQuizTimePerQ(t)
    if (!isDemo && quizQuestions.length > 0) await supabase.from('quizzes').update({ time_per_question: t }).eq('project_id', id)
  }

  function explainNode(label: string) {
    setActiveTool('chat')
    const question = `Explain "${label}" in detail based on the sources.`
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setSending(true)
    const sel = sources.filter(s => selectedIds.has(s.id))
    fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, sources: sel.map(s => ({ name: s.name, content: s.content })) }) })
      .then(r => r.json())
      .then(data => setMessages(prev => [...prev, { role: 'ai', text: data.answer || 'Sorry, could not generate a response.' }]))
      .catch(() => setMessages(prev => [...prev, { role: 'ai', text: 'Something went wrong.' }]))
      .finally(() => setSending(false))
  }

  const srcIcon = (type: string) => type === 'pdf' ? '📄' : type === 'youtube' ? '▶️' : type === 'website' ? '🌐' : '📃'

  const btn = (accent = false): React.CSSProperties => ({
    background: accent ? '#A8693F' : 'transparent', color: accent ? 'white' : '#7A6B57',
    border: accent ? 'none' : '1px solid #C9B896', borderRadius: 8, padding: '8px 14px',
    fontSize: 12, fontWeight: accent ? 700 : 400, cursor: 'pointer',
  })

  const emptyState = (icon: string, title: string, desc: string, onGen: () => void, btnLabel: string, err: string, loading = false) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ fontSize: 36 }}>{icon}</div>
      <div style={{ fontWeight: 600, color: '#7A6B57', fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#A8997E', maxWidth: 280, textAlign: 'center' }}>{desc}</div>
      {err && <div style={{ fontSize: 12, color: '#A8453F', maxWidth: 280, textAlign: 'center' }}>{err}</div>}
      <button onClick={onGen} disabled={loading} style={{ ...btn(true), padding: '10px 20px', fontSize: 13, opacity: loading ? 0.6 : 1 }}>
        {loading ? 'Generating…' : btnLabel}
      </button>
    </div>
  )

  const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(58,46,34,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 150 }
  const modalBox: React.CSSProperties    = { background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 14, padding: 24, width: 400, boxShadow: '0 8px 32px rgba(58,46,34,0.15)', maxWidth: 'calc(100vw - 32px)' }

  function DifficultyPicker({ value, onChange }: { value: Difficulty; onChange: (d: Difficulty) => void }) {
    const opts: { id: Difficulty; label: string; emoji: string; color: string; bg: string }[] = [
      { id: 'easy',   label: 'Easy',   emoji: '🟢', color: '#27AE60', bg: '#DFFFD8' },
      { id: 'medium', label: 'Medium', emoji: '🟡', color: '#9C7A1F', bg: '#FFF9C4' },
      { id: 'hard',   label: 'Hard',   emoji: '🔴', color: '#A8453F', bg: '#FFD6D6' },
    ]
    return (
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {opts.map(o => (
          <button key={o.id} onClick={() => onChange(o.id)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: value === o.id ? `2px solid ${o.color}` : '1.5px solid #C9B896', background: value === o.id ? o.bg : 'transparent', color: value === o.id ? o.color : '#7A6B57', fontSize: 12, fontWeight: value === o.id ? 700 : 400, cursor: 'pointer' }}>
            {o.emoji} {o.label}
          </button>
        ))}
      </div>
    )
  }

  function OptionsButton({ toolId, show, onToggle }: { toolId: string; show: boolean; onToggle: () => void }) {
    if (activeTool !== toolId) return null
    return (
      <button onClick={e => { e.stopPropagation(); onToggle() }}
        style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', color: '#7A6B57', fontSize: 18, lineHeight: 1, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, transform: show ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
        ›
      </button>
    )
  }

  // ── Left sidebar content ──────────────────────────────────────────────────────
  const allSelected = sources.length > 0 && selectedIds.size === sources.length
  const someSelected = selectedIds.size > 0 && !allSelected

  function LeftSidebarContent() {
    return (
      <>
        <div style={{ padding: '12px 12px 6px' }}>
          <button
            onClick={() => isDemo ? alert('Demo projects have fixed sources. Create your own project to add sources!') : setShowAddSource(true)}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', background: '#A8693F', color: 'white', border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Add Source
          </button>
        </div>

        {/* Select all / deselect all */}
        {sources.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px' }}>
            <div style={{ fontSize: 10, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Sources ({sources.length})
            </div>
            <button
              onClick={allSelected ? deselectAll : selectAll}
              style={{ fontSize: 10, color: '#A8693F', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 4px' }}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        )}

        {sources.length === 0 && (
          <div style={{ fontSize: 10, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '8px 16px 6px' }}>
            Sources (0)
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sources.map(src => (
            <div key={src.id} style={{ padding: '8px 12px', margin: '0 8px', borderRadius: 8, marginBottom: 2, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input type="checkbox" checked={selectedIds.has(src.id)} onChange={() => toggleSource(src.id)} style={{ marginTop: 3, accentColor: '#A8693F', cursor: 'pointer', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                  <span style={{ fontSize: 13 }}>{srcIcon(src.type)}</span>
<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
  <span style={{
    fontSize: 12,
    fontWeight: 500,
    color: '#3A2E22',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }}>
    {src.name}
  </span>

  {src.generated_from_metadata && (
    <span
      title="This video had no transcript. Content was generated from metadata."
      style={{
        fontSize: 9,
        background: '#FFD6D6',
        color: '#A8453F',
        padding: '2px 6px',
        borderRadius: 6,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase'
      }}
    >
      AI
    </span>
  )}
</div>                </div>
                <div style={{ fontSize: 11, color: '#A8997E', paddingLeft: 20 }}>{src.type}</div>
              </div>
              {!isDemo && (
                <button onClick={() => setDeleteSourceId(src.id)} title="Delete" style={{ background: 'transparent', border: 'none', color: '#A8997E', cursor: 'pointer', fontSize: 13, flexShrink: 0, padding: 2 }}>✕</button>
              )}
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <div style={{ height: '100vh', background: '#F5EFE6', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <header style={{ background: '#FFFEFB', borderBottom: '1px solid #DFD2BC', padding: '0 12px 0 16px', height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {/* Mobile hamburger — left sidebar */}
          <button className="mobile-menu-btn" onClick={() => setLeftOpen(v => !v)}
            style={{ display: 'none', background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#7A6B57', padding: 4, flexShrink: 0 }}>
            ☰
          </button>
          <a href="/dashboard" style={{ fontSize: 13, color: '#A8997E', textDecoration: 'none', whiteSpace: 'nowrap' }}>← Dashboard</a>
          <span style={{ color: '#C9B896' }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#3A2E22', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectName}</span>
          {isDemo && <span style={{ fontSize: 9, background: '#DDBA92', color: '#A8693F', padding: '2px 8px', borderRadius: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Demo</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#A8997E' }}>{sources.length} sources</span>
          {/* Mobile hamburger — right sidebar */}
          <button className="mobile-menu-btn" onClick={() => setRightOpen(v => !v)}
            style={{ display: 'none', background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: '#7A6B57', padding: 4 }}>
            🛠
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Mobile overlay — closes drawers when tapping outside */}
        {isMobile && (leftOpen || rightOpen) && (
          <div className="drawer-overlay" onClick={() => { setLeftOpen(false); setRightOpen(false) }} />
        )}

        {/* LEFT SIDEBAR */}
        {isMobile ? (
          <aside
            className={`left-sidebar ${leftOpen ? 'open' : 'closed'}`}
            style={{ width: 260, background: '#FFFEFB', borderRight: '1px solid #DFD2BC', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 4px' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#3A2E22' }}>Sources</span>
              <button onClick={() => setLeftOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: '#A8997E' }}>✕</button>
            </div>
            <LeftSidebarContent />
          </aside>
        ) : (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <aside style={{ width: leftCollapsed ? 44 : 220, background: '#FFFEFB', borderRight: '1px solid #DFD2BC', display: 'flex', flexDirection: 'column', transition: 'width 0.2s', overflow: 'hidden', height: '100%' }}>
              {leftCollapsed ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12, gap: 16 }}>
                  <span title="Add Source" onClick={() => { setLeftCollapsed(false); if (!isDemo) setShowAddSource(true) }} style={{ fontSize: 18, cursor: 'pointer' }}>➕</span>
                  {sources.map(src => <span key={src.id} title={src.name} style={{ fontSize: 16, cursor: 'pointer' }} onClick={() => setLeftCollapsed(false)}>{srcIcon(src.type)}</span>)}
                </div>
              ) : (
                <LeftSidebarContent />
              )}
            </aside>
            <button onClick={() => setLeftCollapsed(v => !v)}
              style={{ position: 'absolute', top: '50%', right: -14, transform: 'translateY(-50%)', width: 14, height: 48, borderRadius: '0 8px 8px 0', zIndex: 20, background: '#A8693F', border: 'none', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {leftCollapsed ? '›' : '‹'}
            </button>
          </div>
        )}

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {activeTool === 'chat' && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'ai' && <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#DDD3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, marginRight: 8, flexShrink: 0, marginTop: 2 }}>✨</div>}
                    <div style={{ maxWidth: '80%', background: msg.role === 'ai' ? '#FFFEFB' : '#A8693F', color: msg.role === 'ai' ? '#3A2E22' : 'white', border: msg.role === 'ai' ? '1px solid #DFD2BC' : 'none', borderRadius: msg.role === 'ai' ? '0 10px 10px 10px' : '10px 0 10px 10px', padding: '10px 12px', fontSize: 13 }}>
                      {msg.role === 'ai' ? renderMarkdown(msg.text) : msg.text}
                    </div>
                  </div>
                ))}
                {sending && <div style={{ fontSize: 12, color: '#A8997E', paddingLeft: 32 }}>Thinking...</div>}
              </div>
              <div style={{ padding: '10px 14px 14px', background: '#FFFEFB', borderTop: '1px solid #DFD2BC', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  placeholder={selectedIds.size === 0 ? 'Select at least one source...' : 'Ask anything about your sources...'}
                  value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  disabled={selectedIds.size === 0}
                  style={{ flex: 1, background: '#EDE3D3', border: '1px solid #DFD2BC', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#3A2E22', outline: 'none' }}
                />
                <button onClick={sendMessage} disabled={selectedIds.size === 0 || sending}
                  style={{ background: '#A8693F', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', flexShrink: 0, opacity: sending ? 0.6 : 1 }}>
                  {sending ? '…' : '↑'}
                </button>
              </div>
            </>
          )}

          {activeTool === 'mindmap' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {!mindMapData && !mindMapLoading && emptyState('🗺️', 'Generate a Mind Map', 'Creates a visual diagram from your selected sources.', generateMindMap, 'Generate Mind Map', mindMapError, mindMapLoading)}
              {mindMapLoading && <LoadingScreen tool="mindmap" />}
              {mindMapData && !mindMapLoading && (
                <div style={{ flex: 1, position: 'relative' }}>
                  <button onClick={() => setMindMapData(null)} style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10, ...btn(), padding: '6px 12px', fontSize: 11 }}>↻ Regenerate</button>
                  <MindMapView data={mindMapData} onExplain={explainNode} />
                </div>
              )}
            </div>
          )}

          {activeTool === 'summary' && (
            <SummaryView content={summaryContent} projectId={id} projectName={projectName} isDemo={isDemo} loading={summaryLoading} error={summaryError} focus={summaryFocus} onFocusChange={setSummaryFocus} onRegenerate={generateSummary} />
          )}

          {activeTool === 'notes' && (
            <NotesView content={notesContent} projectId={id} projectName={projectName} isDemo={isDemo} loading={notesLoading} error={notesError} focus={notesFocus} onFocusChange={setNotesFocus} onRegenerate={generateNotes} />
          )}

          {activeTool === 'flashcards' && (
            <FlashcardsView projectId={id} isDemo={isDemo} loading={flashLoading} error={flashError} cards={flashCards} knownIds={flashKnownIds} cardCount={flashCardCount} onCardCountChange={setFlashCardCount} onGenerate={generateFlashcards} onMarkKnown={markCardKnown} onMarkUnknown={markCardUnknown} />
          )}

          {activeTool === 'mcq' && (
            <MCQView projectId={id} isDemo={isDemo} loading={mcqLoading} error={mcqError} questions={mcqQuestions} lastAnswers={mcqLastAnswers} onGenerate={generateMCQ} onSaveAnswers={saveMCQAnswers} />
          )}

          {activeTool === 'quiz' && (
            <QuizView projectId={id} isDemo={isDemo} loading={quizLoading} error={quizError} questions={quizQuestions} lastAnswers={quizLastAnswers} timePerQuestion={quizTimePerQ} onGenerate={generateQuiz} onTimeChange={handleQuizTimeChange} onSaveAnswers={saveQuizAnswers} />
          )}
        </main>

        {/* RIGHT SIDEBAR */}
        {isMobile ? (
          <aside
            className={`right-sidebar ${rightOpen ? 'open' : 'closed'}`}
            style={{ width: 220, background: '#FFFEFB', borderLeft: '1px solid #DFD2BC', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 4px' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#3A2E22' }}>Study Tools</span>
              <button onClick={() => setRightOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: '#A8997E' }}>✕</button>
            </div>
            {TOOLS.map(tool => (
              <div key={tool.id} style={{ borderBottom: '1px solid #DFD2BC' }}>
                <div onClick={() => { setActiveTool(tool.id); setRightOpen(false) }}
                  style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: activeTool === tool.id ? tool.bg : 'transparent' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: tool.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{tool.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: activeTool === tool.id ? tool.text : '#3A2E22', flex: 1 }}>{tool.label}</div>
                </div>
              </div>
            ))}
          </aside>
        ) : (
          <aside style={{ width: rightCollapsed ? 44 : 190, background: '#FFFEFB', borderLeft: '1px solid #DFD2BC', display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width 0.2s', overflow: 'hidden', position: 'relative' }}>
            <button onClick={() => setRightCollapsed(v => !v)} style={{ position: 'absolute', top: 10, left: 6, zIndex: 10, background: 'transparent', border: 'none', color: '#A8997E', fontSize: 16, cursor: 'pointer', padding: 4, lineHeight: 1 }}>
              {rightCollapsed ? '‹' : '›'}
            </button>
            {rightCollapsed ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 44, gap: 4 }}>
                {TOOLS.map(tool => (
                  <div key={tool.id} onClick={() => { setRightCollapsed(false); setActiveTool(tool.id) }} title={tool.label}
                    style={{ width: 32, height: 32, borderRadius: 8, background: activeTool === tool.id ? tool.bg : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', marginBottom: 2 }}>
                    {tool.icon}
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '14px 16px 8px', paddingLeft: 32 }}>Study Tools</div>
                {TOOLS.map(tool => (
                  <div key={tool.id} style={{ borderBottom: '1px solid #DFD2BC' }}>
                    <div onClick={() => setActiveTool(tool.id)}
                      style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: activeTool === tool.id ? tool.bg : 'transparent' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: tool.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{tool.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: activeTool === tool.id ? tool.text : '#3A2E22', flex: 1 }}>{tool.label}</div>
                      <OptionsButton toolId="mindmap"    show={showMindMapOptions} onToggle={() => setShowMindMapOptions(v => !v)} />
                      <OptionsButton toolId="summary"    show={showSummaryOptions} onToggle={() => setShowSummaryOptions(v => !v)} />
                      <OptionsButton toolId="notes"      show={showNotesOptions}   onToggle={() => setShowNotesOptions(v => !v)} />
                      <OptionsButton toolId="flashcards" show={showFlashOptions}   onToggle={() => setShowFlashOptions(v => !v)} />
                      <OptionsButton toolId="mcq"        show={showMcqOptions}     onToggle={() => setShowMcqOptions(v => !v)} />
                      <OptionsButton toolId="quiz"       show={showQuizOptions}    onToggle={() => setShowQuizOptions(v => !v)} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </aside>
        )}
      </div>

      {/* ── ALL MODALS ──────────────────────────────────────────────────────────── */}

      {showMindMapOptions && (
        <div style={modalOverlay} onClick={() => setShowMindMapOptions(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#3A2E22', marginBottom: 6 }}>Mind Map Options</div>
            <div style={{ fontSize: 12, color: '#7A6B57', marginBottom: 14 }}>Tell the AI how to structure your mind map.</div>
            <textarea autoFocus value={mindMapInstructions} onChange={e => setMindMapInstructions(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setShowMindMapOptions(false); generateMindMap() } }}
              placeholder="e.g. 'Focus on formulas and definitions'" rows={4}
              style={{ width: '100%', background: '#F5EFE6', border: '1px solid #DFD2BC', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#3A2E22', outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowMindMapOptions(false)} style={btn()}>Cancel</button>
              <button onClick={() => { setShowMindMapOptions(false); generateMindMap() }} style={{ ...btn(true), padding: '8px 16px' }}>Generate Mind Map</button>
            </div>
          </div>
        </div>
      )}

      {showSummaryOptions && (
        <div style={modalOverlay} onClick={() => setShowSummaryOptions(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#3A2E22', marginBottom: 6 }}>Summary Options</div>
            <div style={{ fontSize: 12, color: '#7A6B57', marginBottom: 14 }}>Tell the AI what to focus on.</div>
            <textarea autoFocus value={summaryFocus} onChange={e => setSummaryFocus(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setShowSummaryOptions(false); generateSummary() } }}
              placeholder="e.g. 'Focus only on Chapter 3'" rows={4}
              style={{ width: '100%', background: '#F5EFE6', border: '1px solid #DFD2BC', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#3A2E22', outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSummaryOptions(false)} style={btn()}>Cancel</button>
              <button onClick={() => { setShowSummaryOptions(false); generateSummary() }} style={{ ...btn(true), padding: '8px 16px' }}>Generate Summary</button>
            </div>
          </div>
        </div>
      )}

      {showNotesOptions && (
        <div style={modalOverlay} onClick={() => setShowNotesOptions(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#3A2E22', marginBottom: 6 }}>Notes Options</div>
            <div style={{ fontSize: 12, color: '#7A6B57', marginBottom: 14 }}>Tell the AI what to focus on.</div>
            <textarea autoFocus value={notesFocus} onChange={e => setNotesFocus(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setShowNotesOptions(false); generateNotes() } }}
              placeholder="e.g. 'Focus on Bhakti Sampradayas and their founders'" rows={4}
              style={{ width: '100%', background: '#F5EFE6', border: '1px solid #DFD2BC', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#3A2E22', outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNotesOptions(false)} style={btn()}>Cancel</button>
              <button onClick={() => { setShowNotesOptions(false); generateNotes() }} style={{ ...btn(true), padding: '8px 16px' }}>Generate Notes</button>
            </div>
          </div>
        </div>
      )}

      {showFlashOptions && (
        <div style={modalOverlay} onClick={() => setShowFlashOptions(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#3A2E22', marginBottom: 6 }}>Flashcard Options</div>
            <div style={{ fontSize: 12, color: '#7A6B57', marginBottom: 14 }}>Customise what cards are generated.</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#3A2E22', marginBottom: 6 }}>How many cards?</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[10, 20, 30].map(n => (
                <button key={n} onClick={() => setFlashCardCount(n)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: flashCardCount === n ? '2px solid #A8693F' : '1.5px solid #C9B896', background: flashCardCount === n ? '#F5E8D8' : 'transparent', color: flashCardCount === n ? '#A8693F' : '#7A6B57', fontWeight: flashCardCount === n ? 700 : 400, fontSize: 14, cursor: 'pointer' }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#3A2E22', marginBottom: 6 }}>Focus (optional)</div>
            <textarea value={flashFocus} onChange={e => setFlashFocus(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setShowFlashOptions(false); generateFlashcards() } }}
              placeholder="e.g. 'Only definitions' or 'Focus on Chapter 3'" rows={3}
              style={{ width: '100%', background: '#F5EFE6', border: '1px solid #DFD2BC', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#3A2E22', outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowFlashOptions(false)} style={btn()}>Cancel</button>
              <button onClick={() => { setShowFlashOptions(false); generateFlashcards() }} style={{ ...btn(true), padding: '8px 16px' }}>Generate {flashCardCount} Cards</button>
            </div>
          </div>
        </div>
      )}

      {showMcqOptions && (
        <div style={modalOverlay} onClick={() => setShowMcqOptions(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#3A2E22', marginBottom: 6 }}>MCQ Options</div>
            <div style={{ fontSize: 12, color: '#7A6B57', marginBottom: 14 }}>Customise your multiple choice questions.</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#3A2E22', marginBottom: 6 }}>Difficulty</div>
            <DifficultyPicker value={mcqDifficulty} onChange={setMcqDifficulty} />
            <div style={{ fontSize: 12, fontWeight: 600, color: '#3A2E22', marginBottom: 6 }}>Focus (optional)</div>
            <textarea value={mcqFocus} onChange={e => setMcqFocus(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setShowMcqOptions(false); generateMCQ() } }}
              placeholder="e.g. 'Only case studies' or 'Focus on legal sections'" rows={3}
              style={{ width: '100%', background: '#F5EFE6', border: '1px solid #DFD2BC', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#3A2E22', outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowMcqOptions(false)} style={btn()}>Cancel</button>
              <button onClick={() => { setShowMcqOptions(false); generateMCQ() }} style={{ ...btn(true), padding: '8px 16px' }}>Generate Questions</button>
            </div>
          </div>
        </div>
      )}

      {showQuizOptions && (
        <div style={modalOverlay} onClick={() => setShowQuizOptions(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#3A2E22', marginBottom: 6 }}>Quiz Options</div>
            <div style={{ fontSize: 12, color: '#7A6B57', marginBottom: 14 }}>Customise your timed quiz.</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#3A2E22', marginBottom: 6 }}>Difficulty</div>
            <DifficultyPicker value={quizDifficulty} onChange={setQuizDifficulty} />
            <div style={{ fontSize: 12, fontWeight: 600, color: '#3A2E22', marginBottom: 6 }}>Time per question</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[15, 30, 60].map(t => (
                <button key={t} onClick={() => handleQuizTimeChange(t)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: quizTimePerQ === t ? '2px solid #3D6B8C' : '1.5px solid #C9B896', background: quizTimePerQ === t ? '#D8E4EC' : 'transparent', color: quizTimePerQ === t ? '#3D6B8C' : '#7A6B57', fontWeight: quizTimePerQ === t ? 700 : 400, fontSize: 13, cursor: 'pointer' }}>
                  {t}s
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#3A2E22', marginBottom: 6 }}>Focus (optional)</div>
            <textarea value={quizFocus} onChange={e => setQuizFocus(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setShowQuizOptions(false); generateQuiz() } }}
              placeholder="e.g. 'Only dates and events'" rows={3}
              style={{ width: '100%', background: '#F5EFE6', border: '1px solid #DFD2BC', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#3A2E22', outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowQuizOptions(false)} style={btn()}>Cancel</button>
              <button onClick={() => { setShowQuizOptions(false); generateQuiz() }} style={{ ...btn(true), padding: '8px 16px' }}>Generate Quiz</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Source */}
      {showAddSource && !isDemo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(58,46,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => { setShowAddSource(false); setAddMode('menu') }}>
          <div style={{ background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 14, padding: 28, width: 420, maxWidth: 'calc(100vw - 32px)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#3A2E22', marginBottom: 18 }}>Add Source</div>
            {addMode === 'menu' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                  {[
                    { icon: '📄', label: 'Upload PDF',  sub: 'Click to browse',    action: () => document.getElementById('pdf-input')?.click() },
                    { icon: '▶️', label: 'YouTube URL', sub: 'Paste a video link', action: () => setAddMode('youtube') },
                    { icon: '🌐', label: 'Website URL', sub: 'Paste any webpage',  action: () => setAddMode('website') },
                    { icon: '📃', label: 'Upload Doc',  sub: 'Coming soon',        action: undefined },
                  ].map(({ icon, label, sub, action }) => (
                    <div key={label} onClick={action} style={{ padding: 14, cursor: action ? 'pointer' : 'default', textAlign: 'center', border: '1px solid #DFD2BC', borderRadius: 10, opacity: action ? 1 : 0.5 }}>
                      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#3A2E22' }}>{label}</div>
                      <div style={{ fontSize: 11, color: '#A8997E' }}>{sub}</div>
                    </div>
                  ))}
                </div>
                <input id="pdf-input" type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileUpload} />
                <button onClick={() => setShowAddSource(false)} style={{ ...btn(), width: '100%', display: 'flex', justifyContent: 'center', padding: '9px' }}>Cancel</button>
              </>
            )}
            {(addMode === 'youtube' || addMode === 'website') && (
              <>
                <div style={{ fontSize: 12, color: '#7A6B57', marginBottom: 10 }}>Paste your {addMode === 'youtube' ? 'YouTube video' : 'website'} link below:</div>
                <input autoFocus placeholder={addMode === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://example.com'} value={urlInput} onChange={e => setUrlInput(e.target.value)}
                  style={{ width: '100%', background: '#EDE3D3', border: '1px solid #DFD2BC', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#3A2E22', outline: 'none', marginBottom: 16 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAddMode('menu')} style={{ ...btn(), flex: 1, padding: '9px', justifyContent: 'center', display: 'flex' }}>Back</button>
                  <button onClick={() => handleAddUrl(addMode as 'youtube' | 'website')} disabled={uploading} style={{ ...btn(true), flex: 1, padding: '9px', justifyContent: 'center', display: 'flex', opacity: uploading ? 0.6 : 1 }}>
                    {uploading ? 'Processing...' : 'Add Source'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Source */}
      {deleteSourceId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(58,46,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setDeleteSourceId(null)}>
          <div style={{ background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 14, padding: 24, width: 320, maxWidth: 'calc(100vw - 32px)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#3A2E22', marginBottom: 6 }}>Delete this source?</div>
            <div style={{ fontSize: 12, color: '#7A6B57', marginBottom: 18 }}>This will remove it from the project permanently.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteSourceId(null)} style={btn()}>Cancel</button>
              <button onClick={confirmDeleteSource} style={{ ...btn(true), background: '#A8453F' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {uploading && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#3A2E22', color: 'white', padding: '10px 18px', borderRadius: 8, fontSize: 13, zIndex: 300 }}>
          Processing source...
        </div>
      )}
    </div>
  )
}