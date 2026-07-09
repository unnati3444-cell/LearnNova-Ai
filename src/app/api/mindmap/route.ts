import { NextRequest, NextResponse } from 'next/server'
import { generateAI, stripFences } from '@/lib/ai'

export const maxDuration = 120

function buildPrompt(context: string, instructions?: string, retry = false) {
  const customBlock = instructions
    ? `\nCUSTOM INSTRUCTIONS (follow precisely):\n${instructions}\n`
    : ''

  const retryBlock = retry
    ? `\nIMPORTANT: Your previous response was invalid JSON. You MUST return strictly valid JSON with properly closed brackets and quotes.\n`
    : ''

  return `Analyze the following study material and produce a mind map as JSON.

Rules:
- ONE root topic capturing the overall subject.
- 6-10 main branches (level 1) — cover major themes, concepts, definitions, types, laws, and examples. Spread evenly.
- EVERY branch MUST have  2-4 children (level 2). Zero children is NOT allowed.
- Children must contain real content from the material: definitions, types, features, facts, formula parts. NOT generic sub-topic names.
- Node labels: 3-7 words max. 
- there can be full sentences in case of definition, meaning.
- Do NOT dump all nodes into one branch. Distribute evenly.
- Only use content from the sources — do not invent.

${customBlock}
${retryBlock}

Respond ONLY with valid JSON. No markdown. No explanation.

Format:
{
  "root": "Central Topic",
  "branches": [
    { "label": "Branch Label", "children": ["Child 1", "Child 2"] }
  ]
}

SOURCE MATERIAL:
${context}`
}

export async function POST(req: NextRequest) {
  try {
    const { sources, instructions } = await req.json()

    if (!sources || sources.length === 0)
      return NextResponse.json({ error: 'No sources provided' }, { status: 400 })

    const context = sources
      .map((s: any, i: number) =>
        `--- SOURCE ${i + 1}: ${s.name} ---\n${s.content || ''}`
      )
      .join('\n\n')
      .slice(0, 60000) // slightly smaller context

    // First attempt
    const { text } = await generateAI({
      prompt: buildPrompt(context, instructions, false),
      maxTokens: 2000, // reduced from 4096
      jsonMode: true,
    })

    let cleaned = stripFences(text)

    try {
      return NextResponse.json(JSON.parse(cleaned))
    } catch {
      console.warn('Mind map JSON invalid. Retrying with stricter prompt...')

      // Retry once with stricter instruction
      const retryResult = await generateAI({
        prompt: buildPrompt(context, instructions, true),
        maxTokens: 1500,
        jsonMode: true,
      })

      cleaned = stripFences(retryResult.text)

      try {
        return NextResponse.json(JSON.parse(cleaned))
      } catch {
        console.error('Mind map JSON parse failed after retry:', cleaned.slice(0, 300))
        return NextResponse.json(
          { error: 'Mind map generation failed. Please try again.' },
          { status: 500 }
        )
      }
    }
  } catch (error: any) {
    console.error('Mind map error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate mind map' },
      { status: 500 }
    )
  }
}