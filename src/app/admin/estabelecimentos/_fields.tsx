import type { Establishment } from "../_lib/data";

export function EstablishmentFields({ initial }: { initial?: Establishment }) {
  return <>
    <div className="field"><label className="label" htmlFor="name">Nome do estabelecimento <span aria-hidden="true">*</span></label><input className="input" id="name" name="name" autoComplete="organization" maxLength={150} defaultValue={initial?.name || ""} required /></div>
    <div className="grid-2">
      <div className="field"><label className="label" htmlFor="contact_name">Responsável</label><input className="input" id="contact_name" name="contact_name" autoComplete="name" maxLength={150} defaultValue={initial?.contact_name || ""} /></div>
      <div className="field"><label className="label" htmlFor="phone">Telefone</label><input className="input" id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30} placeholder="(11) 99999-9999" defaultValue={initial?.phone || ""} /></div>
    </div>
    <div className="field"><label className="label" htmlFor="address">Endereço</label><textarea className="input" id="address" name="address" autoComplete="street-address" maxLength={500} rows={3} defaultValue={initial?.address || ""} /></div>
  </>;
}

export function AccessFields({ initialEmail = "" }: { initialEmail?: string }) {
  return <div className="grid-2">
    <div className="field"><label className="label" htmlFor="email">E-mail de acesso <span aria-hidden="true">*</span></label><input className="input" id="email" name="email" type="email" autoComplete="off" maxLength={254} defaultValue={initialEmail} required /></div>
    <div className="field"><label className="label" htmlFor="password">Senha inicial <span aria-hidden="true">*</span></label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} aria-describedby="password-hint" required /><p className="muted text-sm" id="password-hint">Pelo menos 12 caracteres. Entregue a senha ao responsável por um canal seguro.</p></div>
  </div>;
}
