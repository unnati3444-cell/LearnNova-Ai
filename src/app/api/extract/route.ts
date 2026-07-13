import { NextRequest, NextResponse } from 'next/server'
import { generateAI } from '@/lib/ai'

/* ─────────────────────────────────────────────
   Extract YouTube ID (supports all formats)
───────────────────────────────────────────── */
function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url)

    if (parsed.searchParams.get('v')) {
      return parsed.searchParams.get('v')
    }

    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.split('/')[1]
    }

    if (parsed.pathname.includes('/shorts/')) {
      return parsed.pathname.split('/shorts/')[1].split('/')[0]
    }

    if (parsed.pathname.includes('/live/')) {
      return parsed.pathname.split('/live/')[1].split('/')[0]
    }

    if (parsed.pathname.includes('/embed/')) {
      return parsed.pathname.split('/embed/')[1].split('/')[0]
    }

    return null
  } catch {
    return null
  }
}

/* ─────────────────────────────────────────────
   Fetch YouTube Metadata (Reliable)
───────────────────────────────────────────── */
async function fetchYouTubeMetadata(videoId: string) {
  let title = `YouTube Video (${videoId})`
  let description = ''
  let keywords = ''

  // ✅ Get title via official oEmbed
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
          Accept: 'application/json',
        },
      }
    )

    if (oembedRes.ok) {
      const data = await oembedRes.json()
      if (data.title) title = data.title
    }
  } catch {
    console.warn('[YouTube] oEmbed failed')
  }

  // ✅ Get description + keywords
  try {
    const res = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        },
      }
    )

    const html = await res.text()

    const descMatch = html.match(
      /<meta property="og:description" content="([^"]*)"/
    )
    if (descMatch) {
      description = descMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .slice(0, 3000)
    }

    const keywordsMatch = html.match(
      /<meta name="keywords" content="([^"]+)"/
    )
    if (keywordsMatch) {
      keywords = keywordsMatch[1]
    }
  } catch {
    console.warn('[YouTube] metadata scrape failed')
  }

  return { title, description, keywords }
}

/* ─────────────────────────────────────────────
   AI Fallback Content Generator
───────────────────────────────────────────── */
async function generateContentFromMetadata(
  title: string,
  description: string,
  keywords: string,
  videoId: string
) {
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

Only use information reasonably inferred from the metadata.
Do NOT fabricate unrelated facts.

Generate at least 300 words.`

  const { text } = await generateAI({ prompt, maxTokens: 4096 })
  return text
}

/* ─────────────────────────────────────────────
   Main API Route
───────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const { type, url } = await req.json()

    let content = ''
    let title = ''
    let generatedFromMetadata = false

    // ───────── Website ─────────
    if (type === 'website') {
      const res = await fetch(url)
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

    // ───────── YouTube ─────────
    else if (type === 'youtube') {
      const videoId = extractYouTubeId(url)

      if (!videoId) {
        return NextResponse.json(
          { error: 'Invalid YouTube URL format.' },
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
        // ✅ Fallback to metadata + AI
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
          error.message || 'Failed to extract content.',
      },
      { status: 500 }
    )
  }
}