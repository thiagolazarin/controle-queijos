'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

export function PageHeading({ eyebrow, title, description, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return <header className="page-heading">
    <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted page-description">{description}</p>}</div>
    {action}
  </header>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span aria-hidden="true" className="empty-symbol">✓</span><h2>{title}</h2><p className="muted">{description}</p></div>;
}

export function StatusBadge({ cancelled }: { cancelled: boolean }) {
  return <span className={`badge ${cancelled ? 'badge-cancelled' : ''}`}><span aria-hidden="true">●</span> {cancelled ? 'Cancelado' : 'Confirmado'}</span>;
}

export function Notice({ kind, children }: { kind: 'success' | 'error'; children: ReactNode }) {
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`notice notice-${kind}`}>{children}</div>;
}

export function SubmitButton({ children, pendingText = 'Salvando…', className = 'button' }: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending}>{pending ? pendingText : children}</button>;
}