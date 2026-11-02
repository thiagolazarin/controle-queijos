import Link from 'next/link';

export default function NotFound() {
  return <main id="main-content" className="center-page"><section className="card stack"><p className="eyebrow">PÁGINA NÃO ENCONTRADA</p><h1>Não encontramos este pedido ou página.</h1><Link className="button" href="/">Voltar ao início</Link></section></main>;
}
