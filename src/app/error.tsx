'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" className="center-page"><section className="card stack"><p className="eyebrow">ALGO DEU ERRADO</p><h1>Não foi possível carregar</h1><p>Confira sua conexão e tente novamente. Se o problema continuar, fale com a administração.</p><button className="button" onClick={reset}>Tentar novamente</button></section></main>;
}
