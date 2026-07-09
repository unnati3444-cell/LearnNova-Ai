import { NextRequest, NextResponse } from 'next/server'
import { generateAI } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const { question, sources } = await req.json()

    if (!sources || sources.length === 0) {
      return NextResponse.json({ answer: 'Please select at least one source before asking questions.' })
    }

    const context = sources
      .map((s: any, i: number) => `--- SOURCE ${i + 1}: ${s.name} ---\n${s.content || '(no content extracted)'}`)
      .join('\n\n')
      .slice(0, 100000)

    const prompt = `You are a study assistant. Answer ONLY using the information in the SOURCES below — never use outside knowledge. If the answer isn't in the sources, say "I couldn't find this in your uploaded sources."

Formatting rules:
- Use markdown: short bullet points or numbered lists for multi-part answers, **bold** for key terms.
- Do NOT write "according to Source 1/2" after every sentence — keep the answer clean and natural to read.
- Only mention a specific source by name if the person directly asks where something came from, or if sources genuinely disagree.
- Keep answers focused and skimmable — avoid long unbroken paragraphs.

Special instruction for "important topics" or "what's likely to come in exams" type questions:
- Since you cannot search the web for previous year papers, base importance on signals INSIDE the source itself: topics that are repeated multiple times, given detailed multi-paragraph explanations, presented with worked examples/formulas, listed under headings like "Important", "Key Points", "Summary", or appear in bold/structured lists in the source.
- Clearly say you're inferring importance from how much emphasis the source itself gives each topic — not from actual past exam data, since you don't have access to that.
- Structure the answer as a ranked or grouped list of topics with a one-line reason for each.

SOURCES:
${context}

QUESTION: ${question}

ANSWER:`

    const { text } = await generateAI({ prompt, maxTokens: 4096 })
    return NextResponse.json({ answer: text })
  } catch (error: any) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { answer: 'All AI providers are currently unavailable. Please try again in a moment.' },
      { status: 500 }
    )
  }
}