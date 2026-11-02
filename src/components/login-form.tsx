'use client';

import { useActionState, useState } from 'react';
import { loginAction } from '@/lib/actions';
import { Notice, SubmitButton } from './ui';
import { Icon } from './icon';

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, {});
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  return <form action={formAction} className="stack login-form">
    {state.error && <Notice kind="error">{state.error}</Notice>}
    <div className="field"><label htmlFor="email">Seu e-mail</label><input className="input" type="email" id="email" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Digite seu e-mail" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
    <div className="field"><label htmlFor="password">Sua senha</label><input className="input" type={showPassword ? 'text' : 'password'} id="password" name="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><label className="show-password"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} aria-controls="password" />Mostrar senha</label></div>
    <SubmitButton className="button button-wide" pendingText="Entrando…">Entrar na minha conta<Icon name="arrow" /></SubmitButton>
  </form>;
}
