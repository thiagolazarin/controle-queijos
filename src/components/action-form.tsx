'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import type { ActionState } from '@/lib/action-state';
import { Notice } from './ui';

export function ActionForm({ action, children, className = 'stack' }: {
  action: (previous: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const errorNotice = useRef<HTMLDivElement>(null);
  const [state, formAction] = useActionState(async (previous: ActionState, values: FormData) => {
    const result = await action(previous, values);
    if (result.success && !result.error) {
      form.current?.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((field) => {
        field.value = '';
      });
    }
    return result;
  }, {});

  useEffect(() => {
    if (state.error) errorNotice.current?.focus();
  }, [state]);

  // React also resets uncontrolled fields when an action returns a validation error.
  // Keep the entered data for corrections; successful actions clear password fields above.
  return <form ref={form} action={formAction} className={className} onReset={(event) => event.preventDefault()}>
    {state.error && <div ref={errorNotice} tabIndex={-1}><Notice kind="error">{state.error}</Notice></div>}
    {state.success && <Notice kind="success">{state.success}</Notice>}
    {children}
  </form>;
}