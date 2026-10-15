import { avatarColor, initials } from '@/lib/avatar';

const SIZES = {
  sm: 'size-10 text-sm',
  md: 'size-11 text-[15px]',
  lg: 'size-[84px] text-3xl',
  xl: 'size-[132px] text-5xl',
} as const;

export function Avatar({
  name,
  seed,
  photoUrl,
  size = 'md',
  className = '',
}: {
  name: string;
  seed: string | number;
  photoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const cls = `${SIZES[size]} shrink-0 rounded-full ${className}`;
  if (photoUrl) {
    return <img src={photoUrl} alt="" className={`${cls} object-cover`} loading="lazy" decoding="async" />;
  }
  return (
    <span aria-hidden className={`${cls} flex items-center justify-center font-extrabold text-white`} style={{ background: avatarColor(seed) }}>
      {initials(name)}
    </span>
  );
}
