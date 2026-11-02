import type { ReactNode } from 'react';
import Link from 'next/link';
import { logoutAction } from '@/lib/actions';
import { Navigation } from './navigation';

function CheeseMark() {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M7 17 27 7l8 10v16H7V17Z" fill="currentColor" opacity=".16"/><path d="M7 17 27 7l8 10H7Zm0 0v16h28V17" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="16" cy="24" r="2" fill="currentColor"/><circle cx="27" cy="27" r="3" fill="currentColor"/></svg>;
}

export function Brand() {
  return <span className="brand"><span className="brand-mark"><CheeseMark /></span><span>Queijo Fresco<small>DA NOSSA FAMÍLIA PARA A SUA</small></span></span>;
}

export function AppShell({ role, name, children }: {
  role: 'admin' | 'establishment';
  name: string;
  children: ReactNode;
}) {
  const admin = role === 'admin';
  return <div className="app-shell">
    <header className="site-header"><div className="header-inner">
      <Link href={admin ? '/admin' : '/pedidos'} aria-label="Queijo Fresco — início"><Brand /></Link>
      <div className="account"><span><strong>{name}</strong><small>{admin ? 'Administração' : 'Área do estabelecimento'}</small></span>
        <form action={logoutAction}><button className="signout" type="submit">Sair <span aria-hidden="true">↗</span></button></form>
      </div>
    </div><Navigation role={role} /></header>
    <main id="main-content" className="main-content">{children}</main>
    <footer className="site-footer"><span>Queijo fresco. Pedido simples.</span><span>Feito com cuidado, todos os dias.</span></footer>
  </div>;
}