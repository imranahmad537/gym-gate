export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-[26px] leading-tight font-extrabold">{title}</h1>
      {subtitle && <p className="text-muted mt-1 text-[15px]">{subtitle}</p>}
    </div>
  );
}
