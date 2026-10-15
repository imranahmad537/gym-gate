'use client';
import Link from 'next/link';
import QRCode from 'qrcode';
import { CircleCheck, Clock, Dumbbell, Maximize, ShieldCheck, Smartphone, TriangleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildCheckinResult } from '@/lib/checkin-result';
import { formatShortDate, formatTime, todayInTz } from '@/lib/dates';
import { signKioskTokenBrowser } from '@/lib/kiosk-token-browser';
import { formatRs } from '@/lib/money';
import { avatarColor, initials } from '@/lib/avatar';
import { getBrowserClient } from '@/lib/supabase/browser';
import { firstName } from '@/lib/whatsapp';
import type { CheckinResult, KioskMember } from '@/lib/types';
import type { KioskState } from '@/lib/kiosk-snapshot';
import { m } from '@/messages';

type Display = { id: string; kind: 'result'; result: CheckinResult } | { id: string; kind: 'notfound'; digits: string };
type QueueItem = { clientId: string; memberId: string; at: string };

const REPEAT_MS = 3 * 60 * 60 * 1000;
const RING_R = 184;
const RING_C = 2 * Math.PI * RING_R;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'] as const;

function readQueue(key: string): QueueItem[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}
function writeQueue(key: string, q: QueueItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(q));
  } catch {
    // storage full or blocked: items stay in memory until synced
  }
}

export function KioskClient({ initial, dev }: { initial: KioskState; dev: boolean }) {
  const [state, setState] = useState(initial);
  // Server clock minus device clock. Cheap tablets often have the wrong time.
  const [offsetMs, setOffsetMs] = useState(0);
  const offset = useRef(0);
  const [clock, setClock] = useState(initial.serverTime);
  const now = clock + offsetMs;
  const syncClock = useCallback((serverTime: number) => {
    offset.current = serverTime - Date.now();
    setOffsetMs(offset.current);
  }, []);
  const tz = state.gym.tz;
  const queueKey = `gg_kiosk_queue_${state.kiosk.id}`;

  // ---------------------------------------------------------------- clock
  useEffect(() => {
    // Rough sync from the page render; the first poll refines it a few seconds later.
    // Skip when the page came from the offline cache (stale server time).
    const fresh = Math.abs(initial.serverTime - Date.now()) < 10 * 60_000;
    const first = setTimeout(() => fresh && syncClock(initial.serverTime), 0);
    const t = setInterval(() => setClock(Date.now()), 500);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [initial.serverTime, syncClock]);

  // ---------------------------------------------------------------- rotating QR
  const intervalMs = state.gym.qrIntervalSecs * 1000;
  const win = Math.floor(now / intervalMs);
  const msLeft = intervalMs - (now % intervalMs);
  const [qr, setQr] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  const hasQr = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await signKioskTokenBrowser(state.kiosk.secret, state.kiosk.id, win);
      const url = `${window.location.origin}/m/c?k=${state.kiosk.id}&w=${win}&t=${token}`;
      const svg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0e1b14', light: '#ffffff' } });
      if (cancelled) return;
      if (!hasQr.current) {
        hasQr.current = true;
        setQr(svg);
        return;
      }
      setFading(true);
      setTimeout(() => {
        if (cancelled) return;
        setQr(svg);
        setFading(false);
      }, 300);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [win, state.kiosk.secret, state.kiosk.id]);

  // ---------------------------------------------------------------- results on screen
  const [shows, setShows] = useState<(Display & { startedAt: number })[]>([]);
  const seen = useRef(new Set<string>());
  const head = shows[0];
  const showMs = (shows.length > 1 ? Math.max(2, state.gym.resultSecs - 1) : state.gym.resultSecs) * 1000;

  const present = useCallback((d: Display) => {
    if (seen.current.has(d.id)) return;
    seen.current.add(d.id);
    const item = { ...d, startedAt: Date.now() };
    setShows((s) => (s.length >= 5 ? [...s.slice(0, 1), ...s.slice(-3), item] : [...s, item]));
  }, []);

  const advance = useCallback(() => {
    setShows((s) => {
      const rest = s.slice(1);
      return rest.length ? [{ ...rest[0], startedAt: Date.now() }, ...rest.slice(1)] : rest;
    });
  }, []);

  useEffect(() => {
    if (!head) return;
    const t = setTimeout(advance, Math.max(500, head.startedAt + showMs - Date.now()));
    return () => clearTimeout(t);
  }, [head, showMs, advance]);

  const secondsBack = head ? Math.max(1, Math.ceil((head.startedAt + showMs - clock) / 1000)) : 0;

  // ---------------------------------------------------------------- members + visit counts
  const membersByLast4 = useMemo(() => {
    const map = new Map<string, KioskMember[]>();
    for (const x of state.members) {
      const list = map.get(x.last4) ?? [];
      list.push(x);
      map.set(x.last4, list);
    }
    return map;
  }, [state.members]);

  const setVisits = useCallback((memberId: string, visits: number) => {
    setState((s) => ({ ...s, members: s.members.map((x) => (x.id === memberId ? { ...x, visits } : x)) }));
  }, []);

  // ---------------------------------------------------------------- offline queue
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    const items = readQueue(queueKey);
    setPending(items.length);
    if (items.length === 0 || !navigator.onLine) return;
    flushing.current = true;
    try {
      const res = await fetch('/api/kiosk/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.slice(0, 200) }),
      });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { results: { clientId: string; ok: boolean }[] };
      const done = new Set(data.results.filter((r) => r.ok).map((r) => r.clientId));
      const rest = readQueue(queueKey).filter((q) => !done.has(q.clientId));
      writeQueue(queueKey, rest);
      setPending(rest.length);
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      flushing.current = false;
    }
  }, [queueKey]);

  useEffect(() => {
    const kick = () => {
      setOnline(navigator.onLine);
      void flush();
    };
    kick();
    const t = setInterval(() => void flush(), 15_000);
    window.addEventListener('online', kick);
    window.addEventListener('offline', kick);
    return () => {
      clearInterval(t);
      window.removeEventListener('online', kick);
      window.removeEventListener('offline', kick);
    };
  }, [flush]);

  // ---------------------------------------------------------------- refresh member list
  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch('/api/kiosk/state', { cache: 'no-store' });
        if (res.status === 401) return window.location.reload();
        if (!res.ok) return;
        const next = (await res.json()) as KioskState;
        syncClock(next.serverTime);
        const queued = readQueue(queueKey);
        setState({
          ...next,
          members: next.members.map((x) => ({ ...x, visits: x.visits + queued.filter((q) => q.memberId === x.id).length })),
        });
        setOnline(true);
      } catch {
        setOnline(false);
      }
    };
    const t = setInterval(refresh, 5 * 60_000);
    return () => clearInterval(t);
  }, [queueKey, syncClock]);

  // ---------------------------------------------------------------- phone check-ins (Realtime + polling fallback)
  const [rtConnected, setRtConnected] = useState(false);
  const lastEventAt = useRef(new Date(initial.serverTime).toISOString());

  const onRemote = useCallback(
    (r: CheckinResult) => {
      if (r.at > lastEventAt.current) lastEventAt.current = r.at;
      setVisits(r.memberId, r.visitsThisMonth);
      present({ id: r.repeat ? `${r.checkinId}:r:${Date.now()}` : r.checkinId, kind: 'result', result: r });
    },
    [present, setVisits],
  );

  useEffect(() => {
    const sb = getBrowserClient();
    const channel = sb
      .channel(`gg-kiosk-${state.kiosk.channel}`)
      .on('broadcast', { event: 'checkin' }, (msg: { payload: unknown }) => onRemote(msg.payload as CheckinResult))
      .subscribe((status: string) => setRtConnected(status === 'SUBSCRIBED'));
    return () => {
      void sb.removeChannel(channel);
    };
  }, [state.kiosk.channel, onRemote]);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/kiosk/events?after=${encodeURIComponent(lastEventAt.current)}`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { results: CheckinResult[]; serverTime: number };
          if (stop) return;
          syncClock(data.serverTime);
          data.results.forEach(onRemote);
          setOnline(true);
        }
      } catch {
        setOnline(false);
      }
    };
    const t = setInterval(poll, rtConnected ? 20_000 : 4_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [rtConnected, onRemote, syncClock]);

  // ---------------------------------------------------------------- keep the screen on
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        // not supported or not allowed
      }
    };
    void request();
    const onVisible = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);

  // ---------------------------------------------------------------- keypad
  const [entry, setEntry] = useState('');
  const [picks, setPicks] = useState<KioskMember[] | null>(null);
  const lastLocal = useRef(new Map<string, number>());

  const keypadCheckin = useCallback(
    (member: KioskMember) => {
      const nowMs = Date.now() + offset.current;
      const at = new Date(nowMs).toISOString();
      const last = lastLocal.current.get(member.id);
      const repeat = last !== undefined && nowMs - last < REPEAT_MS;
      const visits = repeat ? member.visits : member.visits + 1;
      if (!repeat) {
        lastLocal.current.set(member.id, nowMs);
        setVisits(member.id, visits);
        writeQueue(queueKey, [...readQueue(queueKey), { clientId: crypto.randomUUID(), memberId: member.id, at }]);
        void flush();
      }
      const result = buildCheckinResult({
        checkinId: `local-${crypto.randomUUID()}`,
        member,
        visitsThisMonth: visits,
        method: 'keypad',
        at,
        today: todayInTz(tz, new Date(nowMs)),
        repeat,
      });
      setPicks(null);
      setEntry('');
      present({ id: result.checkinId, kind: 'result', result });
    },
    [flush, present, queueKey, setVisits, tz],
  );

  const lookup = useCallback(
    (digits: string) => {
      const matches = membersByLast4.get(digits) ?? [];
      if (matches.length === 1) keypadCheckin(matches[0]);
      else if (matches.length > 1) setPicks(matches);
      else {
        setEntry('');
        present({ id: `nf-${Date.now()}`, kind: 'notfound', digits });
      }
    },
    [keypadCheckin, membersByLast4, present],
  );

  const press = (k: (typeof KEYS)[number]) => {
    if (k === 'clr') return setEntry('');
    if (k === 'del') return setEntry((e) => e.slice(0, -1));
    if (entry.length >= 4) return;
    const next = entry + k;
    setEntry(next);
    if (next.length === 4) setTimeout(() => lookup(next), 150);
  };

  // ---------------------------------------------------------------- owner exit
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinState, setPinState] = useState<'enter' | 'wrong' | 'locked' | 'ok'>('enter');
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holdStart = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      setPin('');
      setPinState('enter');
      setPinOpen(true);
    }, 1200);
  };
  const holdEnd = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };

  const pressPin = async (k: (typeof KEYS)[number]) => {
    if (k === 'clr') return setPin('');
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length < 4) return;
    try {
      const res = await fetch('/api/kiosk/exit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: next }) });
      const data = (await res.json()) as { ok: boolean; error?: string };
      setPin('');
      setPinState(data.ok ? 'ok' : data.error === 'locked' ? 'locked' : 'wrong');
    } catch {
      setPin('');
      setPinState('wrong');
    }
  };

  // ---------------------------------------------------------------- dev helper
  const demoIndex = useRef(0);
  const simulate = () => {
    const list = state.members;
    if (list.length === 0) return;
    const member = list[demoIndex.current++ % list.length];
    const nowMs = Date.now() + offset.current;
    present({
      id: `dev-${nowMs}`,
      kind: 'result',
      result: buildCheckinResult({
        checkinId: `dev-${nowMs}`,
        member,
        visitsThisMonth: member.visits + 1,
        method: 'phone',
        at: new Date(nowMs).toISOString(),
        today: todayInTz(tz, new Date(nowMs)),
      }),
    });
  };

  // ---------------------------------------------------------------- render
  const isOnline = online && (typeof navigator === 'undefined' || navigator.onLine);
  const netLabel = isOnline ? (pending > 0 ? m.kiosk.onlineSyncing(pending) : m.kiosk.online) : m.kiosk.offline(pending);
  const nowDate = new Date(now);
  const [canFullscreen, setCanFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setCanFullscreen(Boolean(document.fullscreenEnabled && !document.fullscreenElement));
    update();
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  return (
    <div data-theme="dark" className="bg-bg text-ink fixed inset-0 flex flex-col overflow-hidden select-none" onContextMenu={(e) => e.preventDefault()}>
      <div className="border-line flex h-14 shrink-0 items-center justify-between border-b px-4 md:px-7">
        <div className="flex items-center gap-3">
          <span className="bg-surface-2 rounded-[10px] px-3 py-1.5 text-sm font-extrabold">{state.kiosk.name}</span>
          <span
            role="status"
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-bold ${isOnline ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}
          >
            <span className={`size-[9px] rounded-full ${isOnline ? 'bg-ok' : 'bg-warn'}`} />
            {netLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {dev && (
            <button
              type="button"
              onClick={simulate}
              className="border-muted text-muted inline-flex min-h-10 items-center gap-2 rounded-[10px] border-[1.5px] border-dashed px-3.5 text-[13px] font-extrabold"
            >
              <Smartphone className="size-4" aria-hidden />
              DEV · Simulate scan
            </button>
          )}
          {canFullscreen && (
            <button
              type="button"
              onClick={() => document.documentElement.requestFullscreen().catch(() => {})}
              className="bg-surface-2 inline-flex min-h-10 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-bold"
            >
              <Maximize className="size-4" aria-hidden />
              {m.kiosk.fullscreen}
            </button>
          )}
        </div>
      </div>

      <main
        className={`grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 md:gap-6 md:p-6 ${state.gym.keypadEnabled ? 'landscape:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}`}
      >
        <section aria-label={m.kiosk.scanTitle} className="border-line bg-surface flex flex-col items-center rounded-[28px] border px-5 pt-6 pb-5 md:px-7">
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="relative aspect-square w-[min(380px,48vh,78vw)]">
              <svg viewBox="0 0 380 380" aria-hidden className="absolute inset-0 size-full">
                <circle cx="190" cy="190" r={RING_R} fill="none" stroke="var(--ln)" strokeWidth="5" />
                <circle
                  cx="190"
                  cy="190"
                  r={RING_R}
                  fill="none"
                  stroke="var(--dok)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - msLeft / intervalMs)}
                  transform="rotate(-90 190 190)"
                  style={{ transition: 'stroke-dashoffset 500ms linear' }}
                />
              </svg>
              <div
                className="absolute inset-[16%] flex items-center justify-center rounded-[22px] bg-white p-[6%] shadow-[0_6px_24px_rgba(0,0,0,0.25)] transition-opacity duration-300"
                style={{ opacity: fading || !qr ? 0.15 : 1 }}
              >
                {qr && <div role="img" aria-label={m.kiosk.qrAlt} className="size-full [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[clamp(22px,3.4vh,30px)] leading-tight font-extrabold">{m.kiosk.scanTitle}</div>
              <div className="text-muted mt-1.5 text-[17px] font-semibold">{m.kiosk.newCodeIn(Math.ceil(msLeft / 1000))}</div>
            </div>
          </div>
          <div className="border-line mt-3 flex w-full flex-wrap items-center justify-between gap-3 border-t pt-4">
            <button
              type="button"
              aria-label={`${state.gym.name}. ${m.kiosk.holdHint}`}
              onPointerDown={holdStart}
              onPointerUp={holdEnd}
              onPointerLeave={holdEnd}
              onPointerCancel={holdEnd}
              className="flex min-h-12 cursor-default items-center gap-3 [-webkit-touch-callout:none]"
            >
              <span className="bg-primary flex size-11 items-center justify-center rounded-[13px] text-white">
                <Dumbbell className="size-6" aria-hidden />
              </span>
              <span className="text-[19px] font-extrabold">{state.gym.name}</span>
            </button>
            <span className="text-[19px] font-extrabold">
              {formatTime(nowDate, tz)} <span className="text-muted text-[15px] font-semibold">· {formatShortDate(todayInTz(tz, nowDate))}</span>
            </span>
            <span className="text-primary-ink inline-flex items-center gap-1.5 text-sm font-bold">
              <ShieldCheck className="size-[18px]" aria-hidden />
              {m.kiosk.secure}
            </span>
          </div>
        </section>

        {state.gym.keypadEnabled && (
          <section aria-label={m.kiosk.noPhoneTitle} className="border-line bg-surface flex flex-col gap-3.5 rounded-[28px] border p-5 md:p-6">
            {picks ? (
              <>
                <div className="text-center">
                  <div className="text-2xl font-extrabold">{m.kiosk.pickTitle}</div>
                  <div className="text-muted mt-0.5 text-base font-semibold">{m.kiosk.pickBody(picks.length, entry)}</div>
                </div>
                <div className="grid flex-1 grid-cols-2 content-center gap-3">
                  {picks.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => keypadCheckin(p)}
                      className="border-line bg-surface-2 flex min-h-[200px] flex-col items-center justify-center gap-2.5 rounded-[22px] border-2"
                    >
                      <BigPhoto name={p.name} seed={p.no} url={p.photoUrl} size="size-28 text-[40px]" />
                      <span className="text-xl font-extrabold">{p.name}</span>
                      <span className="text-muted text-sm font-semibold">{m.kiosk.memberNo(p.no)}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPicks(null);
                    setEntry('');
                  }}
                  className="border-line min-h-14 rounded-2xl border-[1.5px] text-lg font-bold"
                >
                  {m.kiosk.pickNone}
                </button>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="text-2xl font-extrabold">{m.kiosk.noPhoneTitle}</div>
                  <div className="text-muted mt-0.5 text-base font-semibold">{m.kiosk.noPhoneBody}</div>
                </div>
                <div className="grid grid-cols-4 gap-2.5" aria-live="polite">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`flex h-16 items-center justify-center rounded-2xl border-2 text-[34px] font-extrabold ${i < entry.length ? 'border-primary bg-primary-soft text-primary-ink' : 'border-line bg-surface-2'}`}
                    >
                      {entry[i] ?? ''}
                    </div>
                  ))}
                </div>
                <Keypad onPress={press} />
              </>
            )}
          </section>
        )}
      </main>

      {head && <ResultOverlay key={head.id} display={head} secondsBack={secondsBack} onDone={advance} />}

      {pinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="pin-h" className="bg-surface flex w-full max-w-[420px] flex-col gap-4 rounded-[28px] p-7">
            <div className="text-center">
              <h2 id="pin-h" className="text-2xl font-extrabold">
                {m.kiosk.pinTitle}
              </h2>
              <div className={`mt-1 text-base font-semibold ${pinState === 'wrong' || pinState === 'locked' ? 'text-bad' : 'text-muted'}`}>
                {pinState === 'wrong' ? m.kiosk.pinWrong : pinState === 'locked' ? m.kiosk.pinLocked : pinState === 'ok' ? m.kiosk.pinOk : m.kiosk.pinEnter}
              </div>
            </div>
            {pinState === 'ok' ? (
              <>
                <Link href="/" className="bg-primary flex min-h-[60px] items-center justify-center rounded-2xl text-xl font-extrabold text-white">
                  {m.kiosk.exit}
                </Link>
                <button type="button" onClick={() => setPinOpen(false)} className="border-line min-h-[60px] rounded-2xl border text-lg font-bold">
                  {m.kiosk.stay}
                </button>
              </>
            ) : (
              <>
                <div className="flex justify-center gap-[18px]" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={`size-5 rounded-full ${i < pin.length ? 'bg-primary' : 'border-line border-2'}`} />
                  ))}
                </div>
                <Keypad onPress={(k) => void pressPin(k)} compact />
                <button type="button" onClick={() => setPinOpen(false)} className="text-primary-ink min-h-[52px] text-[17px] font-bold">
                  {m.common.cancel}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Keypad({ onPress, compact }: { onPress: (k: (typeof KEYS)[number]) => void; compact?: boolean }) {
  return (
    <div className={`grid grid-cols-3 gap-2.5 ${compact ? '' : 'flex-1'}`}>
      {KEYS.map((k) => {
        const action = k === 'clr' || k === 'del';
        return (
          <button
            key={k}
            type="button"
            onClick={() => onPress(k)}
            aria-label={k === 'clr' ? m.kiosk.clear : k === 'del' ? m.kiosk.deleteDigit : k}
            className={`flex items-center justify-center rounded-[18px] font-extrabold active:scale-[0.97] ${compact ? 'min-h-[60px]' : 'min-h-[60px] landscape:min-h-0'} ${
              action ? 'border-line text-muted border bg-transparent text-xl' : 'bg-surface-2 text-ink text-[34px]'
            }`}
          >
            {k === 'clr' ? m.kiosk.clear : k === 'del' ? '⌫' : k}
          </button>
        );
      })}
    </div>
  );
}

function BigPhoto({ name, seed, url, size, ring }: { name: string; seed: string | number; url: string | null; size: string; ring?: string }) {
  if (url) return <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover ${ring ?? ''}`} />;
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full font-extrabold text-white ${ring ?? ''}`}
      style={{ background: avatarColor(seed) }}
    >
      {initials(name)}
    </span>
  );
}

const TONES = {
  active: { wrap: 'bg-[#0b5d35] text-white', badge: 'bg-white text-[#0b5d35]', btn: 'bg-white text-[#0b5d35]', icon: CircleCheck },
  due: { wrap: 'bg-[#f2b33d] text-[#2a1a00]', badge: 'bg-[#2a1a00] text-[#f2b33d]', btn: 'bg-[#2a1a00] text-[#fff3d6]', icon: Clock },
  overdue: { wrap: 'bg-[#9f1d1d] text-white', badge: 'bg-white text-[#9f1d1d]', btn: 'bg-white text-[#9f1d1d]', icon: TriangleAlert },
  none: { wrap: 'bg-[#9f1d1d] text-white', badge: 'bg-white text-[#9f1d1d]', btn: 'bg-white text-[#9f1d1d]', icon: TriangleAlert },
} as const;

function ResultOverlay({ display, secondsBack, onDone }: { display: Display; secondsBack: number; onDone: () => void }) {
  if (display.kind === 'notfound') {
    return (
      <div role="alert" className="animate-slide-in bg-surface text-ink fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="relative flex size-[200px] items-center justify-center rounded-full bg-[#4a5a51] text-7xl font-extrabold text-white">
          ?
          <span className="bg-bad text-surface absolute right-1.5 bottom-1.5 flex size-16 items-center justify-center rounded-full">
            <X className="size-9" strokeWidth={3} aria-hidden />
          </span>
        </span>
        <div className="text-2xl font-bold opacity-90">{m.kiosk.digits(display.digits)}</div>
        <div className="text-[clamp(40px,7vh,62px)] font-extrabold">{m.kiosk.notFound}</div>
        <div className="text-[clamp(22px,3.6vh,30px)] font-bold">{m.kiosk.notFoundLine1}</div>
        <div className="text-[clamp(18px,2.8vh,23px)] font-semibold opacity-90">{m.kiosk.notFoundLine2}</div>
        <Footer secondsBack={secondsBack} via={m.checkinMethod.keypad} onDone={onDone} btn="bg-primary text-white" />
      </div>
    );
  }
  const r = display.result;
  const tone = TONES[r.status];
  const Icon = tone.icon;
  const first = firstName(r.name);
  let kicker = m.kiosk.checkedIn;
  let title = m.kiosk.welcome(first);
  let line1 = '';
  let line2 = '';
  if (r.repeat) kicker = m.kiosk.already;
  if (r.status === 'active') {
    line1 = r.planName && r.validTill ? m.kiosk.planValidTill(r.planName, formatShortDate(r.validTill)) : '';
    line2 = m.kiosk.visit(r.visitsThisMonth);
  } else if (r.status === 'due') {
    line1 = m.kiosk.dueIn(r.daysLeft ?? 0);
    line2 = m.kiosk.dueLine2(formatShortDate(r.validTill), r.visitsThisMonth);
  } else {
    kicker = r.name;
    title = r.status === 'overdue' ? m.kiosk.overdue(r.overdueDays ?? 0) : m.kiosk.noPlan;
    line1 = r.amountDue != null ? m.kiosk.amountDue(formatRs(r.amountDue)) : '';
    line2 = m.kiosk.seeDesk;
  }
  return (
    <div role="alert" className={`animate-slide-in fixed inset-0 z-40 flex flex-col items-center justify-center gap-[2.2vh] px-6 text-center ${tone.wrap}`}>
      <div className="relative">
        <BigPhoto name={r.name} seed={r.memberNo} url={r.photoUrl} size="size-[min(240px,32vh)] text-[min(92px,12vh)]" ring="border-[7px] border-white/90" />
        <span className={`absolute right-1.5 bottom-1.5 flex size-[68px] items-center justify-center rounded-full ${tone.badge}`}>
          <Icon className="size-[38px]" strokeWidth={2.8} aria-hidden />
        </span>
      </div>
      <div className="text-2xl font-bold opacity-90">{kicker}</div>
      <div className="max-w-[1080px] text-[clamp(40px,7.5vh,62px)] leading-[1.05] font-extrabold">{title}</div>
      {line1 && <div className="text-[clamp(22px,3.6vh,30px)] font-bold">{line1}</div>}
      {line2 && <div className="text-[clamp(18px,2.8vh,23px)] font-semibold opacity-90">{line2}</div>}
      <Footer secondsBack={secondsBack} via={m.checkinMethod[r.method]} onDone={onDone} btn={tone.btn} />
    </div>
  );
}

function Footer({ secondsBack, via, onDone, btn }: { secondsBack: number; via: string; onDone: () => void; btn: string }) {
  return (
    <div className="absolute inset-x-0 bottom-[4vh] flex items-center justify-center gap-5">
      <span className="text-[19px] font-bold opacity-85">{m.kiosk.backIn(via, secondsBack)}</span>
      <button type="button" onClick={onDone} className={`min-h-14 rounded-2xl px-7 text-xl font-extrabold ${btn}`}>
        {m.common.done}
      </button>
    </div>
  );
}
