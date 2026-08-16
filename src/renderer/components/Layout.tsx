import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useBackupStore } from '@/lib/store'

interface Props {
  children: React.ReactNode
}

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/configure', label: 'Configure' },
  { href: '/schedules', label: 'Schedules' },
  { href: '/history', label: 'History' },
]

export function Layout({ children }: Props) {
  const { pathname } = useRouter()
  const [mounted, setMounted] = useState(false)
  const scheduledNotification = useBackupStore((s) => s.scheduledNotification)
  const clearNotification = () => useBackupStore.setState({ scheduledNotification: null })

  useEffect(() => {
    setMounted(true)
    document.documentElement.classList.add('dark')
    document.documentElement.style.colorScheme = 'dark'
  }, [])

  if (!mounted) {
    return (
      <div className="ev-cosmos min-h-screen flex items-center justify-center">
        <p className="text-nebula-400 text-sm tracking-widest uppercase">ErosVault</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>ErosVault</title>
        <meta name="theme-color" content="#0a0612" />
      </Head>
      <div className="ev-cosmos min-h-screen">
        {/* Header */}
        <header className="border-b border-nebula-600/20 bg-void-900/70 backdrop-blur-md shadow-glow-sm">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="ev-brand-icon-wrap" aria-hidden>
                <div
                  className="ev-brand-icon w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(145deg, #a855f7 0%, #db2777 55%, #4c1d95 100%)',
                  }}
                >
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 14.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1z" opacity="0.85" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wide text-white">
                  Eros<span className="text-transparent bg-clip-text bg-gradient-to-r from-nebula-400 to-rose-glow">Vault</span>
                </h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-nebula-400/80">Cosmic backup · Empress edition</p>
              </div>
            </div>
            <span className="hidden sm:inline text-xs text-nebula-400/70 font-mono">v0.2</span>
          </div>
        </header>

        {/* Nav */}
        <nav className="border-b border-nebula-600/15 bg-void-900/50 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 flex gap-1 sm:gap-2">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={`ev-nav-link ${active ? 'ev-nav-link-active' : 'ev-nav-link-idle'}`}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Page content */}
        <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
          {scheduledNotification && (
            <div className="ev-panel p-4 flex items-start justify-between gap-3 border-nebula-500/30 shadow-glow-sm">
              <p className="text-sm text-nebula-300">{scheduledNotification}</p>
              <button
                onClick={clearNotification}
                className="text-rose-glow hover:text-rose-soft text-sm shrink-0 transition"
              >
                Dismiss
              </button>
            </div>
          )}
          {children}
        </main>

        <footer className="max-w-4xl mx-auto px-4 pb-8 pt-2">
          <p className="text-center text-[11px] text-nebula-400/40 tracking-wide">
            ErosVault · incremental rsync · host-side vault for what matters
          </p>
        </footer>
      </div>
    </>
  )
}
