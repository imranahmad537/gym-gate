import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Gym pass', robots: { index: false, follow: false } };

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return children;
}
