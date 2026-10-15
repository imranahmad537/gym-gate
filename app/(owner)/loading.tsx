import { Skeleton } from '@/components/ui/misc';
import { m } from '@/messages';

export default function Loading() {
  return (
    <main aria-busy="true" aria-label={m.common.loading} className="mx-auto w-full max-w-6xl px-4 pt-5 md:px-7">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="border-line bg-surface flex h-[108px] flex-col gap-2.5 rounded-[18px] border p-4">
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-8 w-1/2 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="border-line bg-surface mt-5 overflow-hidden rounded-[20px] border">
        <div className="p-4">
          <Skeleton className="h-[18px] w-32" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="border-line flex items-center gap-3 border-t px-4 py-3">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-10 w-[76px] rounded-xl" />
          </div>
        ))}
      </div>
    </main>
  );
}
