'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChartColumn, Dumbbell, LayoutDashboard, ScanLine, SlidersHorizontal, Users } from 'lucide-react';
import { m } from '@/messages';

const ITEMS = [
  { href: '/', label: m.nav.home, long: m.nav.dashboard, icon: LayoutDashboard },
  { href: '/members', label: m.nav.members, long: m.nav.members, icon: Users },
  { href: '/checkin', label: m.nav.checkin, long: m.nav.checkin, icon: ScanLine, center: true },
  { href: '/reports', label: m.nav.reports, long: m.nav.reports, icon: ChartColumn },
  { href: '/settings', label: m.nav.settings, long: m.nav.settings, icon: SlidersHorizontal },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

// Form screens have their own sticky Save bar, so the tab bar steps aside.
const HIDE_ON = [/^\/members\/new$/, /^\/members\/[^/]+\/edit$/];

export function BottomNav() {
  const pathname = usePathname();
  if (HIDE_ON.some((r) => r.test(pathname))) return null;
  return (
    <nav aria-label={m.nav.main} className="safe-bottom border-line bg-surface fixed inset-x-0 bottom-0 z-40 border-t md:hidden">
      <ul className="grid h-[76px] grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, center }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-[3px] text-xs ${active ? 'text-primary-ink font-extrabold' : 'text-muted font-bold'}`}
              >
                {center ? (
                  <span className="bg-primary flex h-[30px] w-11 items-center justify-center rounded-[10px] text-white">
                    <Icon className="size-[22px]" aria-hidden />
                  </span>
                ) : (
                  <span className={`flex h-[30px] items-center justify-center rounded-full ${active ? 'bg-primary-soft w-[52px]' : ''}`}>
                    <Icon className="size-[22px]" aria-hidden />
                  </span>
                )}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav({ gymName }: { gymName: string }) {
  const pathname = usePathname();
  return (
    <aside className="border-line bg-surface sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-1.5 border-r px-3.5 py-5 md:flex">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <span className="bg-primary flex size-[42px] items-center justify-center rounded-xl text-white">
          <Dumbbell className="size-[22px]" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-lg font-extrabold">{m.app.name}</span>
          <span className="text-muted block truncate text-xs font-semibold">{gymName}</span>
        </span>
      </div>
      <nav aria-label={m.nav.main}>
        <ul className="flex flex-col gap-1">
          {ITEMS.map(({ href, long, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[52px] items-center gap-3 rounded-[14px] px-3.5 text-base ${active ? 'bg-primary-soft text-primary-ink font-extrabold' : 'text-ink hover:bg-surface-2 font-bold'}`}
                >
                  <Icon className="size-[22px]" aria-hidden />
                  {long}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
