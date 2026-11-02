import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { requireProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const { establishment } = await requireProfile('establishment');
  return <AppShell role="establishment" name={establishment!.name}>{children}</AppShell>;
}
