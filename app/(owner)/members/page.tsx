import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Plus, UserPlus } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { Page, PageHeader } from '@/components/page-header';
import { getMembers } from '@/lib/data';
import { formatDate } from '@/lib/dates';
import { displayPhone } from '@/lib/phone';
import { compareByUrgency } from '@/lib/status';
import { m } from '@/messages';
import { MembersList, type ListMember } from './members-list';

export const metadata: Metadata = { title: m.members.title };

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ filter?: string; archived?: string }> }) {
  const sp = await searchParams;
  const showArchived = sp.archived === '1';
  const [members, archived] = await Promise.all([getMembers({ archived: showArchived }), showArchived ? Promise.resolve([]) : getMembers({ archived: true })]);
  const list: ListMember[] = [...members]
    .sort((a, b) => compareByUrgency(a.fee, b.fee) || a.name.localeCompare(b.name))
    .map((x) => ({
      id: x.id,
      no: x.member_no,
      name: x.name,
      phone: displayPhone(x.phone),
      digits: x.phone.replace(/\D/g, ''),
      plan: x.plan?.name ?? '—',
      fee: x.fee,
      photoUrl: x.photoUrl,
      till: x.valid_till ? formatDate(x.valid_till) : null,
    }));
  const filter = ['all', 'active', 'due', 'overdue'].includes(sp.filter ?? '') ? (sp.filter as 'all' | 'active' | 'due' | 'overdue') : 'all';

  return (
    <Page>
      <PageHeader
        title={showArchived ? m.members.archived : m.members.title}
        subtitle={m.members.total(list.length)}
        action={
          <div className="hidden md:block">
            <ButtonLink href="/members/new" icon={<Plus className="size-5" aria-hidden />}>
              {m.dashboard.addMember}
            </ButtonLink>
          </div>
        }
      />
      {list.length === 0 && !showArchived ? (
        <div className="flex flex-col gap-4 pt-4">
          <EmptyState
            icon={<UserPlus className="size-9" aria-hidden />}
            title={m.members.emptyTitle}
            body={m.members.emptyBody}
            action={
              <ButtonLink href="/members/new" size="lg" icon={<Plus className="size-5" aria-hidden />}>
                {m.members.emptyCta}
              </ButtonLink>
            }
          />
          <div className="bg-surface-2 flex items-start gap-3 rounded-[18px] p-4">
            <span className="bg-surface text-primary-ink flex size-9 shrink-0 items-center justify-center rounded-[10px]">
              <BookOpen className="size-5" aria-hidden />
            </span>
            <div>
              <div className="text-[15px] font-extrabold">{m.members.paperTitle}</div>
              <div className="text-muted mt-0.5 text-sm leading-relaxed">{m.members.paperBody}</div>
            </div>
          </div>
        </div>
      ) : (
        <MembersList members={list} initialFilter={showArchived ? 'all' : filter} hideFilters={showArchived} />
      )}
      <div className="py-6 text-center">
        {showArchived ? (
          <Link href="/members" className="text-primary-ink inline-flex min-h-11 items-center text-sm font-bold">
            {m.members.hideArchived}
          </Link>
        ) : (
          archived.length > 0 && (
            <Link href="/members?archived=1" className="text-primary-ink inline-flex min-h-11 items-center text-sm font-bold">
              {m.members.showArchived(archived.length)}
            </Link>
          )
        )}
      </div>
      {!showArchived && (
        <Link
          href="/members/new"
          className="bg-primary fixed right-4 bottom-[92px] z-30 inline-flex min-h-14 items-center gap-2 rounded-full pr-5 pl-4 text-base font-bold text-on-primary shadow-[0_10px_24px_rgba(17,17,20,0.28)] md:hidden"
        >
          <Plus className="size-[22px]" strokeWidth={2.4} aria-hidden />
          {m.dashboard.addMember}
        </Link>
      )}
    </Page>
  );
}
