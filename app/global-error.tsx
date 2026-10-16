'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#f2f2f5', color: '#111114', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, marginTop: 80 }}>Something went wrong</h1>
        <p>Please try again. If it keeps happening, check your internet connection.</p>
        <button
          type="button"
          onClick={reset}
          style={{ minHeight: 52, padding: '0 24px', borderRadius: 999, border: 0, background: '#111114', color: '#fff', fontSize: 17, fontWeight: 800 }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
