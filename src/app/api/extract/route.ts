import { NextRequest, NextResponse } from 'next/server'
import { generateAI } from '@/lib/ai'

// ─────────────────────────────────────────────────────────────
// YouTube Metadata (Stable Version using oEmbed)
// ─────────────────────────────────────────────────────────────
async function fetchYouTubeMetadata(videoId: string): Promise<{
  title: string
  description: string
  keywords: string
}> {
  let title = `YouTube Video (${videoId})`
  let description = ''
  let keywords = ''

  // ✅ 1. Get correct title using official oEmbed API
  try {
    const oembedRes = await fetch(
  `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
  {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Accept': 'application/json',
    },
  }
)

if (!oembedRes.ok) {
  throw new Error('oEmbed failed')
}

const data = await oembedRes.json()

if (data.title) {
  title = data.title
  
  console.log('[YouTube] oEmbed status:', oembedRes.status)
}
    if (oembedRes.ok) {
      const data = await oembedRes.json()
      if (data.title) {
        title = data.title
      }
    }
  } catch {
    console.warn('[YouTube] oEmbed title fetch failed')
  }

  // ✅ 2. Get description + keywords via page scrape
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    const html = await res.text()

    // ✅ og:description (more reliable than JSON parsing)
    const ogDescMatch = html.match(
      /<meta property="og:description" content="([^"]*)"/
    )
    if (ogDescMatch && ogDescMatch[1]) {
      description = ogDescMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .slice(0, 3000)
    }

    // ✅ keywords
    const keywordsMatch = html.match(
      /<meta name="keywords" content="([^"]+)"/
    )
    if (keywordsMatch) {
      keywords = keywordsMatch[1]
    }
  } catch {
    console.warn('[YouTube] Metadata scrape failed')
  }

  return { title, description, keywords }
}

// ─────────────────────────────────────────────────────────────
// AI Fallback Generator
// ─────────────────────────────────────────────────────────────
async function generateContentFromMetadata(
  title: string,
  description: string,
  keywords: string,
  videoId: string
): Promise<string> {
  const prompt = `A student added a YouTube video as a study source. The video has no transcript available.

VIDEO TITLE: ${title}
VIDEO DESCRIPTION: ${description || '(no description available)'}
VIDEO KEYWORDS: ${keywords || '(none)'}
VIDEO URL: https://www.youtube.com/watch?v=${videoId}

Generate structured study notes covering:
1. Topic overview
2. Key concepts
3. Important terms
4. Definitions (if applicable)
5. Context and background

Only use information that can be reasonably inferred from the metadata.
Do NOT fabricate unrelated facts.

Generate at least 300 words.`

  try {
    const { text } = await generateAI({
      prompt,
      maxTokens: 4096,
    })
    return text
  } catch {
    return `Video: ${title}\n\nDescription: ${description}\n\nKeywords: ${keywords}`
  }
}

// ─────────────────────────────────────────────────────────────
// Main API Route
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { type, url } = await req.json()

    let content = ''
    let title = ''
    let generatedFromMetadata = false

    // ───────────────── WEBSITE ─────────────────
    if (type === 'website') {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
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
    }

    // ───────────────── YOUTUBE ─────────────────
    else if (type === 'youtube') {
      const videoIdMatch = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/
      )
      const videoId = videoIdMatch ? videoIdMatch[1] : null

      if (!videoId) {
        return NextResponse.json(
          { error: 'Invalid YouTube URL.' },
          { status: 400 }
        )
      }

      // ✅ Try transcript first
      try {
        const { YoutubeTranscript } = await import('youtube-transcript')
        const transcriptItems =
          await YoutubeTranscript.fetchTranscript(videoId)

        if (transcriptItems && transcriptItems.length > 0) {
          content = transcriptItems
            .map((item: any) => item.text)
            .join(' ')

          const meta = await fetchYouTubeMetadata(videoId)
          title = meta.title
        }
      } catch {
        // ✅ No transcript — fallback
        const meta = await fetchYouTubeMetadata(videoId)
        title = meta.title

        if (!meta.description && !meta.keywords) {
          return NextResponse.json(
            {
              error:
                'This video has no transcript and no usable metadata.',
            },
            { status: 400 }
          )
        }

        content = await generateContentFromMetadata(
          meta.title,
          meta.description,
          meta.keywords,
          videoId
        )

        content =
          `[Note: This video had no transcript. Content below is generated from video metadata.]\n\n` +
          content

        generatedFromMetadata = true
      }
    }

    else {
      return NextResponse.json(
        { error: 'Unsupported source type.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      content,
      title,
      generatedFromMetadata,
    })
  } catch (error: any) {
    console.error('Extraction error:', error)
    return NextResponse.json(
      {
        error:
          error.message || 'Failed to extract content. Please try again.',
      },
      { status: 500 }
    )
  }
}