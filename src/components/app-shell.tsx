import type { ReactNode } from 'react';
import Link from 'next/link';
import { logoutAction } from '@/lib/actions';
import { Navigation } from './navigation';

function FarmMark() {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M3 31c6-4 13-4 19-1 5 2 10 2 15-1" stroke="currentColor" strokeWidth="1.5" opacity=".45" /><path d="m9 17 11-9 11 9v15H9V17Z" fill="currentColor" opacity=".1" /><path d="m7 18 13-11 13 11M10 16v16h20V16M16 32V21h8v11m-8-10 8 10m0-10-8 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M18 13h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

export function Brand() {
  return <span className="brand"><span className="brand-mark"><FarmMark /></span><span>Queijo Fresco<small>Pedidos da família</small></span></span>;
}

export function AppShell({ role, name, children }: { role: 'admin' | 'establishment'; name: string; children: ReactNode }) {
  const admin = role === 'admin';
  return <div className="app-shell">
    <header className="site-header"><div className="header-inner">
      <Link href={admin ? '/admin' : '/pedidos'} aria-label="Queijo Fresco — início"><Brand /></Link>
      <div className="account"><span className="account-name"><strong>{name}</strong><small>{admin ? 'Administração' : 'Seu estabelecimento'}</small></span>
        <form action={logoutAction}><button className="signout" type="submit">Sair da conta</button></form>
      </div>
    </div><Navigation role={role} /></header>
    <main id="main-content" className="main-content">{children}</main>
    <footer className="site-footer">Queijo Fresco · Feito em família.</footer>
  </div>;
}
