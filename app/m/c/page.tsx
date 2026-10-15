import { CheckinClient } from './checkin-client';

export const dynamic = 'force-dynamic';

/** Opened by the phone camera from the kiosk QR: /m/c?k=<kiosk>&w=<window>&t=<token> */
export default async function ScanPage({ searchParams }: { searchParams: Promise<{ k?: string; w?: string; t?: string }> }) {
  const { k = '', w = '', t = '' } = await searchParams;
  return <CheckinClient k={k} w={w} t={t} />;
}
