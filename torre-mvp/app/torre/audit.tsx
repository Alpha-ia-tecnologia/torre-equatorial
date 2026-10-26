"use client";

import { useState } from "react";
import { download, toCSV } from "./engine";
import { useTorre } from "./store";
import type { AuditCategory, AuditEvent } from "./types";
import { Empty, Modal, Owner, PageTitle } from "./ui";

const groups: [string, string, AuditCategory[] | null][] = [
  ["todos", "Todos", null], ["valores", "Valores", ["VALOR"]], ["estrutura", "Estrutura", ["ESTRUTURA", "REGUA", "PESO"]],
  ["importacoes", "Importações", ["IMPORTACAO"]], ["governanca", "Cenário e acessos", ["CENARIO", "ACESSO", "ORGANIZACAO", "CALENDARIO"]],
];

export function Audit() {
  const { db, scn } = useTorre();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<AuditEvent | null>(null);
  const cats = groups.find(g => g[0] === group)![2];
  const scoped = db.audit.filter(a => a.year === scn.year);
  const shown = scoped.filter(a => (!cats || cats.includes(a.category)) && (!from || a.at.slice(0, 10) >= from) && (!to || a.at.slice(0, 10) <= to)
    && `${a.userName} ${a.action} ${a.entity} ${a.before ?? ""} ${a.after ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const lastImport = scoped.find(a => a.category === "IMPORTACAO");
  const complete = scoped.filter(a => a.userId && a.at).length;
  return <><PageTitle eyebrow="RASTREABILIDADE" title="Auditoria e histórico" desc="Cada criação, alteração e exclusão de cadastro ou valor, com autor, data/hora, valor anterior e novo."
    actions={<button onClick={() => download(`auditoria-${scn.year}.csv`, toCSV([["DATA_HORA", "USUARIO", "CATEGORIA", "ACAO", "OBJETO", "ANTES", "DEPOIS"], ...shown.map(a => [new Date(a.at).toLocaleString("pt-BR"), a.userName, a.category, a.action, a.entity, a.before, a.after])]))}>⇩ Exportar trilha</button>} />
    <div className="audit-kpis"><div><span>ALTERAÇÕES NO CENÁRIO {scn.year}</span><strong>{scoped.length}</strong><small>por {new Set(scoped.map(a => a.userId)).size} usuário(s)</small></div><div><span>ÚLTIMA IMPORTAÇÃO</span><strong>{lastImport?.after?.split(" ")[0] ?? "—"}<small> registros</small></strong><small>{lastImport ? `${lastImport.after} · ${new Date(lastImport.at).toLocaleDateString("pt-BR")}` : "Nenhuma importação"}</small></div><div><span>INTEGRIDADE</span><strong>{scoped.length ? Math.round(complete / scoped.length * 100) : 100}<small>%</small></strong><small>eventos com autor e data/hora</small></div></div>
    <section className="table-panel audit-table"><div className="toolbar"><div className="search">⌕<input placeholder="Buscar evento, usuário, objeto ou valor..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      {groups.map(([id, label, c]) => <button key={id} className={`chip ${group === id ? "active" : ""}`} onClick={() => setGroup(id)}>{label} <b>{scoped.filter(a => !c || c.includes(a.category)).length}</b></button>)}
      <label className="date-filter">De<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="date-filter">Até<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
      <div className="table-scroll"><table><thead><tr><th>Data e hora</th><th>Usuário</th><th>Ação</th><th>Objeto</th><th>Antes → depois</th><th></th></tr></thead><tbody>{shown.map(a => <tr key={a.id}>
        <td>{new Date(a.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td><td><Owner name={a.userName} /></td><td><span className="audit-action">{a.action}</span></td><td>{a.entity}</td>
        <td><code>{a.before ?? ""}{a.before || a.after ? " → " : ""}{a.after ?? ""}</code></td><td><button className="row-action" onClick={() => setDetail(a)}>Detalhes</button></td></tr>)}</tbody></table></div>
      {!shown.length && <Empty>Nenhum evento para os filtros selecionados.</Empty>}
    </section>
    {detail && <Modal eyebrow={`AUDITORIA · ${detail.category}`} title={detail.action} subtitle={detail.entity} onClose={() => setDetail(null)}>
      <div className="detail-summary"><div><span>Usuário</span><strong>{detail.userName}</strong></div><div><span>Data e hora</span><strong>{new Date(detail.at).toLocaleString("pt-BR")}</strong></div><div><span>Valor anterior</span><strong>{detail.before ?? "—"}</strong></div><div><span>Valor novo</span><strong>{detail.after ?? "—"}</strong></div><div><span>Cenário</span><strong>{detail.year}</strong></div><div><span>Identificador</span><strong>{detail.id}</strong></div></div>
    </Modal>}
  </>;
}
