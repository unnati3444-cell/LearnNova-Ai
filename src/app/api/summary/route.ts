import { NextRequest, NextResponse } from 'next/server'
import { generateAI } from '@/lib/ai'

export const maxDuration = 120

const CHUNK_SIZE = 100000
const MAX_CHUNKS = 5

function buildPrompt(content: string, focus?: string, chunkLabel?: string): string {
  const focusBlock = focus ? `\nFOCUS INSTRUCTION: ${focus}\n` : ''
  const chunkBlock = chunkLabel
    ? `\nNote: This is ${chunkLabel} of the document. Cover all topics present in this part.\n`
    : ''
  return `You are creating concise, exam-ready summary notes for a CA Inter / competitive exam student.
${focusBlock}${chunkBlock}
Rules:
- Organise notes under topic headings written in **bold** on their own line (e.g. **Topic Name**).
- Under each heading, list key points as bullet points starting with "- ".
- Keep each bullet crisp: facts, definitions, numbers, key terms. No long paragraphs.
- Cover ALL major topics from the content. Do not skip anything.
- Only use content from the sources — do not add outside information.
- Do NOT use markdown headers (#). Use only **bold** for headings and "- " for bullets.

SOURCE MATERIAL:
${content}`
}

export async function POST(req: NextRequest) {
  try {
    const { sources, focus } = await req.json()

    if (!sources || sources.length === 0)
      return NextResponse.json({ error: 'No sources provided' }, { status: 400 })

    const fullContent = sources
      .map((s: any, i: number) => `--- SOURCE ${i + 1}: ${s.name} ---\n${s.content || ''}`)
      .join('\n\n')

    let finalSummary = ''

    if (fullContent.length <= CHUNK_SIZE) {
      const { text } = await generateAI({
        prompt: buildPrompt(fullContent, focus),
        maxTokens: 8192,
      })
      finalSummary = text
    } else {
      const chunks: string[] = []
      const cap = Math.min(fullContent.length, CHUNK_SIZE * MAX_CHUNKS)
      for (let i = 0; i < cap; i += CHUNK_SIZE) {
        chunks.push(fullContent.slice(i, i + CHUNK_SIZE))
      }

      const parts: string[] = []
      for (let i = 0; i < chunks.length; i++) {
        const { text } = await generateAI({
          prompt: buildPrompt(chunks[i], focus, `Part ${i + 1} of ${chunks.length}`),
          maxTokens: 8192,
        })
        parts.push(text)
      }
      finalSummary = parts.join('\n\n')
    }

    return NextResponse.json({ summary: finalSummary })
  } catch (error: any) {
    console.error('Summary error:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate summary' }, { status: 500 })
  }
}