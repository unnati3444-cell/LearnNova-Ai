import { NextRequest, NextResponse } from 'next/server'
import { generateAI, stripFences } from '@/lib/ai'

export const maxDuration = 120

type Difficulty = 'easy' | 'medium' | 'hard'

function estimateQuestionCount(contentLength: number): number {
  if (contentLength < 20000) return 10
  if (contentLength < 60000) return 15
  return 20
}

function difficultyBlock(difficulty: Difficulty): string {
  if (difficulty === 'easy') {
    return `DIFFICULTY: Easy
- Wrong options should be clearly different from the correct answer
- Questions test basic recall — names, dates, simple definitions
- Keep questions short and direct`
  }
  if (difficulty === 'hard') {
    return `DIFFICULTY: Hard
- Wrong options should be very plausible and close to the correct answer
- Questions test deep understanding and nuanced distinctions
- Some questions can combine multiple concepts from the source`
  }
  return `DIFFICULTY: Medium
- Wrong options should be plausible but distinguishable to someone who studied
- Mix of recall and understanding questions`
}

function buildPrompt(content: string, count: number, difficulty: Difficulty, focus?: string): string {
  const focusBlock = focus ? `\nFOCUS INSTRUCTION: ${focus}\n` : ''
  return `You are creating a timed quiz for a student studying for exams.
${focusBlock}
${difficultyBlock(difficulty)}

Generate exactly ${count} questions from the source material below.

Mix these question types naturally:
- Factual recall (best for timed quiz — quick to answer)
- True/False (include roughly 25% as True/False)
- Definition questions: "What is X?"
- Identification questions: "Which of the following describes X?"

Rules for questions:
- Keep questions SHORT and direct — suitable for a timed quiz
- Each question must be answerable in under 30 seconds by someone who studied
- Questions must be answerable ONLY from the source material
- Cover ALL major topics

Rules for options:
- Regular MCQ: exactly 4 options
- True/False: exactly 2 options — values must be "True" and "False"

Rules for explanation:
- 1-2 sentences max — shown at review screen after quiz ends

Return ONLY valid JSON — no markdown, no code fences, no explanation.

Return this exact format:
[
  {
    "id": "q1",
    "type": "mcq",
    "question": "What did TARP inject into US banks?",
    "options": ["$500 billion", "$700 billion", "$1 trillion", "$200 billion"],
    "correct": 1,
    "explanation": "TARP injected $700 billion into US banks as part of the government bailout response to the 2008 financial crisis."
  },
  {
    "id": "q2",
    "type": "truefalse",
    "question": "True or False: The Dodd-Frank Act was passed in 2010.",
    "options": ["True", "False"],
    "correct": 0,
    "explanation": "The Dodd-Frank Act was passed in 2010 as a response to the 2008 financial crisis."
  }
]

SOURCE MATERIAL:
${content}`
}

export async function POST(req: NextRequest) {
  try {
    const { sources, difficulty = 'medium', focus } = await req.json()

    if (!sources || sources.length === 0)
      return NextResponse.json({ error: 'No sources provided' }, { status: 400 })

    const fullContent = sources
      .map((s: any, i: number) => `--- SOURCE ${i + 1}: ${s.name} ---\n${s.content || ''}`)
      .join('\n\n')
      .slice(0, 80000)

    const count = estimateQuestionCount(fullContent.length)

    const { text } = await generateAI({
      prompt: buildPrompt(fullContent, count, difficulty, focus),
      maxTokens: 8192,
      jsonMode: true,
    })

    const cleaned = stripFences(text)

    let questions: any[]
    try {
      questions = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse Quiz JSON:', cleaned.slice(0, 300))
      return NextResponse.json({ error: 'Failed to parse questions. Please try again.' }, { status: 500 })
    }

    if (!Array.isArray(questions) || questions.length === 0)
      return NextResponse.json({ error: 'No questions generated. Please try again.' }, { status: 500 })

    return NextResponse.json({ questions, count: questions.length })
  } catch (error: any) {
    console.error('Quiz error:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate quiz' }, { status: 500 })
  }
}