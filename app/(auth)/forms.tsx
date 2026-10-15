'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Hint, Input, Label } from '@/components/ui/field';
import { m } from '@/messages';
import { createGymAction, forgotPasswordAction, loginAction, resetPasswordAction, signupAction, type FormState } from './actions';

function Notice({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="bg-bad-soft text-bad rounded-xl px-3.5 py-3 text-[15px] font-bold">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="bg-ok-soft text-ok rounded-xl px-3.5 py-3 text-[15px] font-bold">
        {state.message}
      </p>
    );
  return null;
}

function EmailField() {
  return (
    <div>
      <Label htmlFor="email">{m.auth.email}</Label>
      <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? '/'} />
      <EmailField />
      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">{m.auth.password}</Label>
          <Link href="/forgot-password" className="text-primary-ink text-sm font-bold">
            {m.auth.forgot}
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Notice state={state} />
      <Button type="submit" size="lg" loading={pending}>
        {m.auth.login}
      </Button>
      <p className="text-muted text-center text-[15px]">
        {m.auth.noAccount}{' '}
        <Link href="/signup" className="text-primary-ink font-extrabold">
          {m.auth.createAccount}
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <EmailField />
      <div>
        <Label htmlFor="password">{m.auth.password}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required aria-describedby="pw-hint" />
        <Hint id="pw-hint">{m.auth.passwordHint}</Hint>
      </div>
      <Notice state={state} />
      <Button type="submit" size="lg" loading={pending}>
        {m.auth.signup}
      </Button>
      <p className="text-muted text-center text-[15px]">
        {m.auth.haveAccount}{' '}
        <Link href="/login" className="text-primary-ink font-extrabold">
          {m.auth.login}
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <EmailField />
      <Notice state={state} />
      <Button type="submit" size="lg" loading={pending}>
        {m.auth.sendLink}
      </Button>
      <Link href="/login" className="text-primary-ink text-center text-[15px] font-extrabold">
        {m.common.back}
      </Link>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="password">{m.auth.newPassword}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <Hint>{m.auth.passwordHint}</Hint>
      </div>
      <Notice state={state} />
      <Button type="submit" size="lg" loading={pending}>
        {m.auth.setPassword}
      </Button>
    </form>
  );
}

export function SetupForm() {
  const [state, action, pending] = useActionState(createGymAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
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
      <p className="bg-surface-2 text-muted rounded-xl px-3.5 py-3 text-sm leading-relaxed font-semibold">{m.setup.plansNote}</p>
      <Notice state={state} />
      <Button type="submit" size="lg" loading={pending}>
        {m.setup.submit}
      </Button>
    </form>
  );
}
