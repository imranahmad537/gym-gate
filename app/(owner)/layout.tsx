import { BottomNav, SideNav } from '@/components/nav';
import { requireGym } from '@/lib/data';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { gym } = await requireGym();
  return (
    <div className="md:flex">
      <SideNav gymName={gym.name} />
      <div className="min-w-0 flex-1 pb-[104px] md:pb-12">{children}</div>
      <BottomNav />
    </div>
  );
}
