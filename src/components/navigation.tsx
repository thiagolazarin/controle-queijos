'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navigation({ role }: { role: 'admin' | 'establishment' }) {
  const pathname = usePathname();
  const links = role === 'admin'
    ? [{ href: '/admin', label: 'Entregas do dia' }, { href: '/admin/pedidos', label: 'Pedidos' }, { href: '/admin/estabelecimentos', label: 'Estabelecimentos' }]
    : [{ href: '/pedidos', label: 'Fazer pedido' }, { href: '/pedidos/historico', label: 'Meus pedidos' }];
  return <nav aria-label="Menu principal" className="navigation">{links.map(({ href, label }) => {
    const home = href === '/admin' || href === '/pedidos';
    const active = home ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    return <Link key={href} href={href} aria-current={active ? 'page' : undefined} style={active ? { color: 'var(--green)', borderColor: 'var(--green)' } : undefined}>{label}</Link>;
  })}</nav>;
}