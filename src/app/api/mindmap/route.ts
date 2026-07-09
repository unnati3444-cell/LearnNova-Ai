import { NextRequest, NextResponse } from 'next/server'
import { generateAI, stripFences } from '@/lib/ai'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { sources, instructions } = await req.json()

    if (!sources || sources.length === 0)
      return NextResponse.json({ error: 'No sources provided' }, { status: 400 })

    const context = sources
      .map((s: any, i: number) => `--- SOURCE ${i + 1}: ${s.name} ---\n${s.content || ''}`)
      .join('\n\n')
      .slice(0, 80000)

    const customBlock = instructions
      ? `\nCUSTOM INSTRUCTIONS (follow precisely):\n${instructions}\n`
      : ''

    const prompt = `Analyze the following study material and produce a mind map as JSON.

Rules:
- ONE root topic capturing the overall subject.
- 6-10 main branches (level 1) — cover major themes, concepts, definitions, types, laws, and examples. Spread evenly.
- EVERY branch MUST have exactly 2-4 children (level 2). Zero children is NOT allowed.
- Children must contain real content from the material: definitions, types, features, facts, formula parts. NOT generic sub-topic names.
- Node labels: 3-7 words max. No full sentences.
- Do NOT dump all nodes into one branch. Distribute evenly.
- Only use content from the sources — do not invent.
${customBlock}
Respond ONLY with valid JSON, no markdown, no backticks:
{
  "root": "Central Topic",
  "branches": [
    { "label": "Branch Label", "children": ["Child 1", "Child 2", "Child 3"] }
  ]
}

SOURCE MATERIAL:
${context}`

    const { text } = await generateAI({ prompt, maxTokens: 4096, jsonMode: true })
    const cleaned = stripFences(text)

    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Mind map JSON parse failed:', cleaned.slice(0, 300))
      return NextResponse.json({ error: 'Failed to parse mind map. Please try again.' }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('Mind map error:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate mind map' }, { status: 500 })
  }
}