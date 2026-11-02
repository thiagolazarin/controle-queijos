'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';

export function Navigation({ role }: { role: 'admin' | 'establishment' }) {
  const pathname = usePathname();
  const links = role === 'admin' ? [
    { href: '/admin', label: 'Entregas', icon: 'calendar' as const },
    { href: '/admin/pedidos', label: 'Pedidos', icon: 'orders' as const },
    { href: '/admin/estabelecimentos', label: 'Clientes', icon: 'customers' as const },
  ] : [
    { href: '/pedidos', label: 'Fazer pedido', icon: 'cheese' as const },
    { href: '/pedidos/historico', label: 'Meus pedidos', icon: 'history' as const },
  ];
  return <nav aria-label="Menu principal" className={`navigation ${role === 'admin' ? 'navigation-admin' : 'navigation-customer'}`}>
    {links.map(({ href, label, icon }, index) => {
      const active = role === 'establishment'
        ? index === 0 ? pathname === '/pedidos' : pathname.startsWith('/pedidos/')
        : index === 0 ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} aria-current={active ? 'page' : undefined}><Icon name={icon} /><span>{label}</span></Link>;
    })}
  </nav>;
}
