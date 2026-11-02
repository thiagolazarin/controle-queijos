'use client';

import { useActionState, type ReactNode } from 'react';
import type { ActionState } from '@/lib/action-state';
import { Notice } from './ui';

export function ActionForm({ action, children, className = 'stack' }: {
  action: (previous: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return <form action={formAction} className={className}>
    {state.error && <Notice kind="error">{state.error}</Notice>}
    {state.success && <Notice kind="success">{state.success}</Notice>}
    {children}
  </form>;
}