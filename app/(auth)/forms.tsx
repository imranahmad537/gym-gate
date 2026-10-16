'use client';
import Link from 'next/link';
import { ArrowRight, CircleAlert, CircleCheck, Eye, EyeOff, MailCheck } from 'lucide-react';
import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { AuthHeading } from '@/components/auth-heading';
import { Button } from '@/components/ui/button';
import { Hint, Input, Label } from '@/components/ui/field';
import { m } from '@/messages';
import { createGymAction, forgotPasswordAction, loginAction, resendConfirmationAction, resetPasswordAction, signupAction, type FormState } from './actions';

const linkClass = 'text-primary-ink font-bold underline-offset-4 hover:underline';
const RESEND_COOLDOWN = 60;

/** Builds an auth link that carries the email and the page to return to. */
function authHref(path: string, { email, next }: { email?: string; next?: string }) {
  const q = new URLSearchParams();
  if (email) q.set('email', email);
  if (next && next !== '/') q.set('next', next);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** Error or success message. Errors take focus so screen readers announce them and keyboard users land on them. */
function Notice({ state, children }: { state: FormState; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state?.error) ref.current?.focus();
  }, [state]);
  if (!state?.error && !state?.message) return null;
  const isError = Boolean(state.error);
  const Icon = isError ? CircleAlert : CircleCheck;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={isError ? 'alert' : 'status'}
      className={`flex gap-2.5 rounded-2xl px-4 py-3 text-[15px] font-semibold outline-none ${isError ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok'}`}
    >
      <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <p>{state.error ?? state.message}</p>
        {children}
      </div>
    </div>
  );
}

function EmailField({ defaultValue, autoFocus }: { defaultValue?: string; autoFocus?: boolean }) {
  return (
    <div>
      <Label htmlFor="email">{m.auth.email}</Label>
      {/* "username" lets password managers pair the email with the password field. */}
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={254}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        required
      />
    </div>
  );
}

function PasswordField({ label, autoComplete, hint, aside }: { label: string; autoComplete: string; hint?: string; aside?: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Label htmlFor="password">{label}</Label>
        {aside}
      </div>
      <div className="relative">
        <Input
          id="password"
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          minLength={hint ? 8 : undefined}
          required
          className="pr-14"
          aria-describedby={hint ? 'password-hint' : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={m.auth.showPassword}
          aria-pressed={visible}
          aria-controls="password"
          className="text-muted hover:text-ink hover:bg-surface-2 absolute inset-y-0 right-1.5 my-auto flex size-11 items-center justify-center rounded-full transition-colors"
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
      {hint && <Hint id="password-hint">{hint}</Hint>}
    </div>
  );
}

export function LoginForm({ next, email, notice }: { next?: string; email?: string; notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, notice ? { error: notice } : null);
  // Lost confirmation email: let the owner resend it from here instead of getting stuck.
  const [resent, resendAction, resending] = useActionState(resendConfirmationAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? '/'} />
      <EmailField defaultValue={state?.email ?? email} />
      <PasswordField
        label={m.auth.password}
        autoComplete="current-password"
        aside={
          <Link
            href={authHref('/forgot-password', { email: state?.email ?? email })}
            className="text-primary-ink text-sm font-bold underline-offset-4 hover:underline"
          >
            {m.auth.forgot}
          </Link>
        }
      />
      <Notice state={state}>
        {state?.unconfirmed &&
          (resent?.email === state.email ? (
            <p className="font-bold">{resent?.error ?? resent?.message}</p>
          ) : (
            // formAction sends this same form (email + next) to the resend action; formNoValidate skips the password check.
            <button
              type="submit"
              formAction={resendAction}
              formNoValidate
              disabled={resending}
              className="self-start font-bold underline underline-offset-4 disabled:opacity-60"
            >
              {m.auth.resendConfirmation}
            </button>
          ))}
      </Notice>
      <Button type="submit" size="lg" loading={pending} className="mt-1">
        {m.auth.login}
      </Button>
      <p className="text-muted text-center text-[15px]">
        {m.auth.noAccount}{' '}
        <Link href={authHref('/signup', { next })} className={linkClass}>
          {m.auth.createAccount}
        </Link>
      </p>
    </form>
  );
}

/** Signup, then a "check your inbox" screen. "Start over" remounts the flow with the email kept. */
export function SignupForm({ next }: { next?: string }) {
  const [attempt, setAttempt] = useState({ n: 0, email: '' });
  return <SignupFlow key={attempt.n} next={next} initialEmail={attempt.email} onRestart={(email) => setAttempt((a) => ({ n: a.n + 1, email }))} />;
}

function SignupFlow({ next, initialEmail, onRestart }: { next?: string; initialEmail: string; onRestart: (email: string) => void }) {
  const [state, action, pending] = useActionState(signupAction, initialEmail ? { email: initialEmail } : null);
  const sentTo = state?.sentTo;
  if (sentTo) return <CheckInbox email={sentTo} next={next} onRestart={() => onRestart(sentTo)} />;
  return (
    <>
      <AuthHeading title={m.auth.signupTitle} subtitle={m.auth.signupSubtitle} />
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? '/'} />
        <EmailField defaultValue={state?.email} autoFocus={Boolean(initialEmail)} />
        <PasswordField label={m.auth.password} autoComplete="new-password" hint={m.auth.passwordHint} />
        <Notice state={state}>
          {state?.accountExists && (
            <Link href={authHref('/login', { email: state.email, next })} className="inline-flex items-center gap-1 font-bold underline underline-offset-4">
              {m.auth.signInInstead}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </Notice>
        <Button type="submit" size="lg" loading={pending} className="mt-1">
          {m.auth.signup}
        </Button>
        <p className="text-muted text-center text-[15px]">
          {m.auth.haveAccount}{' '}
          <Link href={authHref('/login', { next })} className={linkClass}>
            {m.auth.login}
          </Link>
        </p>
      </form>
    </>
  );
}

function CheckInbox({ email, next, onRestart }: { email: string; next?: string; onRestart: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await resendConfirmationAction(prev, form);
    if (result?.message) setSecondsLeft(RESEND_COOLDOWN);
    return result;
  }, null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  return (
    <>
      <AuthHeading
        icon={<MailCheck className="size-7" aria-hidden />}
        title={m.auth.inboxTitle}
        subtitle={
          <>
            {m.auth.inboxSentTo} <strong className="text-ink font-bold break-all">{email}</strong>. {m.auth.inboxNext}
          </>
        }
      />
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next ?? '/'} />
        <Notice state={state} />
        <Button type="submit" variant="secondary" size="lg" loading={pending} disabled={secondsLeft > 0}>
          {secondsLeft > 0 ? m.auth.resendIn(secondsLeft) : m.auth.resend}
        </Button>
        <p className="text-muted text-center text-[15px]">
          {m.auth.wrongEmail}{' '}
          <button type="button" onClick={onRestart} className={linkClass}>
            {m.auth.startOver}
          </button>
        </p>
      </form>
    </>
  );
}

export function ForgotForm({ email }: { email?: string }) {
  const [state, action, pending] = useActionState(forgotPasswordAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <EmailField defaultValue={state?.email ?? email} />
      <Notice state={state} />
      <Button type="submit" size="lg" loading={pending} className="mt-1">
        {m.auth.sendLink}
      </Button>
      <Link href={authHref('/login', { email: state?.email ?? email })} className={`${linkClass} text-center text-[15px]`}>
        {m.common.back}
      </Link>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <PasswordField label={m.auth.newPassword} autoComplete="new-password" hint={m.auth.passwordHint} />
      <Notice state={state} />
      <Button type="submit" size="lg" loading={pending} className="mt-1">
        {m.auth.setPassword}
      </Button>
    </form>
  );
}

export function SetupForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(createGymAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? '/'} />
      <div>
        <Label htmlFor="name">{m.setup.gymName}</Label>
        <Input id="name" name="name" placeholder={m.setup.gymNamePlaceholder} required minLength={2} maxLength={80} />
      </div>
      <div>
        <Label htmlFor="phone">{m.setup.phone}</Label>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" />
      </div>
      <div>
        <Label htmlFor="pin">{m.setup.pin}</Label>
        <Input
          id="pin"
          name="pin"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          autoComplete="off"
          required
          className="max-w-40 text-center text-2xl tracking-[0.4em]"
          aria-describedby="pin-hint"
        />
        <Hint id="pin-hint">{m.setup.pinHint}</Hint>
      </div>
      <p className="bg-surface-2 text-muted rounded-2xl px-4 py-3 text-sm leading-relaxed font-semibold">{m.setup.plansNote}</p>
      <Notice state={state} />
      <Button type="submit" size="lg" loading={pending} className="mt-1">
        {m.setup.submit}
      </Button>
    </form>
  );
}
