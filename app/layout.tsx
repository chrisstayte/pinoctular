import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';

import './globals.css';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Pinoctular',
  description:
    'A beautiful viewer for Pino JSON logs. Upload, paste, search, filter, and explore your logs.',
  openGraph: {
    title: 'Pinoctular',
    description:
      'A beautiful viewer for Pino JSON logs. Upload, paste, search, filter, and explore your logs.',
    url: 'https://pinoctular.stayte.app',
    siteName: 'Pinoctular',
    images: [
      {
        url: 'https://pinoctular.stayte.app/og-image.png',
        alt: 'Pinoctular Open Graph Image',
      },
    ],
    locale: 'en-US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pinoctular',
    description:
      'A beautiful viewer for Pino JSON logs. Upload, paste, search, filter, and explore your logs.',
    images: ['https://pinoctular.stayte.app/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0f1117',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
