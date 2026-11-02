import type { Metadata } from 'next';
import { Brand } from '@/components/app-shell';
import { LoginForm } from '@/components/login-form';
import { Notice } from '@/components/ui';
import { hasSupabaseConfig } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'Entrar' };
export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  const configured = hasSupabaseConfig();
  return <main id="main-content" className="login-page">
    <div className="login-container"><div className="login-brand"><Brand /></div>
      <section className="login-card"><h1>Entre na sua conta</h1><p className="muted login-intro">Use seu e-mail e sua senha para continuar.</p>
        {!configured ? <Notice kind="error">O sistema ainda precisa ser configurado. Fale com a administração.</Notice> : <>
          {motivo === 'sessao' && <Notice kind="error">Entre na sua conta para continuar.</Notice>}
          <LoginForm />
        </>}
        <div className="login-help"><strong>Precisa de ajuda para entrar?</strong><p>Fale com nossa família para receber seu acesso ou trocar a senha.</p></div>
      </section>
      <p className="login-caption">Queijo fresco. Pedido simples.</p>
    </div>
  </main>;
}
