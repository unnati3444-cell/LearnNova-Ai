import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#F5EFE6',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Navbar */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 48px',
        borderBottom: '1px solid #DFD2BC',
        background: '#FFFEFB',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#3A2E22', letterSpacing: '-0.02em' }}>
          LearnNova<span style={{ color: '#A8693F' }}> </span>AI
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px 60px',
        textAlign: 'center',
      }}>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: '#F0DCC8',
          color: '#A8693F',
          fontSize: 12,
          fontWeight: 600,
          padding: '5px 14px',
          borderRadius: 20,
          marginBottom: 32,
          border: '1px solid #DDBA92',
          letterSpacing: '0.03em',
        }}>
          ✦ AI-Powered Learning Workspace
        </div>

        <h1 style={{
          fontSize: 72,
          fontWeight: 700,
          color: '#3A2E22',
          lineHeight: 1.08,
          marginBottom: 24,
          letterSpacing: '-0.03em',
          maxWidth: 800,
        }}>
          Study smarter,{' '}
          <span style={{ color: '#A8693F', fontStyle: 'italic' }}>
            not harder.
          </span>
        </h1>

        <p style={{
          fontSize: 20,
          color: '#7A6B57',
          lineHeight: 1.65,
          marginBottom: 44,
          maxWidth: 560,
        }}>
          Upload your PDFs, YouTube lectures, and websites.
          Instantly get mind maps, flashcards, MCQs, and AI chat —
          all powered by your own sources.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56 }}>
          <Link href="/dashboard">
            <button style={{
              background: '#A8693F',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '14px 32px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}>
              Start for free →
            </button>
          </Link>
          <Link href="/project/demo-1">
            <button style={{
              background: '#FFFEFB',
              color: '#3A2E22',
              border: '1px solid #C9B896',
              borderRadius: 10,
              padding: '14px 32px',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
            }}>
              See demo project
            </button>
          </Link>
        </div>

        <p style={{ fontSize: 12, color: '#A8997E', marginBottom: 48 }}>
          Built for CA, UPSC, Law & College students · No credit card needed
        </p>

        <div style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          flexWrap: 'wrap',
          maxWidth: 600,
        }}>
          {[
            { label: '🗺️  Mind Maps', color: '#DCE8DC', text: '#3D5C3D' },
            { label: '🃏  Flashcards', color: '#F0DCC8', text: '#A8693F' },
            { label: '✅  MCQs', color: '#E8DCE4', text: '#8C5C72' },
            { label: '💬  AI Chat', color: '#DDD3E8', text: '#5C4A8C' },
            { label: '📝  Summaries', color: '#F5E8C8', text: '#9C7A1F' },
            { label: '⏱️  Quiz Mode', color: '#D8E4EC', text: '#3D6B8C' },
          ].map(f => (
            <div key={f.label} style={{
              background: f.color,
              color: f.text,
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 20,
            }}>
              {f.label}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom strip */}
      <div style={{
        borderTop: '1px solid #DFD2BC',
        padding: '20px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#FFFEFB',
      }}>
        <span style={{ fontSize: 12, color: '#A8997E' }}>
          © 2026 LearnNovaAI
        </span>
        <span style={{ fontSize: 12, color: '#A8997E' }}>
          Designed for serious students 📚
        </span>
      </div>

    </main>
  )
}