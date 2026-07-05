import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import { useBackupStore } from '@/lib/store'

function AppBootstrap() {
  const loadConfig = useBackupStore((s) => s.loadConfig)
  const initListeners = useBackupStore((s) => s.initListeners)

  useEffect(() => {
    void loadConfig()
    const cleanup = initListeners()
    return cleanup
  }, [loadConfig, initListeners])

  return null
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <AppBootstrap />
      <Component {...pageProps} />
    </>
  )
}