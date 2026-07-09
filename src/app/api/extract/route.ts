import { NextRequest, NextResponse } from 'next/server'
import { generateAI } from '@/lib/ai'

// ── YouTube metadata extractor ─────────────────────────────────────────────────
async function fetchYouTubeMetadata(videoId: string): Promise<{ title: string; description: string; keywords: string }> {
  try {
    const res  = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    const html = await res.text()

    // Title
    const titleMatch = html.match(/"title":"([^"]+)"/)
    const title = titleMatch ? titleMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/') : `YouTube Video (${videoId})`

    // Description
    const descMatch = html.match(/"shortDescription":"([\s\S]*?)"(?:,"isCrawlable)/)
    let description = ''
    if (descMatch) {
      description = descMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\u0026/g, '&')
        .replace(/\\\//g, '/')
        .replace(/\\"/g, '"')
        .slice(0, 3000)
    }

    // Keywords / tags
    const keywordsMatch = html.match(/<meta name="keywords" content="([^"]+)"/)
    const keywords = keywordsMatch ? keywordsMatch[1] : ''

    return { title, description, keywords }
  } catch {
    return { title: `YouTube Video (${videoId})`, description: '', keywords: '' }
  }
}

// ── AI fallback for no-transcript videos ──────────────────────────────────────
async function generateContentFromMetadata(
  title: string,
  description: string,
  keywords: string,
  videoId: string
): Promise<string> {
  const prompt = `A student has added a YouTube video as a study source. The video has no transcript available, so you must generate useful study content based on the available metadata below.

VIDEO TITLE: ${title}
VIDEO DESCRIPTION: ${description || '(no description available)'}
VIDEO KEYWORDS/TAGS: ${keywords || '(none)'}
VIDEO URL: https://www.youtube.com/watch?v=${videoId}

Based on this information, generate comprehensive study notes covering:
1. What this video is likely about (topic overview)
2. Key concepts, terms, or ideas mentioned in the title/description
3. Any specific facts, names, dates, or figures mentioned
4. Important points a student should know about this topic
5. Context and background of the subject

Write in clear paragraphs as if explaining the topic to a student. Be as detailed as possible using the available information. If the description contains specific information, prioritise that. Do not make up facts not suggested by the metadata — stick to what can be reasonably inferred.

Generate at least 300 words of study content.`

  try {
    const { text } = await generateAI({ prompt, maxTokens: 4096 })
    return text
  } catch {
    // Last resort — just return the raw metadata as content
    return `Video: ${title}\n\nDescription: ${description}\n\nKeywords: ${keywords}`
  }
}

export async function POST(req: NextRequest) {
  try {
    const { type, url } = await req.json()

    let content = ''
    let title   = ''

    // ── Website ───────────────────────────────────────────────────────────────
    if (type === 'website') {
      const res  = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      })
      const html = await res.text()

      const titleMatch = html.match(/<title>(.*?)<\/title>/i)
      title = titleMatch ? titleMatch[1] : url

      content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15000)

    // ── YouTube ───────────────────────────────────────────────────────────────
    } else if (type === 'youtube') {
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
      const videoId = videoIdMatch ? videoIdMatch[1] : null

      if (!videoId) {
        return NextResponse.json({ error: 'Invalid YouTube URL. Please check the link and try again.' }, { status: 400 })
      }

      // ── Try transcript first ──────────────────────────────────────────────
      let transcriptSuccess = false
      try {
        const { YoutubeTranscript } = await import('youtube-transcript')
        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId)

        if (transcriptItems && transcriptItems.length > 0) {
          content = transcriptItems.map((item: any) => item.text).join(' ')

          // Get proper title from metadata
          const meta = await fetchYouTubeMetadata(videoId)
          title = meta.title
          transcriptSuccess = true
          console.log(`[YouTube] Transcript fetched successfully for ${videoId}`)
        }
      } catch (transcriptError: any) {
        console.log(`[YouTube] No transcript available for ${videoId}: ${transcriptError.message}`)
        // Don't throw — fall through to metadata fallback below
      }

      // ── Fallback: use metadata + AI ───────────────────────────────────────
      if (!transcriptSuccess) {
        console.log(`[YouTube] Using metadata fallback for ${videoId}`)
        const meta = await fetchYouTubeMetadata(videoId)
        title = meta.title

        if (!meta.description && !meta.keywords) {
          // Truly nothing to work with
          return NextResponse.json({
            error: 'This video has no transcript and no description. Please try a different video or paste the content manually.',
          }, { status: 400 })
        }

        content = await generateContentFromMetadata(
          meta.title,
          meta.description,
          meta.keywords,
          videoId
        )

        // Prepend a note so AI tools know context
        content = `[Note: This video had no transcript. Content below is generated from the video title, description, and tags.]\n\n${content}`
      }

    } else {
      return NextResponse.json({ error: 'Unsupported source type.' }, { status: 400 })
    }

return NextResponse.json({
  content,
  title,
  generatedFromMetadata: content.startsWith('[Note: This video had no transcript')
})
  } catch (error: any) {
    console.error('Extraction error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to extract content. Please try again.',
    }, { status: 500 })
  }
}