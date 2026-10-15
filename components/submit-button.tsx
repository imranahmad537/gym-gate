'use client';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import type { ComponentProps } from 'react';

/** Submit button that shows a spinner while its <form action> runs. */
export function SubmitButton(props: Omit<ComponentProps<typeof Button>, 'type' | 'loading'>) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} {...props} />;
}
