import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en" className="dark" style={{ colorScheme: 'dark' }}>
      <Head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name="theme-color" content="#0a0612" />
        <meta name="description" content="ErosVault — cosmic incremental backup vault" />
      </Head>
      <body className="bg-void-950 text-nebula-300 antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
