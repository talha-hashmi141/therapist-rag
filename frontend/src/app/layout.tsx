import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Therapy Sessions | AI-Powered Session Analysis',
  description: 'Upload therapy session recordings for automatic transcription, summarization, and semantic search.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen font-sans">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 glass border-b border-surface-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <Link 
                href="/" 
                className="flex items-center gap-3 group"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-shadow">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <span className="font-semibold text-lg text-surface-900">
                  Therapy<span className="text-primary-600">Sessions</span>
                </span>
              </Link>

              {/* Nav Links */}
              <div className="flex items-center gap-2">
                <Link 
                  href="/" 
                  className="btn-ghost text-sm"
                >
                  Upload
                </Link>
                <Link 
                  href="/sessions" 
                  className="btn-ghost text-sm"
                >
                  Sessions
                </Link>
                <Link 
                  href="/chat" 
                  className="btn-ghost text-sm"
                >
                  Chat
                </Link>
                <Link 
                  href="/search" 
                  className="btn-ghost text-sm"
                >
                  Search
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="min-h-[calc(100vh-4rem)]">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-surface-200 py-8 mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-surface-500">
              Therapy Session Processor • Powered by OpenAI
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
