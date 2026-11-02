import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Queijo Fresco | Pedidos', template: '%s | Queijo Fresco' },
  description: 'Pedidos de queijo fresco para o seu estabelecimento. Simples, direto e feito com cuidado.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><a href="#main-content" className="skip-link">Ir para o conteúdo</a>{children}</body></html>;
}
