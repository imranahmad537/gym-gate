import type { ComponentProps, ReactNode } from 'react';

export const inputClass =
  'w-full min-h-[54px] rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] font-semibold text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none disabled:opacity-60';

export function Label({ className = '', ...props }: ComponentProps<'label'>) {
  return <label className={`mb-1.5 block text-sm font-bold ${className}`} {...props} />;
}

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function Select({ className = '', ...props }: ComponentProps<'select'>) {
  return <select className={`${inputClass} appearance-none ${className}`} {...props} />;
}

export function Hint({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="text-muted mt-1.5 text-[13px] font-semibold">
      {children}
    </p>
  );
}

export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-bad mt-1.5 text-[13px] font-bold">
      {children}
    </p>
  );
}

/** Large on/off switch built on a real checkbox. */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
  name,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <label className="flex min-h-16 cursor-pointer items-center justify-between gap-3 px-4 py-2.5">
      <span>
        <span className="block text-[15px] font-bold">{label}</span>
        {hint && <span className="text-muted block text-[13px] font-semibold">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="accent-primary size-[26px] shrink-0 cursor-pointer"
      />
    </label>
  );
}

/** Row of mutually exclusive options (segmented control). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  labelledBy,
  render,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labelledBy?: string;
  render: (v: T) => ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={String(o)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o)}
            className={`min-h-12 rounded-xl border-[1.5px] text-[15px] font-extrabold ${on ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink'}`}
          >
            {render(o)}
          </button>
        );
      })}
    </div>
  );
}
