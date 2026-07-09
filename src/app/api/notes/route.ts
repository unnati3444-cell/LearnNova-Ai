import { NextRequest, NextResponse } from 'next/server'
import { generateAI, generateAILong } from '@/lib/ai'

export const maxDuration = 120

const CHUNK_SIZE = 100000

// A chunk's notes should be at least this fraction of the chunk's char length.
// This is proportional, not a fixed page count — works for an 8-page PDF,
// a 132-page PDF, or a long lecture transcript equally.
const MIN_OUTPUT_RATIO = 0.35

function buildPrompt(content: string, focus?: string, chunkLabel?: string): string {
  const focusBlock = focus ? `\nFOCUS INSTRUCTION: ${focus}\n` : ''
  const chunkBlock = chunkLabel
    ? `\nNote: This is ${chunkLabel} of the document. Cover EVERY topic, chapter, and section in this part with full detail. Do not skip any chapter even if it appears near the end of this chunk.\n`
    : ''

  return `You are creating COMPREHENSIVE, DETAILED study notes for a student — like a thorough set of handwritten class notes that captures everything from the source material.

FIRST AND MOST IMPORTANT — SKIP ALL OF THE FOLLOWING completely, do not include them in notes:
- Preface, foreword, introduction pages
- Disclaimer, copyright notice, ISBN, printing info
- Editorial board, content writers, academic coordinator names
- Publisher information, printer details, edition info
- Table of contents, syllabus listing, course structure pages
- Acknowledgements, reviewer names
- Any page that is clearly administrative/publishing metadata
- "Check Your Progress" question blocks — do NOT include these in the notes

START notes only from the FIRST actual chapter, unit, or topic of study content.
${focusBlock}${chunkBlock}

Use ONLY these emoji markers for structure (each on its own line, no ** around the text after the emoji):

📚 Main chapter or unit heading
📌 Subtopic or section heading
⭐ Important: crucial fact, rule, or must-remember point
💡 Note: extra context, exception, background, or tip
📝 Definition: Term → what it means
🔑 Key Terms: important names, terms, sections (comma separated)

For content between headings: write in FULL explanatory paragraphs. Like a teacher explaining everything to a student. Do NOT use bullet points for main content.

CRITICAL RULES FOR DETAIL, LENGTH, AND COMPLETENESS:
- Every subtopic (📌) must have at least 2-3 full paragraphs of explanation
- Include EVERY example, every case, every name, every date, every concept
- Do NOT compress or summarize — capture everything in detail, proportional to how much source content you were given
- If a chapter/story has multiple internal sections or parts, cover ALL of them
- Write headings as plain text after the emoji — do NOT wrap them in ** asterisks
- End your response with the line "===END OF SECTION===" only when you have FULLY covered every chapter in the provided source

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

    const fullContent = sources
      .map((s: any, i: number) => `--- SOURCE ${i + 1}: ${s.name} ---\n${s.content || ''}`)
      .join('\n\n')

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