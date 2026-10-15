import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'dangerOutline';
type Size = 'lg' | 'md' | 'sm';

const base =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold transition-colors select-none disabled:opacity-50 disabled:pointer-events-none text-center';
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-surface text-ink border-[1.5px] border-line hover:bg-surface-2',
  soft: 'bg-primary-soft text-primary-ink hover:brightness-95',
  ghost: 'bg-transparent text-primary-ink hover:bg-surface-2',
  danger: 'bg-bad text-surface hover:brightness-95',
  dangerOutline: 'bg-transparent text-bad border-[1.5px] border-line hover:bg-bad-soft',
};
const sizes: Record<Size, string> = {
  lg: 'min-h-14 px-5 text-[17px]',
  md: 'min-h-12 px-4 text-[15px]',
  sm: 'min-h-11 px-3 text-sm',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = 'primary', size = 'md', loading, icon, className = '', children, disabled, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

type LinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function ButtonLink({ variant = 'primary', size = 'md', icon, className = '', children, ...props }: LinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

type AnchorProps = ComponentProps<'a'> & { variant?: Variant; size?: Size; icon?: ReactNode };

/** External link styled as a button (e.g. wa.me). */
export function ButtonAnchor({ variant = 'primary', size = 'md', icon, className = '', children, ...props }: AnchorProps) {
  return (
    <a className={buttonClass(variant, size, className)} target="_blank" rel="noopener noreferrer" {...props}>
      {icon}
      {children}
    </a>
  );
}
