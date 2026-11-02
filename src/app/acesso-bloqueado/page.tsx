import { logoutAction } from '@/lib/actions';
import { Brand } from '@/components/app-shell';

export default function Blocked() {
  return <main id="main-content" className="center-page"><Brand /><section className="card stack"><p className="eyebrow">ACESSO INDISPONÍVEL</p><h1>Fale com a administração</h1><p>Seu acesso ainda não foi vinculado a um estabelecimento ativo. Entre em contato com nossa família para regularizar o cadastro.</p><form action={logoutAction}><button className="button" type="submit">Voltar para o login</button></form></section></main>;
}
