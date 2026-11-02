import type { Metadata } from 'next';
import { Brand } from '@/components/app-shell';
import { ActionForm } from '@/components/action-form';
import { Notice, SubmitButton } from '@/components/ui';
import { loginAction } from '@/lib/actions';
import { hasSupabaseConfig } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'Entrar' };
export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  const configured = hasSupabaseConfig();
  return <main id="main-content" className="login-page">
    <aside className="login-story"><Brand /><div className="story-copy"><p className="eyebrow">SABOR DE CASA, TODOS OS DIAS</p><h1>Feito em família.<br />Pedido com<br /><em>simplicidade.</em></h1><p>O queijo fresco que você já conhece, agora com um jeito mais fácil de pedir.</p><div className="story-rule" /><span>Da nossa família para o seu estabelecimento.</span></div><span className="story-footer">Fresco no sabor. Simples no cuidado.</span><div className="cheese-art" aria-hidden="true"><span /><span /><span /><span /><span /></div></aside>
    <section className="login-panel"><div className="login-card"><div className="mobile-brand"><Brand /></div><p className="eyebrow">BEM-VINDO DE VOLTA</p><h2>Vamos fazer seu pedido?</h2><p className="muted">Entre com o acesso do seu estabelecimento.</p>
      {!configured ? <Notice kind="error">O sistema ainda precisa ser conectado ao Supabase. Configure as variáveis de ambiente conforme o guia de instalação do projeto.</Notice> : <>
        {motivo === 'sessao' && <Notice kind="error">Entre na sua conta para continuar.</Notice>}
        <ActionForm action={loginAction}><div className="field"><label htmlFor="email">E-mail</label><input className="input" type="email" id="email" name="email" autoComplete="username" placeholder="voce@estabelecimento.com.br" maxLength={254} required /></div><div className="field"><label htmlFor="password">Senha</label><input className="input" type="password" id="password" name="password" autoComplete="current-password" required /></div><SubmitButton className="button button-wide" pendingText="Entrando…">Entrar <span aria-hidden="true">→</span></SubmitButton></ActionForm>
      </>}
      <div className="login-help"><strong>Precisa de acesso ou esqueceu a senha?</strong><p>Fale com nossa família para cadastrar seu estabelecimento ou renovar sua senha.</p></div>
      <p className="login-caption">Acesso exclusivo para estabelecimentos e administração.</p>
    </div></section>
  </main>;
}
