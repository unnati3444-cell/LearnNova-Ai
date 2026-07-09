import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LearnNovaAI',
  description: 'AI-powered study tool — mind maps, notes, flashcards, quizzes and more.',
  icons: {
    icon: '/favicon.ico',        // put your image at public/favicon.png
    apple: '/favicon.ico',       // also used for iOS home screen
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}