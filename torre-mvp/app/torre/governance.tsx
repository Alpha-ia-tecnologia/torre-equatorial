"use client";

import { useState } from "react";
import { download, months, pad, weightViews } from "./engine";
import { roleLabel, useTorre } from "./store";
import type { Role, User } from "./types";
import { Guarded, Modal, Owner, PageTitle } from "./ui";

export function Governance() {
  const { can } = useTorre();
  const [tab, setTab] = useState<"organizacao" | "acessos" | "integracoes">("organizacao");
  const [modal, setModal] = useState<null | "org" | { user: User | null }>(null);
  return <><PageTitle eyebrow="GOVERNANÇA E CONTROLE" title="Organização e acessos" desc="Unidades, áreas, regionais, responsáveis, permissões e integrações corporativas."
    actions={tab === "organizacao" ? <Guarded allowed={can.access} reason="Cadastro organizacional restrito a administradores." className="primary" onClick={() => setModal("org")}>＋ Novo cadastro</Guarded>
      : tab === "acessos" ? <Guarded allowed={can.access} reason="Gestão de acessos restrita a administradores." className="primary" onClick={() => setModal({ user: null })}>＋ Novo usuário</Guarded> : undefined} />
    <div className="tabs governance-tabs"><button className={tab === "organizacao" ? "active" : ""} onClick={() => setTab("organizacao")}>Estrutura organizacional</button><button className={tab === "acessos" ? "active" : ""} onClick={() => setTab("acessos")}>Responsáveis e permissões</button><button className={tab === "integracoes" ? "active" : ""} onClick={() => setTab("integracoes")}>Integrações</button></div>
    {tab === "organizacao" && <Organization />}
    {tab === "acessos" && <Access onEdit={user => setModal({ user })} />}
    {tab === "integracoes" && <Integrations />}
    {modal === "org" && <OrgModal onClose={() => setModal(null)} />}
    {modal && typeof modal === "object" && <UserModal user={modal.user} onClose={() => setModal(null)} />}
  </>;
}

function Organization() {
  const { db, scn, can, mutate, notify } = useTorre();
  const [section, setSection] = useState<"companies" | "segments" | "codes">("companies");
  const [search, setSearch] = useState("");
  const [co, setCo] = useState("MA");
  const { companies, segments, regionals } = db.org;
  const q = search.toLowerCase();
  const toggle = (kind: "companies" | "segments" | "regionals", id: string, label: string, active: boolean) => {
    mutate(d => {
      const list = d.org[kind] as { active: boolean; id?: string; code?: string; inactiveSince?: string }[];
      const item = list.find(x => (x.id ?? x.code) === id)!;
      item.active = !active;
      if (kind === "companies") item.inactiveSince = active ? `${scn.year}-${pad(new Date().getMonth() + 1)}` : undefined;
    }, { category: "ORGANIZACAO", action: active ? "Desativou" : "Reativou", entity: label, before: active ? "Ativo" : "Inativo", after: active ? "Inativo · histórico preservado" : "Ativo" });
    notify(active ? `${label} desativado: some dos novos vínculos, mas permanece nas apurações históricas.` : `${label} reativado.`, active ? "warn" : "ok");
  };
  const codes = companies.filter(c => c.id === co).flatMap(c => segments.flatMap(s => [{ code: `${c.id}.${s.code}.00`, desc: `${c.name} · ${s.name} · área consolidada`, active: c.active && s.active },
    ...regionals.filter(r => r.company === c.id).map(r => ({ code: `${c.id}.${s.code}.${r.code}`, desc: `${c.name} · ${s.name} · Regional ${r.name}`, active: c.active && s.active && r.active }))]))
    .filter(x => `${x.code} ${x.desc}`.toLowerCase().includes(q));
  return <><div className="governance-kpis"><article><span>DISTRIBUIDORAS ATIVAS</span><strong>{companies.filter(c => c.active).length}</strong><small>{companies.filter(c => !c.active).length} inativa(s)</small></article><article><span>ÁREAS / SEGMENTOS</span><strong>{segments.filter(s => s.active).length}</strong><small>{segments.filter(s => !s.active).length} inativo(s) preservado(s)</small></article><article><span>REGIONAIS</span><strong>{regionals.filter(r => r.active).length}</strong><small>{regionals.filter(r => !r.active).length} inativa(s)</small></article><article><span>ÁREAS EXECUTORAS</span><strong>{companies.filter(c => c.active).length * segments.filter(s => s.active).length}</strong><small>Códigos compostos empresa.segmento</small></article></div>
    <section className="table-panel"><div className="toolbar"><div className="search">⌕<input placeholder="Buscar unidade, segmento, regional ou código..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <button className={`chip ${section === "companies" ? "active" : ""}`} onClick={() => setSection("companies")}>Distribuidoras e regionais</button><button className={`chip ${section === "segments" ? "active" : ""}`} onClick={() => setSection("segments")}>Áreas / segmentos</button><button className={`chip ${section === "codes" ? "active" : ""}`} onClick={() => setSection("codes")}>Códigos compostos</button>
      {section === "codes" && <select className="chip-select" value={co} onChange={e => setCo(e.target.value)}>{companies.map(c => <option key={c.id}>{c.id}</option>)}</select>}</div>
      <div className="table-scroll">{section === "companies" && <table><thead><tr><th>Código</th><th>Unidade organizacional</th><th>Regionais</th><th>Status</th><th>Vigência</th><th></th></tr></thead><tbody>{companies.filter(c => `${c.id} ${c.name} ${regionals.filter(r => r.company === c.id).map(r => r.name).join(" ")}`.toLowerCase().includes(q)).map(c => <tr key={c.id} className={c.active ? "" : "row-muted"}>
        <td><span className="company-code">{c.id}</span></td><td><strong>{c.name}</strong><small>Chave base {c.id}.SEG.REG</small></td>
        <td><div className="reg-list">{regionals.filter(r => r.company === c.id).map(r => <button key={r.id} className={`reg ${r.active ? "" : "off"}`} disabled={!can.access} title={r.active ? "Clique para desativar" : "Clique para reativar"} onClick={() => toggle("regionals", r.id, `Regional ${r.name} (${c.id}.${r.code})`, r.active)}>{r.code} {r.name}</button>)}</div></td>
        <td><span className={`status ${c.active ? "done" : "late"}`}><i></i>{c.active ? "Ativa" : "Inativa"}</span></td><td>Desde {c.since.slice(0, 4)}{c.inactiveSince ? ` · inativa em ${c.inactiveSince}` : ""}</td>
        <td>{can.access && <button className="row-action" onClick={() => toggle("companies", c.id, c.name, c.active)}>{c.active ? "Desativar" : "Reativar"}</button>}</td></tr>)}</tbody></table>}
      {section === "segments" && <table><thead><tr><th>Código</th><th>Área / segmento</th><th>Indicadores {scn.year}</th><th>Metas {scn.year}</th><th>Status</th><th></th></tr></thead><tbody>{segments.filter(s => `${s.code} ${s.name}`.toLowerCase().includes(q)).map(s => <tr key={s.code} className={s.active ? "" : "row-muted"}>
        <td><span className="company-code">{s.code}</span></td><td><strong>{s.name}</strong></td><td>{scn.indicators.filter(i => i.areas.includes(s.code)).map(i => i.code).join(", ") || "—"}</td><td>{scn.metas.filter(m => m.areas.includes(s.code)).length}</td>
        <td><span className={`status ${s.active ? "done" : "late"}`}><i></i>{s.active ? "Ativo" : "Inativo · visível em apurações históricas"}</span></td><td>{can.access && <button className="row-action" onClick={() => toggle("segments", s.code, `${s.name} (${s.code})`, s.active)}>{s.active ? "Desativar" : "Reativar"}</button>}</td></tr>)}</tbody></table>}
      {section === "codes" && <table><thead><tr><th>Código composto</th><th>Descrição completa</th><th>Status</th></tr></thead><tbody>{codes.map(x => <tr key={x.code} className={x.active ? "" : "row-muted"}><td><code>{x.code}</code></td><td>{x.desc}</td><td>{x.active ? "Disponível para vínculos" : "Inativo"}</td></tr>)}</tbody></table>}</div></section></>;
}

function OrgModal({ onClose }: { onClose: () => void }) {
  const { db, mutate, notify } = useTorre();
  const [kind, setKind] = useState<"company" | "segment" | "regional">("regional");
  const [code, setCode] = useState(""), [name, setName] = useState(""), [company, setCompany] = useState(db.org.companies.find(c => c.active)!.id);
  const nextReg = pad(Math.max(0, ...db.org.regionals.filter(r => r.company === company).map(r => +r.code)) + 1);
  const finalCode = kind === "regional" ? nextReg : code.toUpperCase();
  const dup = kind === "company" ? db.org.companies.some(c => c.id === finalCode) : kind === "segment" ? db.org.segments.some(s => s.code === finalCode) : false;
  const valid = name.trim() && (kind === "regional" || /^[A-Z0-9]{2,4}$/.test(finalCode)) && !dup;
  const preview = kind === "company" ? `${finalCode || "XX"}.SEG.REG` : kind === "segment" ? `EMP.${finalCode || "SEG"}.REG` : `${company}.SEG.${finalCode}`;
  function save() {
    mutate(d => {
      if (kind === "company") { d.org.companies.push({ id: finalCode, name: name.trim(), active: true, since: `${d.activeYear}-01-01` }); }
      else if (kind === "segment") d.org.segments.push({ code: finalCode, name: name.trim(), active: true });
      else d.org.regionals.push({ id: `${company}-${finalCode}`, company, code: finalCode, name: name.trim(), active: true });
    }, { category: "ORGANIZACAO", action: kind === "company" ? "Criou distribuidora" : kind === "segment" ? "Criou segmento" : "Criou regional", entity: `${name.trim()} (${preview})` });
    notify(kind === "company" ? "Distribuidora criada. Defina seus pesos em Réguas e pesos." : "Cadastro criado com código composto gerado."); onClose();
  }
  return <Modal eyebrow="ESTRUTURA ORGANIZACIONAL" title="Novo cadastro" subtitle="O código composto é gerado como unidade + segmento + regional." onClose={onClose} actions={<><button onClick={onClose}>Cancelar</button><button className="primary" disabled={!valid} onClick={save}>Cadastrar</button></>}>
    <div className="engine-form"><label>Tipo<select value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="company">Unidade / distribuidora</option><option value="segment">Área / segmento</option><option value="regional">Regional / subsegmento</option></select></label>
      {kind === "regional" ? <label>Distribuidora<select value={company} onChange={e => setCompany(e.target.value)}>{db.org.companies.filter(c => c.active).map(c => <option key={c.id}>{c.id}</option>)}</select></label> : <label>Código (2–4)<input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></label>}
      <label>Código composto<input value={preview} disabled /></label>
      <label className="span-3">Descrição completa<input value={name} onChange={e => setName(e.target.value)} placeholder={kind === "regional" ? "Ex.: Baixada Maranhense" : ""} /></label></div>
    {dup && <div className="form-error">Código já cadastrado.</div>}
  </Modal>;
}

const capabilities: [string, Record<Role, string>][] = [
  ["Cadastro estrutural (metas, índices, réguas, pesos)", { ADMIN: "✓", GESTOR: "—", APURADOR: "—", CONSULTA: "—" }],
  ["Lançar realizado", { ADMIN: "✓", GESTOR: "—", APURADOR: "Indicadores vinculados", CONSULTA: "—" }],
  ["Alterar previsto", { ADMIN: "✓", GESTOR: "—", APURADOR: "Se responsável técnico", CONSULTA: "—" }],
  ["Importar lote", { ADMIN: "✓", GESTOR: "—", APURADOR: "Linhas permitidas", CONSULTA: "—" }],
  ["Validar e fechar período / calendário", { ADMIN: "✓", GESTOR: "✓", APURADOR: "—", CONSULTA: "—" }],
  ["Consultar painéis, relatórios e auditoria", { ADMIN: "✓", GESTOR: "✓", APURADOR: "✓", CONSULTA: "✓" }],
];

function Access({ onEdit }: { onEdit: (u: User) => void }) {
  const { db, scn, can } = useTorre();
  const links = (u: User) => ({ owner: scn.indicators.filter(i => i.ownerId === u.id).map(i => i.code), apurador: scn.indicators.filter(i => i.apuradorIds.includes(u.id)).map(i => i.code) });
  return <><div className="permission-banner"><div><span>POLÍTICA DE ACESSO</span><h3>Permissões por papel, indicador e unidade</h3><p>Use o seletor de usuário no topo para simular cada perfil: botões bloqueados mostram o motivo. Toda alteração registra autor, data/hora e valor anterior.</p></div><b>✓ {db.users.filter(u => u.active).length} usuários ativos</b></div>
    <section className="table-panel"><div className="table-scroll"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Responsável técnico</th><th>Apurador</th><th>Distribuidoras</th><th>Status</th><th></th></tr></thead><tbody>{db.users.map(u => { const l = links(u); return <tr key={u.id} className={u.active ? "" : "row-muted"}>
      <td><Owner name={u.name} /></td><td><span className="audit-action">{roleLabel[u.role]}</span></td><td>{l.owner.join(", ") || "—"}</td><td>{l.apurador.join(", ") || "—"}</td><td>{u.companies.includes("*") ? "Todas" : u.companies.join(", ")}</td>
      <td><span className={`status ${u.active ? "done" : "late"}`}><i></i>{u.active ? "Ativo" : "Inativo"}</span></td><td>{can.access && <button className="row-action" onClick={() => onEdit(u)}>Editar</button>}</td></tr>; })}</tbody></table></div></section>
    <section className="panel rule-table"><div className="panel-head"><div><h2>Matriz de permissões por perfil</h2><p>Aplicada em todas as telas e na importação em lote (RF-09 e RF-14)</p></div></div>
      <table><thead><tr><th>Capacidade</th>{(Object.keys(roleLabel) as Role[]).map(r => <th key={r}>{roleLabel[r]}</th>)}</tr></thead><tbody>{capabilities.map(([cap, row]) => <tr key={cap}><td>{cap}</td>{(Object.keys(roleLabel) as Role[]).map(r => <td key={r}>{row[r]}</td>)}</tr>)}</tbody></table></section></>;
}

function UserModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { db, scn, mutate, notify } = useTorre();
  const [draft, setDraft] = useState<User>(() => user ?? { id: `u-${Date.now().toString(36)}`, name: "", role: "APURADOR", companies: [], active: true });
  const [owner, setOwner] = useState(scn.indicators.filter(i => i.ownerId === draft.id).map(i => i.code));
  const [apurador, setApurador] = useState(scn.indicators.filter(i => i.apuradorIds.includes(draft.id)).map(i => i.code));
  const all = draft.companies.includes("*");
  function save() {
    mutate(d => {
      const i = d.users.findIndex(u => u.id === draft.id);
      if (i >= 0) d.users[i] = draft; else d.users.push(draft);
      const s = d.scenarios.find(x => x.year === scn.year)!;
      for (const ind of s.indicators) {
        if (owner.includes(ind.code)) ind.ownerId = draft.id;
        else if (ind.ownerId === draft.id) ind.ownerId = d.users.find(u => u.role === "ADMIN")!.id;
        ind.apuradorIds = apurador.includes(ind.code) ? [...new Set([...ind.apuradorIds, draft.id])] : ind.apuradorIds.filter(x => x !== draft.id);
      }
    }, { category: "ACESSO", action: user ? "Alterou permissões" : "Criou usuário", entity: draft.name, before: user ? `${roleLabel[user.role]} · ${user.companies.join(", ")}` : undefined, after: `${roleLabel[draft.role]} · ${all ? "todas" : draft.companies.join(", ")} · resp. ${owner.join(", ") || "—"} · apura ${apurador.join(", ") || "—"}` });
    notify("Permissões salvas e aplicadas imediatamente."); onClose();
  }
  return <Modal wide eyebrow="RESPONSÁVEIS E APURADORES" title={user ? draft.name : "Novo usuário"} subtitle="O responsável técnico altera previsto e realizado; o apurador lança o realizado nas distribuidoras do seu escopo." onClose={onClose}
    actions={<><button onClick={onClose}>Cancelar</button><button className="primary" disabled={!draft.name.trim() || (!all && !draft.companies.length)} onClick={save}>Salvar</button></>}>
    <div className="engine-form"><label className="span-2">Nome<input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><label>Perfil<select value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value as Role })}>{(Object.keys(roleLabel) as Role[]).map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}</select></label>
      <fieldset className="span-3 checks-grid"><legend>Distribuidoras no escopo</legend><label><input type="checkbox" checked={all} onChange={e => setDraft({ ...draft, companies: e.target.checked ? ["*"] : [] })} />Todas</label>{db.org.companies.filter(c => c.active).map(c => <label key={c.id}><input type="checkbox" disabled={all} checked={all || draft.companies.includes(c.id)} onChange={e => setDraft({ ...draft, companies: e.target.checked ? [...draft.companies, c.id] : draft.companies.filter(x => x !== c.id) })} />{c.id}</label>)}</fieldset>
      <div className="span-3"><table className="mini-table"><thead><tr><th>Indicador ({scn.year})</th><th>Responsável técnico</th><th>Apurador</th></tr></thead><tbody>{scn.indicators.filter(i => i.kind === "BASE").map(i => <tr key={i.code}><td>{i.code} · {i.name}<small>Atual: {db.users.find(u => u.id === i.ownerId)?.name}</small></td>
        <td><input type="checkbox" checked={owner.includes(i.code)} onChange={e => setOwner(e.target.checked ? [...owner, i.code] : owner.filter(x => x !== i.code))} /></td>
        <td><input type="checkbox" checked={apurador.includes(i.code)} onChange={e => setApurador(e.target.checked ? [...apurador, i.code] : apurador.filter(x => x !== i.code))} /></td></tr>)}</tbody></table></div>
      <label className="inline-check"><input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />Usuário ativo</label></div>
  </Modal>;
}

function Integrations() {
  const { scn, month, calc, meta, weightView } = useTorre();
  const [open, setOpen] = useState<null | "api" | "sso" | "eva">(null);
  const payload = calc ? {
    cenario: scn.year, periodo: `${scn.year}-${pad(month)}`, meta: meta.name, visao: weightViews.find(v => v[0] === weightView)![1], status: scn.closedMonths.includes(month) ? "HOMOLOGADO" : "PREVIA",
    itens: calc.globalParts.map(p => ({ item: "Cumprimento Torre Investimentos Global", distribuidora: p.co, nota: p.score === null ? null : +p.score.toFixed(4), peso: p.weight })),
    global: calc.global === null ? null : +calc.global.toFixed(4),
  } : null;
  return <div className="integration-grid">
    <article><div className="integration-icon">ID</div><span>IDENTIDADE</span><h3>SSO corporativo</h3><p>Preparado para autenticação centralizada e sincronização de perfis do Grupo Equatorial.</p><div className="integration-status planned"><i></i>Simulado no protótipo</div><button onClick={() => setOpen("sso")}>Ver checklist</button></article>
    <article><div className="integration-icon">EV</div><span>INVESTIMENTOS</span><h3>Integração EVA</h3><p>Reutilização futura de premissas financeiras, parâmetros corporativos e ciclo de vida dos projetos.</p><div className="integration-status planned"><i></i>Evolução planejada</div><button onClick={() => setOpen("eva")}>Ver mapeamento</button></article>
    <article><div className="integration-icon">API</div><span>INTEROPERABILIDADE</span><h3>API de resultados</h3><p>Notas finais por item avaliável para consumo pela gestão de desempenho (aba NOTAS ELEGÍVEIS).</p><div className="integration-status"><i></i>Payload gerado do cálculo atual</div><button onClick={() => setOpen("api")}>Ver payload</button></article>
    {open === "api" && payload && <Modal wide eyebrow="GET /api/v1/notas-finais" title={`Notas finais · ${months[month - 1]}/${scn.year}`} subtitle="Contrato de saída gerado a partir da consolidação atual." onClose={() => setOpen(null)} actions={<><button onClick={() => setOpen(null)}>Fechar</button><button className="primary" onClick={() => download(`notas-finais-${scn.year}-${pad(month)}.json`, JSON.stringify(payload, null, 2), "application/json")}>⇩ Baixar JSON</button></>}><pre className="json">{JSON.stringify(payload, null, 2)}</pre></Modal>}
    {open === "sso" && <Modal eyebrow="SSO CORPORATIVO" title="Checklist técnico" onClose={() => setOpen(null)}><ul className="composition pad-list">{["Provedor OIDC/SAML do Grupo Equatorial", "Mapeamento de grupos AD → perfis da Torre", "Provisionamento de apuradores por indicador", "Sessão e logout centralizados", "Trilha de auditoria com identidade corporativa"].map(x => <li key={x}><span>{x}</span><b>Planejado</b></li>)}</ul></Modal>}
    {open === "eva" && <Modal eyebrow="INTEGRAÇÃO EVA" title="Mapeamento de dados" onClose={() => setOpen(null)}><ul className="composition pad-list">{[["Projetos de Investimento (PI)", "Detalhamento de indicadores"], ["Valor de referência (VR)", "Ponderação financeira"], ["Premissas financeiras", "Réguas FCA e capitalização"], ["Ciclo de vida do projeto", "Status de obras"]].map(([a, b]) => <li key={a}><span>{a}</span><b>{b}</b></li>)}</ul><p className="hint pad">Nenhuma integração ativa no protótipo: evolução opcional prevista na proposta técnica.</p></Modal>}
  </div>;
}
