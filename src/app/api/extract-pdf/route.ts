import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(buffer)
    const { text } = await extractText(pdf, { mergePages: true })

    const fullText = Array.isArray(text) ? text.join('\n') : text

    // Debug log so we can see exactly what got extracted in the terminal
    console.log('--- PDF EXTRACTION DEBUG ---')
    console.log('File:', file.name)
    console.log('Extracted length:', fullText.length)
    console.log('First 500 chars:', fullText.slice(0, 500))
    console.log('--- END DEBUG ---')

    if (!fullText || fullText.trim().length === 0) {
      return NextResponse.json({ error: 'PDF text extraction returned empty content. This PDF may be image-based or have a non-standard encoding.' }, { status: 400 })
    }

    return NextResponse.json({
      content: fullText.slice(0, 500000),
      title: file.name,
    })
  } catch (error: any) {
    console.error('PDF extraction error:', error)
    return NextResponse.json({ error: error.message || 'PDF extraction failed' }, { status: 500 })
  }
}