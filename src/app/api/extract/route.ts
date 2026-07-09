import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { type, url } = await req.json()

    let content = ''
    let title = ''

    if (type === 'website') {
      const res = await fetch(url)
      const html = await res.text()

      // Extract title
      const titleMatch = html.match(/<title>(.*?)<\/title>/i)
      title = titleMatch ? titleMatch[1] : url

      // Strip HTML tags to get rough text content
      content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15000) // limit size

    } else if (type === 'youtube') {
      // Extract video ID
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
      const videoId = videoIdMatch ? videoIdMatch[1] : null

      if (!videoId) {
        return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
      }

      const { YoutubeTranscript } = await import('youtube-transcript')
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId)
      content = transcriptItems.map((item: any) => item.text).join(' ')
      title = `YouTube Video (${videoId})`

    } else {
      return NextResponse.json({ error: 'Unsupported type for URL extraction' }, { status: 400 })
    }

    return NextResponse.json({ content, title })
  } catch (error: any) {
    console.error('Extraction error:', error)
    return NextResponse.json({ error: error.message || 'Extraction failed' }, { status: 500 })
  }
}