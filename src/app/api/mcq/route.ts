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
- Questions test basic recall and definitions
- Avoid ambiguous wording`
  }
  if (difficulty === 'hard') {
    return `DIFFICULTY: Hard
- Wrong options should be very plausible and close to the correct answer
- Questions should test deep understanding, not just recall
- Include nuanced distinctions between options
- Some questions can combine multiple concepts`
  }
  return `DIFFICULTY: Medium
- Wrong options should be plausible but distinguishable to someone who studied
- Mix of recall and understanding questions`
}

function buildPrompt(content: string, count: number, difficulty: Difficulty, focus?: string): string {
  const focusBlock = focus ? `\nFOCUS INSTRUCTION: ${focus}\n` : ''
  return `You are creating a multiple choice quiz for a student studying for exams.
${focusBlock}
${difficultyBlock(difficulty)}

Generate exactly ${count} questions from the source material below.

Mix these question types naturally:
- Factual: "What was X?" or "Which of the following is Y?"
- Conceptual: "Why did X happen?" or "What is the significance of Y?"
- True/False: "True or False: X caused Y" (include roughly 20-30% as True/False)
- Applied: "If X happens, what would result?"

Rules for questions:
- Each question must be clear and unambiguous
- Questions must be answerable ONLY from the source material
- No trick questions
- Cover ALL major topics — spread evenly

Rules for options:
- Regular MCQ: exactly 4 options labeled A, B, C, D
- True/False: exactly 2 options — values must be "True" and "False"
- Only ONE correct answer per question

Rules for explanation:
- 1-2 sentences explaining why the correct answer is right
- Use only information from the sources

Return ONLY valid JSON — no markdown, no code fences, no explanation.

Return this exact format:
[
  {
    "id": "q1",
    "type": "mcq",
    "question": "What triggered the 2008 financial crisis?",
    "options": ["Collapse of the US housing bubble", "Rising oil prices", "Government overspending", "Trade war with China"],
    "correct": 0,
    "explanation": "The 2008 crisis was triggered by the collapse of the US housing bubble, which caused widespread mortgage defaults and massive bank losses."
  },
  {
    "id": "q2",
    "type": "truefalse",
    "question": "True or False: Lehman Brothers was bailed out by the US government in 2008.",
    "options": ["True", "False"],
    "correct": 1,
    "explanation": "Lehman Brothers was NOT bailed out — it filed for bankruptcy in September 2008."
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
      console.error('Failed to parse MCQ JSON:', cleaned.slice(0, 300))
      return NextResponse.json({ error: 'Failed to parse questions. Please try again.' }, { status: 500 })
    }

    if (!Array.isArray(questions) || questions.length === 0)
      return NextResponse.json({ error: 'No questions generated. Please try again.' }, { status: 500 })

    return NextResponse.json({ questions, count: questions.length })
  } catch (error: any) {
    console.error('MCQ error:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate questions' }, { status: 500 })
  }
}