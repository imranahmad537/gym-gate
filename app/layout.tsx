import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import localFont from 'next/font/local';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { ServiceWorker } from '@/components/service-worker';
import { m } from '@/messages';

// Satoshi by Indian Type Foundry (Fontshare, free for commercial use), self-hosted.
const satoshi = localFont({
  src: './fonts/Satoshi-Variable.woff2',
  weight: '300 900',
  display: 'swap',
  variable: '--font-satoshi',
});

export const metadata: Metadata = {
  title: { default: m.app.name, template: `%s · ${m.app.name}` },
  description: m.app.tagline,
  applicationName: m.app.name,
  appleWebApp: { capable: true, title: m.app.name, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f2f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d10' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('gg_theme')?.value;
  const dataTheme = theme === 'light' || theme === 'dark' ? theme : undefined;
  return (
    <html lang="en" dir={m.dir} data-theme={dataTheme} className={satoshi.variable} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
