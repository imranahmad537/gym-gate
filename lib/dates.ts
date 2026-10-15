// Date helpers. Calendar dates are plain 'YYYY-MM-DD' strings in the gym's
// time zone; instants are Date objects / ISO strings.

export const DEFAULT_TZ = 'Asia/Karachi';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_MS = 86_400_000;

export function isDateString(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

function toUtcMs(date: string): number {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today's calendar date in the given time zone. */
export function todayInTz(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Calendar date of an instant in the given time zone. */
export function dateInTz(instant: Date | string, tz: string = DEFAULT_TZ): string {
  return todayInTz(tz, typeof instant === 'string' ? new Date(instant) : instant);
}

export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(to: string, from: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function firstOfMonth(month: string): string {
  return `${month}-01`;
}

export function lastOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return fromUtcMs(Date.UTC(y, m, 0));
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function isMonthKey(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

function tzOffsetMs(tz: string, at: Date): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant when the given calendar date starts in the time zone. */
export function startOfDay(date: string, tz: string = DEFAULT_TZ): Date {
  const guess = toUtcMs(date);
  let t = guess - tzOffsetMs(tz, new Date(guess));
  const second = tzOffsetMs(tz, new Date(t));
  if (guess - second !== t) t = guess - second;
  return new Date(t);
}

/** "10 Oct 2026" */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const [y, m, d] = parts(date);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

/** "30 Oct" */
export function formatShortDate(date: string | null | undefined): string {
  if (!date) return '—';
  const [, m, d] = parts(date);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "October 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** "6:42 PM" in the gym's time zone. */
export function formatTime(instant: Date | string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(
    typeof instant === 'string' ? new Date(instant) : instant,
  );
}

/** "Sat, 10 Oct 2026" */
export function formatLongDay(date: string): string {
  const [y, m, d] = parts(date);
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  return `${wd}, ${formatDate(date)}`;
}

/** "Mon" */
export function weekdayShort(date: string): string {
  const [y, m, d] = parts(date);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** ISO weekday, Monday = 0 … Sunday = 6 */
export function weekdayIndexMon0(date: string): number {
  return (new Date(toUtcMs(date)).getUTCDay() + 6) % 7;
}

export function daysInMonth(month: string): number {
  return Number(lastOfMonth(month).slice(8, 10));
}
