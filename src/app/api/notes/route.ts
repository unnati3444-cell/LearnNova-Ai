import { NextRequest, NextResponse } from 'next/server'
import { generateAI, generateAILong } from '@/lib/ai'

function cleanTranscript(text: string): string {
  if (!text) return ''

  return text
    // Remove timestamps like 00:01, 1:23, 01:02:03
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, '')

    // Remove bracket tags like [Music], [Applause]
    .replace(/\[[^\]]+\]/g, '')

    // Remove common filler phrases (Hindi + English)
    .replace(/हां जी दोस्तों.*?(?=\.)/gi, '')
    .replace(/दोस्तों.*?(?=\.)/gi, '')
    .replace(/सुनो मेरी बात.*?(?=\.)/gi, '')
    .replace(/please listen.*?(?=\.)/gi, '')
    .replace(/guys.*?(?=\.)/gi, '')

    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

export const maxDuration = 60
export const runtime = 'nodejs'
const CHUNK_SIZE = 100000

// A chunk's notes should be at least this fraction of the chunk's char length.
// This is proportional, not a fixed page count — works for an 8-page PDF,
// a 132-page PDF, or a long lecture transcript equally.
const MIN_OUTPUT_RATIO = 0.35

function buildPrompt(content: string, focus?: string, chunkLabel?: string): string {
  const focusBlock = focus ? `\nFOCUS INSTRUCTION: ${focus}\n` : ''
  const chunkBlock = chunkLabel
    ? `\nNote: This is ${chunkLabel} of the document.\n`
    : ''

  return `You are generating CLASS NOTES for a CA Inter Law student.

${focusBlock}
${chunkBlock}

STRICT RULES:

- Translate Hindi explanations into formal legal English.
- Write structured classroom notes.
- No storytelling.
- No motivational language.
- No generic introductions.
- Convert Hindi explanation into proper English legal notes.
- Remove filler speech (e.g., "friends", "listen carefully").
- Use ONLY the transcript content provided.
- Do NOT add outside knowledge.
- Keep sentences short and exam-focused.

FORMAT STRUCTURE:

📚 Main Topic  
📌 Sub-topic  
🔑 Section Number (if mentioned)  
📝 Definition  
⭐ Important Concept  
⚖ Case Law (if mentioned)  
• Bullet Points

IMPORTANT:
- Use bullet points.
- Avoid long paragraphs.
- No repetition.
- Only extract actual teaching content.
- Preserve Section numbers exactly as spoken.
- Capture examples explained in class.

SOURCE MATERIAL:
${content}`
}

function buildContinuationPrompt(previousNotes: string, remainingContent: string, focus?: string): string {
  const focusBlock = focus ? `\nFOCUS INSTRUCTION: ${focus}\n` : ''
  const tail = previousNotes.slice(-1500)
  return `You were writing detailed study notes and got cut off before finishing. Continue EXACTLY where you left off — do not repeat anything, do not restart the chapter, do not add any preamble.

Here is the END of what you already wrote (for context only — do not repeat it):
"""
${tail}
"""
${focusBlock}
Continue the notes now, picking up immediately after that point, using the same emoji-marker format:
📚 📌 ⭐ 💡 📝 🔑

REMAINING SOURCE MATERIAL TO COVER:
${remainingContent}`
}

async function generateWithContinuation(
  content: string,
  focus?: string,
  chunkLabel?: string,
  maxContinuations = 3
): Promise<string> {
  // Proportional minimum: notes should be at least MIN_OUTPUT_RATIO of the
  // source chunk's length. This triggers the one-retry-with-sharper-prompt
  // logic inside generateAILong if the model comes back too short.
  const minChars = Math.floor(content.length * MIN_OUTPUT_RATIO)

  const { text: initialText, provider, underLength } = await generateAILong({
    prompt: buildPrompt(content, focus, chunkLabel),
    maxTokens: 65536,
    minChars,
  })

  let text = initialText
  let continuations = 0

  while (
    !text.includes('===END OF SECTION===') &&
    text.length > 2000 &&
    continuations < maxContinuations
  ) {
    continuations++
    console.log(`[Notes] Continuation ${continuations} (provider was ${provider})`)
    try {
      const { text: contText } = await generateAI({
        prompt: buildContinuationPrompt(text, content, focus),
        maxTokens: 8192,
      })
      text += '\n\n' + contText
      if (text.includes('===END OF SECTION===')) break
    } catch {
      break
    }
  }

  let cleaned = text.replace('===END OF SECTION===', '').trim()

  // If even after the retry inside generateAILong the output is still short,
  // flag it visibly instead of silently losing content or burning more calls.
  if (underLength) {
    const label = chunkLabel ? ` (${chunkLabel})` : ''
    cleaned += `\n\n⚠️ This section${label} may be incomplete — the AI's response was shorter than expected for the amount of source material. Consider re-uploading this part separately for more detailed notes.\n`
  }

  return cleaned
}

export async function POST(req: NextRequest) {
  try {
    const { sources, focus } = await req.json()

    if (!sources || sources.length === 0)
      return NextResponse.json({ error: 'No sources provided' }, { status: 400 })

    const rawContent = sources
  .map((s: any, i: number) =>
    `--- SOURCE ${i + 1}: ${s.name} ---\n${s.content || ''}`
  )
  .join('\n\n')
  .slice(0, 120000)

const fullContent = cleanTranscript(rawContent)

    let finalNotes = ''

    if (fullContent.length <= CHUNK_SIZE) {
      finalNotes = await generateWithContinuation(fullContent, focus)
    } else {
      const chunks: string[] = []
      for (let i = 0; i < fullContent.length; i += CHUNK_SIZE) {
        chunks.push(fullContent.slice(i, i + CHUNK_SIZE))
      }

      const parts: string[] = []
      for (let i = 0; i < chunks.length; i++) {
        const part = await generateWithContinuation(
          chunks[i],
          focus,
          `Part ${i + 1} of ${chunks.length}`
        )
        parts.push(part)
      }
      finalNotes = parts.join('\n\n')
    }

    return NextResponse.json({ notes: finalNotes })
  } catch (error: any) {
    console.error('Notes error:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate notes' }, { status: 500 })
  }
}