import Groq from 'groq-sdk'
import OpenAI from 'openai'

// ── Clients ────────────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'LearnovaAI',
  },
})

// ── Gemini models in priority order ───────────────────────────────────────────
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]

// ── Groq models ────────────────────────────────────────────────────────────────
const GROQ_PRIMARY  = 'llama-3.3-70b-versatile'
const GROQ_FALLBACK = 'llama-3.1-8b-instant'

// ── OpenRouter models ──────────────────────────────────────────────────────────
const OR_PRIMARY  = 'meta-llama/llama-3.3-70b-instruct:free'
const OR_FALLBACK = 'qwen/qwen-2.5-72b-instruct:free'

// ── Groq char limits (free tier) ──────────────────────────────────────────────
const GROQ_PRIMARY_CHAR_LIMIT  = 20000  // safe under 12k TPM
const GROQ_FALLBACK_CHAR_LIMIT = 10000  // safe under 6k TPM

// ── Types ──────────────────────────────────────────────────────────────────────
export type AIOptions = {
  prompt: string
  maxTokens?: number
  temperature?: number
  jsonMode?: boolean
  minChars?: number  // if set, result will include underLength flag
}

export type AIResult = {
  text: string
  provider: string
  underLength?: boolean  // true if output was shorter than minChars
}

// ── Strip markdown fences ──────────────────────────────────────────────────────
export function stripFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

// ── Trim prompt to fit within char limit ──────────────────────────────────────
function trimPrompt(prompt: string, maxChars: number): string {
  if (prompt.length <= maxChars) return prompt

  const sourceMarkers = [
    'SOURCE MATERIAL:',
    'SOURCES:',
    'REMAINING SOURCE MATERIAL',
  ]

  let splitIndex = -1
  for (const marker of sourceMarkers) {
    const idx = prompt.indexOf(marker)
    if (idx !== -1) {
      splitIndex = idx
      break
    }
  }

  if (splitIndex === -1) {
    return prompt.slice(0, maxChars)
  }

  const header = prompt.slice(0, splitIndex)
  const body   = prompt.slice(splitIndex)
  const allowedBodyChars = maxChars - header.length - 200

  if (allowedBodyChars < 500) {
    return prompt.slice(0, maxChars)
  }

  return header + body.slice(0, allowedBodyChars) + '\n\n[Content trimmed to fit model limits]'
}

// ── Gemini call (single model) ─────────────────────────────────────────────────
async function callGemini(opts: AIOptions, model: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const m = genAI.getGenerativeModel({ model })
  const result = await m.generateContent({
    contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 8192,
      temperature: opts.temperature ?? 0.4,
    },
  })
  const text = result.response.text().trim()
  if (!text) throw new Error(`Empty response from Gemini (${model})`)
  return text
}

// ── Groq call ──────────────────────────────────────────────────────────────────
async function callGroq(opts: AIOptions, model: string, charLimit: number): Promise<string> {
  const trimmedPrompt = trimPrompt(opts.prompt, charLimit)
  const completion = await groq.chat.completions.create({
    model,
    messages: [{ role: 'user', content: trimmedPrompt }],
    max_tokens: Math.min(opts.maxTokens ?? 4096, 4096),
    temperature: opts.temperature ?? 0.4,
  })
  const text = completion.choices[0]?.message?.content?.trim() ?? ''
  if (!text) throw new Error(`Empty response from Groq (${model})`)
  return text
}

// ── OpenRouter call ────────────────────────────────────────────────────────────
async function callOpenRouter(opts: AIOptions, model: string): Promise<string> {
  const completion = await openrouter.chat.completions.create({
    model,
    messages: [{ role: 'user', content: opts.prompt }],
    max_tokens: opts.maxTokens ?? 8192,
    temperature: opts.temperature ?? 0.4,
  })
  const text = completion.choices[0]?.message?.content?.trim() ?? ''
  if (!text) throw new Error(`Empty response from OpenRouter (${model})`)
  return text
}

// ── Build full attempt chain ───────────────────────────────────────────────────
function buildAttempts(opts: AIOptions): Array<{ label: string; fn: () => Promise<string> }> {
  return [
    ...GEMINI_MODELS.map(model => ({
      label: `Gemini (${model})`,
      fn: () => callGemini(opts, model),
    })),
    {
      label: 'Groq (70b)',
      fn: () => callGroq(opts, GROQ_PRIMARY, GROQ_PRIMARY_CHAR_LIMIT),
    },
    {
      label: 'Groq (8b)',
      fn: () => callGroq(opts, GROQ_FALLBACK, GROQ_FALLBACK_CHAR_LIMIT),
    },
    {
      label: 'OpenRouter (llama)',
      fn: () => callOpenRouter(opts, OR_PRIMARY),
    },
    {
      label: 'OpenRouter (qwen)',
      fn: () => callOpenRouter(opts, OR_FALLBACK),
    },
  ]
}

// ── Build attempt chain for long generation (Notes) ───────────────────────────
function buildLongAttempts(opts: AIOptions): Array<{ label: string; fn: () => Promise<string> }> {
  const longOpts = { ...opts, maxTokens: opts.maxTokens ?? 65536 }
  return [
    ...GEMINI_MODELS.map(model => ({
      label: `Gemini (${model})`,
      fn: () => callGemini(longOpts, model),
    })),
    {
      label: 'OpenRouter (llama)',
      fn: () => callOpenRouter({ ...longOpts, maxTokens: 8192 }, OR_PRIMARY),
    },
    {
      label: 'OpenRouter (qwen)',
      fn: () => callOpenRouter({ ...longOpts, maxTokens: 8192 }, OR_FALLBACK),
    },
    {
      label: 'Groq (70b)',
      fn: () => callGroq({ ...longOpts, maxTokens: 4096 }, GROQ_PRIMARY, GROQ_PRIMARY_CHAR_LIMIT),
    },
    {
      label: 'Groq (8b)',
      fn: () => callGroq({ ...longOpts, maxTokens: 4096 }, GROQ_FALLBACK, GROQ_FALLBACK_CHAR_LIMIT),
    },
  ]
}

// ── Shared runner ──────────────────────────────────────────────────────────────
async function runAttempts(
  attempts: Array<{ label: string; fn: () => Promise<string> }>,
  tag: string,
  minChars?: number
): Promise<AIResult> {
  const errors: string[] = []

  for (const attempt of attempts) {
    try {
      console.log(`[${tag}] Trying ${attempt.label}...`)
      const text = await attempt.fn()
      console.log(`[${tag}] Success with ${attempt.label} (${text.length} chars)`)
      const underLength = minChars !== undefined ? text.length < minChars : undefined
      if (underLength) {
        console.warn(`[${tag}] Output too short: got ${text.length} chars, expected >= ${minChars}`)
      }
      return { text, provider: attempt.label, underLength: minChars !== undefined ? text.length < minChars : undefined }
    } catch (err: any) {
      const msg = (err?.message || 'Unknown error').slice(0, 120)
      console.warn(`[${tag}] ${attempt.label} failed: ${msg}`)
      errors.push(`${attempt.label}: ${msg}`)
      continue
    }
  }

  throw new Error(`All AI providers failed:\n${errors.join('\n')}`)
}

// ── Main exported functions ────────────────────────────────────────────────────
export async function generateAI(opts: AIOptions): Promise<AIResult> {
  return runAttempts(buildAttempts(opts), 'AI', opts.minChars)
}

export async function generateAILong(opts: AIOptions): Promise<AIResult> {
  return runAttempts(buildLongAttempts(opts), 'AI Long', opts.minChars)
}