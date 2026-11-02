"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return <section className="card stack" role="alert">
    <h1 className="text-xl font-semibold">Não foi possível carregar esta página</h1>
    <p className="muted">Verifique sua conexão e tente novamente. Se o problema continuar, confira a configuração do Supabase.</p>
    <div><button className="button" onClick={reset}>Tentar novamente</button></div>
  </section>;
}
