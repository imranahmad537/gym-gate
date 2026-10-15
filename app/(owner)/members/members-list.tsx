'use client';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import type { FeeInfo } from '@/lib/status';
import { m } from '@/messages';

export type ListMember = {
  id: string;
  no: number;
  name: string;
  phone: string;
  digits: string;
  plan: string;
  fee: FeeInfo;
  photoUrl: string | null;
  till: string | null;
};

type Filter = 'all' | 'active' | 'due' | 'overdue';

function inFilter(f: Filter, fee: FeeInfo) {
  if (f === 'all') return true;
  if (f === 'overdue') return fee.status === 'overdue' || fee.status === 'none';
  return fee.status === f;
}

export function MembersList({ members, initialFilter, hideFilters }: { members: ListMember[]; initialFilter: Filter; hideFilters?: boolean }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const query = useDeferredValue(q);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: members.length, active: 0, due: 0, overdue: 0 };
    for (const x of members) {
      if (x.fee.status === 'active') c.active++;
      else if (x.fee.status === 'due') c.due++;
      else c.overdue++;
    }
    return c;
  }, [members]);

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    const digits = query.replace(/\D/g, '');
    return members.filter((x) => {
      if (!inFilter(filter, x.fee)) return false;
      if (!text) return true;
      return (
        x.name.toLowerCase().includes(text) ||
        (digits.length > 0 && (String(x.no).includes(digits) || x.digits.includes(digits) || x.phone.replace(/\D/g, '').includes(digits)))
      );
    });
  }, [members, query, filter]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="msearch" className="text-muted mb-1.5 block text-[13px] font-bold">
          {m.members.search}
        </label>
        <div className="relative">
          <Search className="text-muted pointer-events-none absolute top-[15px] left-3.5 size-[22px]" aria-hidden />
          <input
            id="msearch"
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder={m.members.searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border-line bg-surface text-ink placeholder:text-muted/70 focus:border-primary h-[52px] w-full rounded-[14px] border-[1.5px] pr-3.5 pl-[46px] text-base font-semibold focus:outline-none"
          />
        </div>
      </div>

      {!hideFilters && (
        <div role="group" aria-label={m.members.filterLabel} className="flex flex-wrap gap-2">
          {(['all', 'active', 'due', 'overdue'] as const).map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-sm font-bold ${on ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink'}`}
              >
                {m.members.filters[f]}
                <span className={`rounded-full px-[7px] py-0.5 text-xs ${on ? 'bg-white/20 text-white' : 'bg-surface-2 text-muted'}`}>{counts[f]}</span>
              </button>
            );
          })}
        </div>
      )}

      {rows.length > 0 ? (
        <ul className="border-line bg-surface md:bg-line overflow-hidden rounded-[20px] border md:grid md:grid-cols-2 md:gap-px">
          {rows.map((x) => (
            <li key={x.id} className="border-line md:bg-surface border-b last:border-b-0 md:border-0">
              <Link href={`/members/${x.id}`} className="hover:bg-surface-2 flex min-h-12 items-center gap-3 px-3.5 py-3">
                <Avatar name={x.name} seed={x.no} photoUrl={x.photoUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold">{x.name}</span>
                  <span className="text-muted block text-[13px] font-semibold">
                    {x.plan} · #{x.no}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge info={x.fee} />
                  {x.till && (
                    <span className="text-muted text-xs font-semibold">{x.fee.status === 'overdue' ? m.status.ended(x.till) : m.status.till(x.till)}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-line bg-surface flex flex-col items-center gap-2.5 rounded-[20px] border-[1.5px] border-dashed px-5 py-8 text-center">
          <span className="bg-surface-2 text-muted flex size-16 items-center justify-center rounded-full">
            <Search className="size-[30px]" aria-hidden />
          </span>
          <div className="text-lg font-extrabold">{q ? m.members.noMatch(q) : m.members.noneInFilter}</div>
          {q && <div className="text-muted text-[15px] leading-relaxed">{m.members.noMatchHint}</div>}
          <Button
            variant="secondary"
            onClick={() => {
              setQ('');
              setFilter('all');
            }}
          >
            {m.members.clear}
          </Button>
        </div>
      )}
    </div>
  );
}
