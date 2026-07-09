import { NextRequest, NextResponse } from 'next/server'
import { generateAI, stripFences } from '@/lib/ai'

export const maxDuration = 120

function buildPrompt(content: string, count: number, focus?: string): string {
  const focusBlock = focus ? `\nFOCUS INSTRUCTION: ${focus}\n` : ''
  return `You are creating flashcards for a student studying for exams.
${focusBlock}
Generate exactly ${count} flashcards from the source material below.

Mix these types naturally based on content:
- Term → Definition (e.g. front: "Subprime Mortgage", back: "A loan given to borrowers with poor credit history at higher interest rates")
- Concept → Explanation (e.g. front: "What triggered the 2008 financial crisis?", back: "Collapse of the US housing bubble, causing mortgage defaults and bank losses")
- Person/Event → Significance (e.g. front: "Lehman Brothers collapse (2008)", back: "Major investment bank that filed for bankruptcy, triggering a global credit freeze")
- Cause → Effect (e.g. front: "What did the Dodd-Frank Act introduce?", back: "Stricter banking regulations including the Volcker Rule, passed in 2010 after the financial crisis")

Rules:
- Front: short and specific — a term, question, or concept (max 15 words)
- Back: clear and complete answer (2-5 sentences or a crisp definition)
- Cover the MOST important concepts from ALL sources
- No duplicate topics
- Do not number the cards
- Return ONLY valid JSON — no markdown, no code fences, no explanation

Return this exact format:
[
  {"id": "c1", "front": "...", "back": "..."},
  {"id": "c2", "front": "...", "back": "..."}
]

SOURCE MATERIAL:
${content}`
}

export async function POST(req: NextRequest) {
  try {
    const { sources, count = 10, focus } = await req.json()

    if (!sources || sources.length === 0)
      return NextResponse.json({ error: 'No sources provided' }, { status: 400 })

    const fullContent = sources
      .map((s: any, i: number) => `--- SOURCE ${i + 1}: ${s.name} ---\n${s.content || ''}`)
      .join('\n\n')
      .slice(0, 80000)

    const { text } = await generateAI({
      prompt: buildPrompt(fullContent, count, focus),
      maxTokens: 8192,
      jsonMode: true,
    })

    const cleaned = stripFences(text)

    let cards: any[]
    try {
      cards = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse flashcards JSON:', cleaned.slice(0, 300))
      return NextResponse.json({ error: 'Failed to parse flashcards. Please try again.' }, { status: 500 })
    }

    if (!Array.isArray(cards) || cards.length === 0)
      return NextResponse.json({ error: 'No flashcards generated. Please try again.' }, { status: 500 })

    return NextResponse.json({ cards })
  } catch (error: any) {
    console.error('Flashcards error:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate flashcards' }, { status: 500 })
  }
}