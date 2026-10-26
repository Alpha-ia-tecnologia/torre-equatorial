"use client";

import { useMemo, useState } from "react";

type View = "visao" | "apuracao" | "estrutura" | "reguas" | "governanca" | "calendario" | "relatorios" | "auditoria";
type Entry = {
  id: number; code: string; indicator: string; area: string; company: string;
  planned: number; actual: number | null; rule: string; polarity: "MAIOR" | "MENOR";
  min: number; target: number; challenge: number; weight: number; deadline: string; owner: string;
};
type PendingItem = {
  id: string; icon: string; severity: "red" | "amber" | "blue"; title: string; company: string;
  summary: string; category: string; deadline: string; owner: string; description: string; impact: string;
  actionLabel: string; targetView: View;
};

const companies = [
  { id: "MA", name: "Equatorial Maranhão", score: 8.86, gap: .46 },
  { id: "PA", name: "Equatorial Pará", score: 9.32, gap: .22 },
  { id: "PI", name: "Equatorial Piauí", score: 8.36, gap: -.18 },
  { id: "AL", name: "Equatorial Alagoas", score: 9.74, gap: .31 },
  { id: "RS", name: "CEEE Equatorial", score: 7.92, gap: -.64 },
  { id: "AP", name: "CEA Equatorial", score: 8.48, gap: .09 },
  { id: "GO", name: "Equatorial Goiás", score: 9.08, gap: .37 },
];

const initialEntries: Entry[] = [
  { id: 1, code: "01", indicator: "Avanço Físico VR", area: "Obras e Manutenção RD", company: "MA", planned: 11732.68, actual: 11468.02, rule: "VRC", polarity: "MAIOR", min: .70, target: 1, challenge: 1.1, weight: 32.9, deadline: "2025-11-05", owner: "Mariana Costa" },
  { id: 2, code: "02", indicator: "Status do Cronograma", area: "Obras AT", company: "MA", planned: .2929, actual: .250986, rule: "VRC", polarity: "MAIOR", min: .70, target: 1, challenge: 1.1, weight: 10.4, deadline: "2025-11-05", owner: "Paulo Nunes" },
  { id: 3, code: "03", indicator: "Avanço Financeiro", area: "Perdas", company: "MA", planned: 2504.73, actual: 892.68, rule: "VRC", polarity: "MAIOR", min: .70, target: 1, challenge: 1.1, weight: 4.2, deadline: "2025-11-04", owner: "Ana Lima" },
  { id: 4, code: "04", indicator: "Capitalização", area: "Serviços de Rede", company: "MA", planned: 2607.03, actual: 1694.89, rule: "VRC", polarity: "MAIOR", min: .70, target: 1, challenge: 1.1, weight: 4.8, deadline: "2025-11-04", owner: "Ana Lima" },
  { id: 5, code: "06", indicator: "Aprovação de Obras COMS", area: "Obras e Manutenção RD", company: "PA", planned: 96, actual: 99, rule: "PERCENTUAL", polarity: "MAIOR", min: .8, target: 1, challenge: 1.05, weight: 18.3, deadline: "2025-11-06", owner: "Rafael Alves" },
  { id: 6, code: "08", indicator: "Obras Fiscalizadas", area: "Manutenção RD", company: "PI", planned: 124, actual: null, rule: "PERCENTUAL", polarity: "MAIOR", min: .8, target: 1, challenge: 1.1, weight: 12.1, deadline: "2025-11-03", owner: "Carla Souza" },
];

const criticalPendencies: PendingItem[] = [
  { id: "works", icon: "!", severity: "red", title: "Obras Fiscalizadas", company: "PI", summary: "Vencido há 2 dias", category: "Resultado não informado", deadline: "03/11/2025", owner: "Carla Souza", description: "O valor realizado do indicador ainda não foi lançado para o período de outubro.", impact: "Impede a consolidação definitiva da nota da distribuidora PI e mantém o período com apuração incompleta.", actionLabel: "Registrar resultado", targetView: "apuracao" },
  { id: "approval", icon: "!", severity: "amber", title: "Carta de aprovação", company: "RS", summary: "Vence amanhã", category: "Documento pendente", deadline: "06/11/2025", owner: "Gestão de Obras RS", description: "A carta de aprovação precisa ser anexada e validada antes do fechamento mensal.", impact: "O indicador relacionado poderá ficar bloqueado para validação caso o documento não seja recebido no prazo.", actionLabel: "Acompanhar responsável", targetView: "governanca" },
  { id: "weight", icon: "i", severity: "blue", title: "Peso regional divergente", company: "GO", summary: "Soma 98,5%", category: "Inconsistência de configuração", deadline: "Antes do fechamento", owner: "Administrador do cenário", description: "Os pesos dos indicadores da regional GO totalizam 98,5%, abaixo dos 100% exigidos.", impact: "A inconsistência pode distorcer a consolidação e impede a validação completa do cenário.", actionLabel: "Revisar pesos", targetView: "reguas" },
];

const audits = [
  ["Hoje, 09:42", "Mariana Costa", "Atualizou realizado", "Avanço Físico VR · MA", "11.386,20 → 11.468,02"],
  ["Hoje, 08:17", "Administrador", "Validou fechamento", "Torre Elegível · Outubro", "Prévia liberada"],
  ["Ontem, 16:31", "Paulo Nunes", "Atualizou previsto", "Status do Cronograma · MA", "0,2880 → 0,2929"],
  ["18 out, 14:05", "Ana Lima", "Importou lote", "Base mensal · 42 registros", "40 válidos · 2 rejeitados"],
];

function score(e: Entry) {
  if (e.actual === null || !e.planned) return null;
  const result = e.actual / e.planned;
  const [low, mid, high] = e.polarity === "MAIOR"
    ? [e.min, e.target, e.challenge] : [e.challenge, e.target, e.min];
  if (e.polarity === "MAIOR") {
    if (result < low) return 0;
    if (result <= mid) return 1 + (result - low) * 9 / (mid - low);
    if (result <= high) return 10 + (result - mid) * 5 / (high - mid);
    return 15;
  }
  if (result > high) return 0;
  if (result >= mid) return 1 + (high - result) * 9 / (high - mid);
  if (result >= low) return 10 + (mid - result) * 5 / (mid - low);
  return 15;
}

const fmt = (n: number, d = 2) => n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });
const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function TorreApp() {
  const [view, setView] = useState<View>("visao");
  const [entries, setEntries] = useState(initialEntries);
  const [month, setMonth] = useState("Outubro");
  const [company, setCompany] = useState("Todas");
  const [role, setRole] = useState("Administrador");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [formula, setFormula] = useState<Entry | null>(null);
  const [pendingDetail, setPendingDetail] = useState<PendingItem | null>(null);

  const filtered = useMemo(() => entries.filter(e =>
    (company === "Todas" || e.company === company) &&
    (e.indicator + e.area + e.code).toLowerCase().includes(search.toLowerCase())
  ), [entries, company, search]);
  const complete = entries.filter(e => e.actual !== null).length;
  const weighted = entries.reduce((a, e) => a + (score(e) ?? 0) * e.weight, 0) /
    entries.filter(e => score(e) !== null).reduce((a, e) => a + e.weight, 0);

  function saveEntry() {
    if (!editing) return;
    setEntries(xs => xs.map(x => x.id === editing.id ? editing : x));
    fetch("/api/assessments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(editing) }).catch(() => undefined);
    setEditing(null);
    setNotice("Valor salvo e consolidações recalculadas.");
    setTimeout(() => setNotice(""), 2800);
  }

  const nav: [View, string, string][] = [
    ["visao", "Visão geral", "⌂"], ["apuracao", "Apuração", "◫"], ["estrutura", "Estrutura", "⌘"],
    ["reguas", "Réguas e pesos", "⌁"], ["governanca", "Governança", "◇"], ["calendario", "Calendário", "◷"],
    ["relatorios", "Relatórios", "▥"], ["auditoria", "Auditoria", "◎"],
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">T</div><div><strong>TORRE</strong><span>Investimentos</span></div></div>
        <div className="context"><span>CENÁRIO ATIVO</span><strong>Apuração 2025</strong><small>Em andamento</small></div>
        <nav>{nav.map(([id, label, icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><i>{icon}</i>{label}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="health"><span className="dot"></span><div><strong>Modelo consistente</strong><small>Pesos e réguas validados</small></div></div>
          <button className="profile"><span>NC</span><div><strong>Nataldo Costa</strong><small>{role}</small></div><b>···</b></button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div className="breadcrumb"><span>Torre de Investimentos</span><b>/</b><strong>{nav.find(n => n[0] === view)?.[1]}</strong></div>
          <div className="top-actions">
            <select value={role} onChange={e => setRole(e.target.value)} aria-label="Perfil"><option>Administrador</option><option>Gestor</option><option>Apurador</option><option>Consulta</option></select>
            <button className="icon-button" aria-label="Notificações">♢<em>3</em></button>
            <button className="primary" onClick={() => { setView("apuracao"); setNotice("Pronto para registrar um resultado."); }}>＋ Lançar resultado</button>
          </div>
        </header>

        <div className="content">
          {notice && <div className="toast">✓ {notice}</div>}
          {view === "visao" && <Dashboard month={month} setMonth={setMonth} company={company} setCompany={setCompany} weighted={weighted} complete={complete} onDetail={setFormula} onPending={setPendingDetail} />}
          {view === "apuracao" && <Assessment entries={filtered} month={month} setMonth={setMonth} company={company} setCompany={setCompany} search={search} setSearch={setSearch} onEdit={setEditing} onFormula={setFormula} />}
          {view === "estrutura" && <Structure notify={message => { setNotice(message); setTimeout(() => setNotice(""), 2800); }} />}
          {view === "reguas" && <Rules entries={entries} />}
          {view === "governanca" && <Governance notify={message => { setNotice(message); setTimeout(() => setNotice(""), 2800); }} />}
          {view === "calendario" && <Calendar entries={entries} />}
          {view === "relatorios" && <Reports />}
          {view === "auditoria" && <Audit />}
        </div>
      </main>

      {editing && <div className="modal-backdrop" onMouseDown={() => setEditing(null)}><section className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head"><div><span>LANÇAMENTO DE RESULTADO</span><h2>{editing.indicator}</h2><p>{editing.company} · {editing.area} · {month}/2025</p></div><button onClick={() => setEditing(null)}>×</button></div>
        <div className="form-grid"><label>Previsto acumulado<input type="number" value={editing.planned} onChange={e => setEditing({ ...editing, planned: +e.target.value })} /></label><label>Realizado acumulado<input autoFocus type="number" value={editing.actual ?? ""} onChange={e => setEditing({ ...editing, actual: e.target.value === "" ? null : +e.target.value })} /></label></div>
        <div className="calc-preview"><span>RESULTADO</span><strong>{editing.actual === null ? "—" : fmt(editing.actual / editing.planned * 100, 1) + "%"}</strong><span>NOTA CALCULADA</span><strong className="score">{score(editing) === null ? "—" : fmt(score(editing)!, 2)}</strong></div>
        <label className="notes">Justificativa / observação<textarea placeholder="Contextualize o resultado, se necessário." /></label>
        <div className="modal-actions"><button onClick={() => setEditing(null)}>Cancelar</button><button className="primary" onClick={saveEntry}>Salvar e recalcular</button></div>
      </section></div>}

      {pendingDetail && <div className="modal-backdrop" onMouseDown={() => setPendingDetail(null)}><section className="modal pending-modal" role="dialog" aria-modal="true" aria-labelledby="pending-detail-title" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head"><div><span>PENDÊNCIA CRÍTICA</span><h2 id="pending-detail-title">{pendingDetail.title}</h2><p>{pendingDetail.company} · {pendingDetail.category}</p></div><button aria-label="Fechar detalhes da pendência" onClick={() => setPendingDetail(null)}>×</button></div>
        <div className="pending-detail-hero"><i className={pendingDetail.severity}>{pendingDetail.icon}</i><div><span>SITUAÇÃO</span><strong>{pendingDetail.summary}</strong><small>Prazo: {pendingDetail.deadline}</small></div></div>
        <div className="pending-detail-grid"><div><span>Distribuidora</span><strong>{pendingDetail.company}</strong></div><div><span>Responsável</span><strong>{pendingDetail.owner}</strong></div></div>
        <div className="pending-detail-copy"><span>O QUE ESTÁ PENDENTE</span><p>{pendingDetail.description}</p><span>IMPACTO</span><p>{pendingDetail.impact}</p></div>
        <div className="modal-actions"><button onClick={() => setPendingDetail(null)}>Fechar</button><button className="primary" onClick={() => { const item = pendingDetail; setPendingDetail(null); setView(item.targetView); if (item.id === "works") { setCompany(item.company); setSearch(item.title); } setNotice(`${item.actionLabel}: contexto da pendência carregado.`); setTimeout(() => setNotice(""), 2800); }}>{pendingDetail.actionLabel}</button></div>
      </section></div>}

      {formula && <div className="drawer-backdrop" onMouseDown={() => setFormula(null)}><aside className="drawer indicator-detail" role="dialog" aria-modal="true" aria-labelledby="indicator-detail-title" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head"><div><span>DETALHAMENTO DO INDICADOR</span><h2 id="indicator-detail-title">{formula.indicator}</h2><p>CHAVE {formula.company}·{formula.area.slice(0,3).toUpperCase()}·10·{formula.code}</p></div><button aria-label="Fechar detalhamento" onClick={() => setFormula(null)}>×</button></div>
        <div className="detail-summary">
          <div><span>Código</span><strong>{formula.code}</strong></div><div><span>Distribuidora</span><strong>{formula.company}</strong></div>
          <div><span>Área executora</span><strong>{formula.area}</strong></div><div><span>Responsável</span><strong>{formula.owner}</strong></div>
          <div><span>Prazo</span><strong>{new Date(`${formula.deadline}T12:00:00`).toLocaleDateString("pt-BR")}</strong></div><div><span>Status</span><strong className={`detail-status ${formula.actual === null ? "late" : "done"}`}>{formula.actual === null ? "Atrasado" : "Apurado"}</strong></div>
        </div>
        <div className="big-score"><span>Nota apurada</span><strong>{score(formula) === null ? "—" : fmt(score(formula)!, 2)}</strong><small>peso {fmt(formula.weight, 1)}%</small></div>
        <h3>Valores do período</h3>
        <div className="trace">
          <div><span>Previsto</span><b>{fmt(formula.planned)}</b></div><i>→</i><div><span>Realizado</span><b>{formula.actual === null ? "Sem valor" : fmt(formula.actual)}</b></div><i>→</i><div><span>Resultado</span><b>{formula.actual === null ? "—" : fmt(formula.actual / formula.planned * 100, 1) + "%"}</b></div>
        </div>
        <h3>Régua aplicada · {formula.rule}</h3>
        <div className="ruler"><div style={{ width: `${Math.min(100, Math.max(0, ((formula.actual ?? 0) / formula.planned - formula.min) / (formula.challenge - formula.min) * 100))}%` }}></div><span style={{ left: "0%" }}>Mín. {fmt(formula.min * 100,0)}%</span><span style={{ left: "75%" }}>Meta 100%</span><span style={{ left: "100%" }}>Des. {fmt(formula.challenge * 100,0)}%</span></div>
        <div className="formula-box"><span>INTERPOLAÇÃO LINEAR</span><code>nota = 1 + (resultado − mínimo) × 9 ÷ (meta − mínimo)</code><p>Teto 15 · Piso 0 · Polaridade “quanto {formula.polarity === "MAIOR" ? "maior, melhor" : "menor, melhor"}”</p></div>
        <h3>Composição superior</h3>
        <ul className="composition"><li><span>{formula.indicator}</span><b>{fmt(formula.weight,1)}%</b></li><li><span>{formula.area}</span><b>Índice AFFA</b></li><li><span>Meta Torre Elegível 2025</span><b>60,0%</b></li></ul>
        <div className="drawer-actions"><button className="drawer-close" onClick={() => setFormula(null)}><span aria-hidden="true">×</span>Fechar</button><button className="drawer-edit primary" onClick={() => { setEditing({...formula}); setFormula(null); }}><span aria-hidden="true">✎</span>Editar resultado</button></div>
      </aside></div>}
    </div>
  );
}

function PageTitle({ eyebrow, title, desc, actions }: { eyebrow: string; title: string; desc: string; actions?: React.ReactNode }) {
  return <div className="page-title"><div><span>{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

function Filters({ month, setMonth, company, setCompany }: { month: string; setMonth: (x:string)=>void; company: string; setCompany:(x:string)=>void }) {
  return <div className="filters"><label>Período<select value={month} onChange={e=>setMonth(e.target.value)}>{months.map(m=><option key={m}>{m}</option>)}</select></label><label>Distribuidora<select value={company} onChange={e=>setCompany(e.target.value)}><option>Todas</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Visão<select><option>Torre Elegível</option><option>Direção Engenharia</option><option>Direção Obras</option><option>Superintendências</option></select></label></div>;
}

function Dashboard({ month,setMonth,company,setCompany,weighted,complete,onDetail,onPending }:{month:string;setMonth:(x:string)=>void;company:string;setCompany:(x:string)=>void;weighted:number;complete:number;onDetail:(e:Entry)=>void;onPending:(item:PendingItem)=>void}) {
  const history=[7.42,7.68,8.01,8.23,8.48,8.31,8.62,8.74,8.96,9.12];
  return <><PageTitle eyebrow="PAINEL EXECUTIVO" title="Torre de Investimentos" desc="Desempenho consolidado e andamento da apuração mensal." actions={<><button>⇩ Exportar</button><button className="secondary">Fechar período</button></>} /><Filters {...{month,setMonth,company,setCompany}} />
    <section className="kpi-grid">
      <article className="kpi featured"><div><span>NOTA GLOBAL</span><strong>{fmt(weighted,2)}</strong><small><b>↑ 0,24</b> vs. setembro</small></div><div className="gauge" style={{"--score":`${weighted/15*100}%`} as React.CSSProperties}><span>{fmt(weighted/15*100,0)}%</span></div></article>
      <article className="kpi"><span>APURAÇÃO</span><strong>{complete}<small> / {initialEntries.length}</small></strong><div className="progress"><i style={{width:`${complete/initialEntries.length*100}%`}}></i></div><p>{initialEntries.length-complete} indicador pendente</p></article>
      <article className="kpi"><span>NO PRAZO</span><strong>91<small>%</small></strong><div className="mini-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><p><b className="warning">2 entregas</b> requerem atenção</p></article>
      <article className="kpi"><span>CONSISTÊNCIA</span><strong>98<small>%</small></strong><div className="checks">✓ Pesos <b>100%</b><br/>✓ Réguas <b>válidas</b></div></article>
    </section>
    <section className="dashboard-grid">
      <article className="panel wide"><div className="panel-head"><div><h2>Evolução da nota global</h2><p>Consolidado mensal · 2025</p></div><div className="legend"><i></i>Nota <i></i>Meta</div></div><div className="chart">{history.map((v,i)=><div className="chart-col" key={i}><span className={i===9?"current":""} style={{height:`${v/15*150}px`}}><em>{i===9?fmt(v,2):""}</em></span><small>{months[i].slice(0,3)}</small></div>)}<div className="target-line"><span>Meta 10,0</span></div></div></article>
      <article className="panel"><div className="panel-head"><div><h2>Composição da nota</h2><p>Índices da meta</p></div></div><div className="index-list">{[["AFFA",7.24,60],["IQO",9.06,20],["Prazo médio",15,20]].map(([n,s,w])=><div key={n as string}><div><span>{n}</span><b>{fmt(s as number,2)}</b></div><div className="bar"><i style={{width:`${(s as number)/15*100}%`}}></i></div><small>Peso {w}%</small></div>)}</div></article>
      <article className="panel wide"><div className="panel-head"><div><h2>Desempenho por distribuidora</h2><p>Nota consolidada e variação mensal</p></div><button>Ver análise completa →</button></div><div className="company-table">{companies.map(c=><button key={c.id} onClick={()=>onDetail(initialEntries.find(e=>e.company===c.id) ?? initialEntries[0])}><span className="company-code">{c.id}</span><strong>{c.name}</strong><div className="bar"><i style={{width:`${c.score/15*100}%`}}></i></div><b className="company-score">{fmt(c.score,2)}</b><em className={c.gap>=0?"up":"down"}>{c.gap>=0?"↑":"↓"} {fmt(Math.abs(c.gap),2)}</em></button>)}</div></article>
      <article className="panel"><div className="panel-head"><div><h2>Pendências críticas</h2><p>Ação necessária</p></div><span className="count">{criticalPendencies.length}</span></div><div className="pending">{criticalPendencies.map(item=><button className="pending-item" key={item.id} onClick={()=>onPending(item)} aria-label={`Ver detalhes: ${item.title}`}><i className={item.severity}>{item.icon}</i><span><b>{item.title}</b><small>{item.company} · {item.summary}</small></span><em aria-hidden="true">→</em></button>)}</div></article>
    </section></>;
}

function Assessment({entries,month,setMonth,company,setCompany,search,setSearch,onEdit,onFormula}:{entries:Entry[];month:string;setMonth:(x:string)=>void;company:string;setCompany:(x:string)=>void;search:string;setSearch:(x:string)=>void;onEdit:(e:Entry)=>void;onFormula:(e:Entry)=>void}) {
  return <>
    <PageTitle eyebrow="OPERAÇÃO MENSAL" title="Apuração de resultados" desc="Lance, valide e acompanhe os indicadores do período." actions={<><button>⇧ Importar lote</button><button>⇩ Modelo de importação</button></>} />
    <Filters {...{month,setMonth,company,setCompany}} />
    <div className="toolbar">
      <div className="search">⌕<input placeholder="Buscar indicador, código ou área..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <button className="chip active">Todos <b>{entries.length}</b></button><button className="chip">Pendentes <b>{entries.filter(e=>e.actual===null).length}</b></button><button className="chip">Atrasados <b>1</b></button><button className="chip">Validados <b>{entries.filter(e=>e.actual!==null).length}</b></button>
    </div>
    <section className="table-panel"><table>
      <thead><tr><th>Indicador</th><th>Distribuidora / Área</th><th>Previsto</th><th>Realizado</th><th>Resultado</th><th>Nota</th><th>Status</th><th>Responsável</th><th></th></tr></thead>
      <tbody>{entries.map(e=>{const s=score(e);return <tr key={e.id}>
        <td><button className="indicator-link" aria-label={`Ver detalhes do indicador ${e.code} - ${e.indicator}`} onClick={()=>onFormula(e)}><span className="code">{e.code}</span><div><strong>{e.indicator}</strong><small>Régua {e.rule} · Peso {fmt(e.weight,1)}%</small></div><span className="indicator-open" aria-hidden="true">→</span></button></td>
        <td><strong>{e.company}</strong><small>{e.area}</small></td><td>{fmt(e.planned)}</td><td className={e.actual===null?"missing":""}>{e.actual===null?"Não informado":fmt(e.actual)}</td><td>{e.actual===null?"—":fmt(e.actual/e.planned*100,1)+"%"}</td>
        <td><button className={`score-pill ${(s??0)>=10?"good":(s??0)>=7?"mid":"bad"}`} onClick={()=>onFormula(e)}>{s===null?"—":fmt(s,2)}</button></td><td><span className={`status ${e.actual===null?"late":"done"}`}><i></i>{e.actual===null?"Atrasado":"Apurado"}</span></td><td><div className="owner">{e.owner.split(" ").map(x=>x[0]).join("").slice(0,2)}<span>{e.owner}</span></div></td><td><button className="row-action" onClick={()=>onEdit({...e})}>Editar</button></td>
      </tr>})}</tbody>
    </table><div className="table-footer"><span>Exibindo {entries.length} indicadores</span><span>Última atualização: hoje, 09:42</span></div></section>
  </>;
}

function AssessmentLegacy({entries,month,setMonth,company,setCompany,search,setSearch,onEdit,onFormula}:{entries:Entry[];month:string;setMonth:(x:string)=>void;company:string;setCompany:(x:string)=>void;search:string;setSearch:(x:string)=>void;onEdit:(e:Entry)=>void;onFormula:(e:Entry)=>void}) {
  return <><PageTitle eyebrow="OPERAÇÃO MENSAL" title="Apuração de resultados" desc="Lance, valide e acompanhe os indicadores do período." actions={<><button>⇧ Importar lote</button><button>⇩ Modelo de importação</button></>} /><Filters {...{month,setMonth,company,setCompany}} />
    <div className="toolbar"><div className="search">⌕<input placeholder="Buscar indicador, código ou área..." value={search} onChange={e=>setSearch(e.target.value)}/></div><button className="chip active">Todos <b>{entries.length}</b></button><button className="chip">Pendentes <b>{entries.filter(e=>e.actual===null).length}</b></button><button className="chip">Atrasados <b>1</b></button><button className="chip">Validados <b>{entries.filter(e=>e.actual!==null).length}</b></button></div>
    <section className="table-panel"><table><thead><tr><th>Indicador</th><th>Distribuidora / área</th><th>Previsto</th><th>Realizado</th><th>Resultado</th><th>Nota</th><th>Status</th><th>Responsável</th><th></th></tr></thead><tbody>{entries.map(e=>{const s=score(e);return <tr key={e.id}><td><span className="code">{e.code}</span><div><strong>{e.indicator}</strong><small>Régua {e.rule} · Peso {fmt(e.weight,1)}%</small></div></td><td><strong>{e.company}</strong><small>{e.area}</small></td><td>{fmt(e.planned)}</td><td className={e.actual===null?"missing":""}>{e.actual===null?"Não informado":fmt(e.actual)}</td><td>{e.actual===null?"—":fmt(e.actual/e.planned*100,1)+"%"}</td><td><button className={`score-pill ${(s??0)>=10?"good":(s??0)>=7?"mid":"bad"}`} onClick={()=>onFormula(e)}>{s===null?"—":fmt(s,2)}</button></td><td><span className={`status ${e.actual===null?"late":"done"}`}><i></i>{e.actual===null?"Atrasado":"Apurado"}</span></td><td><div className="owner">{e.owner.split(" ").map(x=>x[0]).join("").slice(0,2)}<span>{e.owner}</span></div></td><td><button className="row-action" onClick={()=>onEdit({...e})}>Editar</button></td></tr>})}</tbody></table><div className="table-footer"><span>Exibindo {entries.length} indicadores</span><span>Última atualização: hoje, 09:42</span></div></section></>;
}

function Structure({notify}:{notify:(message:string)=>void}) {
  return <><PageTitle eyebrow="CONFIGURAÇÃO DO CENÁRIO" title="Estrutura de avaliação" desc="Organize metas, índices e indicadores em uma hierarquia ponderada e versionada." actions={<><button onClick={()=>notify("Cenário 2026 criado como rascunho a partir de 2025.")}>⧉ Replicar ano anterior</button><button className="primary" onClick={()=>notify("Novo item estrutural iniciado em modo rascunho.")}>＋ Novo item</button></>} />
    <div className="scenario-strip"><article className="active"><span>2025</span><div><strong>Apuração vigente</strong><small>Versão 3 · publicada em 15 jan 2025</small></div><b>ATIVO</b></article><article><span>2026</span><div><strong>Cenário em preparação</strong><small>Rascunho · herdado de 2025</small></div><b>RASCUNHO</b></article><button onClick={()=>notify("Histórico de versões aberto para consulta.")}>Ver histórico de versões →</button></div>
    <div className="structure-layout"><section className="tree-panel"><div className="panel-head"><div><h2>Meta Torre Elegível 2025</h2><p>Cargos: Diretores, Superintendentes e Gerentes</p></div><span className="valid">✓ Pesos 100%</span></div>
      <div className="tree"><div className="tree-root"><i>◆</i><div><strong>Cumprimento Torre de Investimentos</strong><small>Meta principal · 7 distribuidoras</small></div><b>100%</b><button>···</button></div>
      <div className="branch"><div className="tree-index"><i>A</i><div><strong>AFFA</strong><small>Avanço físico-financeiro ajustado</small></div><b>60%</b><button>···</button></div>
      {["Avanço Físico VR","Status do Cronograma","Avanço Financeiro","Capitalização"].map((x,i)=><div className="tree-leaf" key={x}><i>{String(i+1).padStart(2,"0")}</i><div><strong>{x}</strong><small>{i<2?"Quanto maior, melhor · VRC":"Indicador dependente · fórmula configurada"}</small></div><b>{[35,25,20,20][i]}%</b><span className="tag">{i<2?"Base":"ƒ(x)"}</span></div>)}</div>
      <div className="branch"><div className="tree-index"><i>I</i><div><strong>IQO</strong><small>Índice de qualidade de obras</small></div><b>20%</b><button>···</button></div></div>
      <div className="branch"><div className="tree-index"><i>P</i><div><strong>Prazo médio</strong><small>Tempo médio de conclusão</small></div><b>20%</b><button>···</button></div></div></div>
    </section><aside className="summary-panel"><span>RESUMO DO CENÁRIO</span><h3>Apuração 2025</h3><dl><div><dt>1</dt><dd>Meta ativa</dd></div><div><dt>3</dt><dd>Índices</dd></div><div><dt>18</dt><dd>Indicadores</dd></div><div><dt>7</dt><dd>Distribuidoras</dd></div><div><dt>41</dt><dd>Áreas executoras</dd></div></dl><hr/><span>VALIDAÇÕES</span><ul><li>✓ Pesos da meta totalizam 100%</li><li>✓ Filhos dos índices consistentes</li><li>✓ Todos os indicadores têm régua</li><li>✓ Nenhuma dependência circular</li></ul><button>Executar validação completa</button></aside></div></>;
}

function Rules({entries}:{entries:Entry[]}) {
  type RuleDef={code:string;name:string;polarity:"MAIOR"|"MENOR";min:number;target:number;challenge:number;linked:number;active:boolean;scope:string};
  type FormulaDef={id:string;name:string;code:string;expression:string;description:string;dependencies:string[];active:boolean};
  const initialRules:RuleDef[]=[
    {code:"VRC",name:"Avanço físico VR e cronograma",polarity:"MAIOR",min:72,target:95,challenge:100,linked:14,active:true,scope:"Padrão corporativo"},
    {code:"FCA",name:"Financeiro e capitalização ajustada",polarity:"MAIOR",min:77.5,target:100,challenge:105,linked:6,active:true,scope:"Padrão corporativo"},
    {code:"FISC",name:"Obras fiscalizadas RD e AT",polarity:"MAIOR",min:80,target:90,challenge:100,linked:4,active:true,scope:"Padrão corporativo"},
    {code:"PMO",name:"Prazo médio de obras",polarity:"MENOR",min:125,target:100,challenge:83.33,linked:3,active:true,scope:"Padrão corporativo"},
    {code:"CARTA",name:"Carta diretriz",polarity:"MAIOR",min:1,target:10,challenge:15,linked:2,active:true,scope:"Padrão corporativo"},
    {code:"ENERG",name:"Pendência de energização",polarity:"MENOR",min:29,target:18.8,challenge:12,linked:7,active:true,scope:"Por distribuidora"},
  ];
  const initialFormulas:FormulaDef[]=[
    {id:"score",name:"Nota por interpolação",code:"NOTA_REGUA",expression:"SE resultado < mínimo → 0; mínimo→meta: 1 + (resultado−mínimo)×9/(meta−mínimo); meta→desafio: 10 + (resultado−meta)×5/(desafio−meta); teto 15",description:"Converte o atingimento em nota, respeitando polaridade maior/menor.",dependencies:["Resultado","Régua","Polaridade"],active:true},
    {id:"weighted",name:"Consolidação ponderada",code:"SOMARPRODUTO",expression:"nota consolidada = Σ(nota válida × peso efetivo)",description:"Replica o SOMARPRODUTO da planilha para indicadores, índices e visão corporativa.",dependencies:["Nota","Peso efetivo"],active:true},
    {id:"redistribution",name:"Redistribuição de não apurados",code:"PESO_NA",expression:"peso efetivoᵢ = peso baseᵢ / Σ(pesos dos itens apurados)",description:"Redistribui automaticamente o peso de itens NA entre os demais indicadores válidos.",dependencies:["Peso base","Status da apuração"],active:true},
    {id:"schedule",name:"Realizado ajustado do cronograma",code:"AJUSTE_CRONO",expression:"realizado ajustado = (2 − (atingimento acumulado ÷ atingimento mensal)) × previsto acumulado",description:"Fórmula dependente identificada na apuração para equalizar mensal e acumulado.",dependencies:["Previsto acumulado","Realizado acumulado","Atingimento mensal"],active:true},
    {id:"capital",name:"Capitalização ponderada por VR",code:"CAPITAL_VR",expression:"previsto ponderado = previsto mensal × VR; resultado = realizado capitalizado ÷ base ponderada",description:"Encadeia avanço financeiro, capitalização e valor de referência da distribuidora.",dependencies:["Previsto mensal","VR","Realizado capitalizado"],active:true},
  ];
  const sourceWeights=[
    {id:"auto",name:"Automação",value:.62,active:true},{id:"at",name:"Expansão AT",value:18.77,active:true},{id:"mat",name:"Manutenção AT",value:2.14,active:true},
    {id:"obras",name:"Obras RD",value:61.09,active:true},{id:"rec",name:"Recuperação de Energia",value:8.51,active:true},{id:"srv",name:"Serviços de Rede",value:8.87,active:true},
  ];
  const [tab,setTab]=useState<"rules"|"weights"|"formulas">("rules");
  const [rules,setRules]=useState(initialRules);
  const [weights,setWeights]=useState(sourceWeights);
  const [formulas,setFormulas]=useState(initialFormulas);
  const [ruleDraft,setRuleDraft]=useState<RuleDef|null>(null);
  const [formulaDraft,setFormulaDraft]=useState<FormulaDef|null>(null);
  const [selectedFormula,setSelectedFormula]=useState("score");
  const [saved,setSaved]=useState("");
  const [simPlanned,setSimPlanned]=useState(100);
  const [simActual,setSimActual]=useState(97.7);
  const [simRule,setSimRule]=useState("VRC");
  const weightTotal=weights.reduce((a,w)=>a+w.value,0);
  const activeTotal=weights.filter(w=>w.active).reduce((a,w)=>a+w.value,0);
  const showSaved=(message:string)=>{setSaved(message);setTimeout(()=>setSaved(""),2600)};
  const selectedRule=rules.find(r=>r.code===simRule)??rules[0];
  const simResult=simPlanned?simActual/simPlanned*100:0;
  const calcRuleScore=(result:number,r:RuleDef)=>{const bigger=r.polarity==="MAIOR";if((bigger&&result<r.min)||(!bigger&&result>r.min))return 0;if((bigger&&result<=r.target)||(!bigger&&result>=r.target))return 1+(bigger?result-r.min:r.min-result)*9/Math.abs(r.target-r.min);if((bigger&&result<=r.challenge)||(!bigger&&result>=r.challenge))return 10+(bigger?result-r.target:r.target-result)*5/Math.abs(r.challenge-r.target);return 15};
  const validRule=(r:RuleDef)=>(r.polarity==="MAIOR"?r.min<r.target&&r.target<r.challenge:r.min>r.target&&r.target>r.challenge)&&!!r.code.trim()&&!!r.name.trim();
  const saveRule=()=>{if(!ruleDraft||!validRule(ruleDraft))return;setRules(xs=>xs.some(x=>x.code===ruleDraft.code)?xs.map(x=>x.code===ruleDraft.code?ruleDraft:x):[...xs,ruleDraft]);setRuleDraft(null);showSaved("Régua salva e validações recalculadas.")};
  const normalizeWeights=()=>{if(!weightTotal)return;setWeights(xs=>xs.map(w=>({...w,value:+(w.value/weightTotal*100).toFixed(2)})));showSaved("Pesos normalizados para 100%.")};
  const actionLabel=tab==="rules"?"＋ Nova régua":tab==="weights"?"✓ Salvar pesos":"＋ Nova fórmula";
  const action=()=>{if(tab==="rules")setRuleDraft({code:"",name:"",polarity:"MAIOR",min:70,target:100,challenge:110,linked:0,active:true,scope:"Padrão corporativo"});else if(tab==="weights")showSaved(Math.abs(weightTotal-100)<.02?"Pesos salvos e cenário validado.":"A soma precisa totalizar 100% antes de salvar.");else setFormulaDraft({id:`custom-${Date.now()}`,name:"",code:"",expression:"",description:"",dependencies:[],active:true})};
  return <><PageTitle eyebrow="MOTOR DE CÁLCULO" title="Réguas e pesos" desc="Configure parâmetros, ponderações e fórmulas dependentes da apuração." actions={<button className="primary" onClick={action}>{actionLabel}</button>} />
    {saved&&<div className="rules-toast">✓ {saved}</div>}
    <section className="engine-summary"><div><span>RÉGUAS PARAMETRIZADAS</span><strong>{rules.length}<small> + 29 específicas</small></strong></div><div><span>PESOS DO ESCOPO</span><strong className={Math.abs(weightTotal-100)<.02?"ok":"warn"}>{fmt(weightTotal,2)}%</strong></div><div><span>FÓRMULAS ATIVAS</span><strong>{formulas.filter(f=>f.active).length}<small> / {formulas.length}</small></strong></div><div><span>ORIGEM</span><strong className="source-label">Planilha V3-R</strong></div></section>
    <div className="tabs"><button className={tab==="rules"?"active":""} onClick={()=>setTab("rules")}>Réguas de avaliação <b>{rules.length}</b></button><button className={tab==="weights"?"active":""} onClick={()=>setTab("weights")}>Pesos de consolidação</button><button className={tab==="formulas"?"active":""} onClick={()=>setTab("formulas")}>Fórmulas dependentes <b>{formulas.length}</b></button></div>
    {tab==="rules"&&<><section className="rule-grid robust">{rules.map(r=><article className={`rule-card ${!r.active?"inactive":""}`} key={r.code}><div className="rule-head"><span className="rule-code">{r.code}</span><button aria-label={`Editar ${r.name}`} onClick={()=>setRuleDraft({...r})}>Editar</button></div><h3>{r.name}</h3><p>Quanto <b>{r.polarity==="MAIOR"?"maior, melhor":"menor, melhor"}</b> · {r.scope}</p><div className="rule-points"><div><span>MÍNIMO</span><b>{fmt(r.min,r.min%1?1:0)}%</b><small>Nota 1</small></div><div><span>META</span><b>{fmt(r.target,r.target%1?1:0)}%</b><small>Nota 10</small></div><div><span>DESAFIO</span><b>{fmt(r.challenge,r.challenge%1?1:0)}%</b><small>Nota 15</small></div></div><div className={`rule-gradient ${r.polarity==="MENOR"?"reverse":""}`}><i></i><i></i><i></i></div><footer><span>{r.linked} indicadores vinculados</span><button className={`mini-toggle ${r.active?"on":""}`} onClick={()=>setRules(xs=>xs.map(x=>x.code===r.code?{...x,active:!x.active}:x))}><i></i>{r.active?"Ativa":"Inativa"}</button></footer></article>)}</section>
      <section className="panel rule-table"><div className="panel-head"><div><h2>Parâmetros específicos por distribuidora</h2><p>Chave composta DISTRIBUIDORA_INDICADOR, conforme a tabela REGUAS da planilha</p></div><span className="valid">35 combinações válidas</span></div><table><thead><tr><th>Indicador</th><th>Unidade</th><th>Régua</th><th>Mínimo</th><th>Meta</th><th>Desafio</th><th>Polaridade</th></tr></thead><tbody>{entries.slice(0,4).map(e=><tr key={e.id}><td>{e.indicator}</td><td><span className="company-code">{e.company}</span></td><td>{e.company}_{e.rule}</td><td>{fmt(e.min*100,0)}%</td><td>{fmt(e.target*100,0)}%</td><td>{fmt(e.challenge*100,0)}%</td><td>{e.polarity==="MAIOR"?"↑ Maior":"↓ Menor"} é melhor</td></tr>)}</tbody></table></section></>}
    {tab==="weights"&&<div className="weights-layout"><section className="panel weights-editor"><div className="panel-head"><div><h2>Pesos por segmento · MA</h2><p>Visão Torre Elegível · origem PESOS[PESO_ELEGÍVEL]</p></div><div className={`weight-total ${Math.abs(weightTotal-100)<.02?"valid":"invalid"}`}><span>SOMA</span><strong>{fmt(weightTotal,2)}%</strong></div></div><div className="weight-tools"><label>Escopo<select><option>Torre Elegível</option><option>Direção Engenharia</option><option>Direção Obras</option><option>Superintendências</option></select></label><label>Distribuidora<select><option>MA</option>{companies.filter(c=>c.id!=="MA").map(c=><option key={c.id}>{c.id}</option>)}</select></label><button onClick={()=>setWeights(sourceWeights)}>Restaurar planilha</button><button onClick={normalizeWeights}>Normalizar 100%</button></div><div className="weight-list"><div className="weight-row head"><span>Segmento</span><span>Peso base</span><span>Status</span><span>Peso efetivo</span></div>{weights.map(w=><div className="weight-row" key={w.id}><div><strong>{w.name}</strong><small>{w.active?"Participa da consolidação":"Não apurado · peso redistribuído"}</small></div><label><input type="number" min="0" max="100" step="0.01" value={w.value} onChange={e=>setWeights(xs=>xs.map(x=>x.id===w.id?{...x,value:+e.target.value}:x))}/><span>%</span></label><button className={`mini-toggle ${w.active?"on":""}`} onClick={()=>setWeights(xs=>xs.map(x=>x.id===w.id?{...x,active:!x.active}:x))}><i></i>{w.active?"Apurado":"NA"}</button><b>{w.active&&activeTotal?fmt(w.value/activeTotal*100,2):"0,00"}%</b></div>)}</div></section><aside className="weights-aside"><article><span>VALIDAÇÃO AUTOMÁTICA</span><h3>{Math.abs(weightTotal-100)<.02?"Estrutura consistente":"Ajuste necessário"}</h3><ul><li className={Math.abs(weightTotal-100)<.02?"ok":"bad"}>{Math.abs(weightTotal-100)<.02?"✓":"!"} Soma dos pesos em 100%</li><li className="ok">✓ Nenhum peso negativo</li><li className="ok">✓ Chaves de segmento únicas</li><li className="ok">✓ Redistribuição de NA habilitada</li></ul></article><article><span>HIERARQUIA DE CONSOLIDAÇÃO</span><div className="weight-tree"><b>Meta Torre <em>100%</em></b><i></i><b>AFFA <em>60%</em></b><i></i><b>Distribuidora MA <em>100%</em></b><i></i><b>Segmentos <em>{weights.length}</em></b></div></article></aside></div>}
    {tab==="formulas"&&<div className="formula-layout"><section className="formula-catalog">{formulas.map(f=><button className={selectedFormula===f.id?"active":""} key={f.id} onClick={()=>setSelectedFormula(f.id)}><span className="formula-icon">ƒ</span><div><strong>{f.name}</strong><small>{f.code} · {f.dependencies.length} dependências</small></div><i className={f.active?"on":""}></i></button>)}</section><section className="panel formula-detail">{(()=>{const f=formulas.find(x=>x.id===selectedFormula)??formulas[0];return <><div className="panel-head"><div><span className="rule-code">{f.code}</span><h2>{f.name}</h2><p>{f.description}</p></div><button className="row-action" onClick={()=>setFormulaDraft({...f})}>Editar fórmula</button></div><div className="expression-box"><span>EXPRESSÃO DE NEGÓCIO</span><code>{f.expression}</code></div><h3>Dependências</h3><div className="dependency-flow">{f.dependencies.map((d,i)=><span key={d}>{d}{i<f.dependencies.length-1&&<b>→</b>}</span>)}<strong>Resultado</strong></div><div className="formula-actions"><label>Fórmula ativa <button className={`mini-toggle ${f.active?"on":""}`} onClick={()=>setFormulas(xs=>xs.map(x=>x.id===f.id?{...x,active:!x.active}:x))}><i></i>{f.active?"Sim":"Não"}</button></label><button onClick={()=>showSaved("Dependências verificadas: nenhuma referência circular.")}>Validar dependências</button></div></>})()}</section><aside className="panel simulator"><span>SIMULADOR DA APURAÇÃO</span><h3>Teste de resultado e nota</h3><label>Régua<select value={simRule} onChange={e=>setSimRule(e.target.value)}>{rules.map(r=><option key={r.code}>{r.code}</option>)}</select></label><div><label>Previsto<input type="number" value={simPlanned} onChange={e=>setSimPlanned(+e.target.value)}/></label><label>Realizado<input type="number" value={simActual} onChange={e=>setSimActual(+e.target.value)}/></label></div><div className="sim-result"><span>ATINGIMENTO<strong>{fmt(simResult,2)}%</strong></span><i>→</i><span>NOTA<strong>{fmt(calcRuleScore(simResult,selectedRule),2)}</strong></span></div><small>Calculado pela polaridade {selectedRule.polarity.toLowerCase()} e pontos {fmt(selectedRule.min,1)} / {fmt(selectedRule.target,1)} / {fmt(selectedRule.challenge,1)}.</small></aside></div>}
    {ruleDraft&&<div className="modal-backdrop" onMouseDown={()=>setRuleDraft(null)}><section className="modal engine-modal" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span>CONFIGURAÇÃO DA RÉGUA</span><h2>{rules.some(r=>r.code===ruleDraft.code)?"Editar régua":"Nova régua"}</h2><p>Defina os pontos que correspondem às notas 1, 10 e 15.</p></div><button onClick={()=>setRuleDraft(null)}>×</button></div><div className="engine-form"><label>Código<input value={ruleDraft.code} disabled={rules.some(r=>r.code===ruleDraft.code)} onChange={e=>setRuleDraft({...ruleDraft,code:e.target.value.toUpperCase().replace(/\s/g,"")})}/></label><label className="span-2">Nome da régua<input value={ruleDraft.name} onChange={e=>setRuleDraft({...ruleDraft,name:e.target.value})}/></label><label>Polaridade<select value={ruleDraft.polarity} onChange={e=>setRuleDraft({...ruleDraft,polarity:e.target.value as "MAIOR"|"MENOR"})}><option value="MAIOR">Quanto maior, melhor</option><option value="MENOR">Quanto menor, melhor</option></select></label><label>Mínimo · nota 1<input type="number" value={ruleDraft.min} onChange={e=>setRuleDraft({...ruleDraft,min:+e.target.value})}/></label><label>Meta · nota 10<input type="number" value={ruleDraft.target} onChange={e=>setRuleDraft({...ruleDraft,target:+e.target.value})}/></label><label>Desafio · nota 15<input type="number" value={ruleDraft.challenge} onChange={e=>setRuleDraft({...ruleDraft,challenge:+e.target.value})}/></label><label className="span-2">Escopo<select value={ruleDraft.scope} onChange={e=>setRuleDraft({...ruleDraft,scope:e.target.value})}><option>Padrão corporativo</option><option>Por distribuidora</option><option>Por indicador</option></select></label></div>{!validRule(ruleDraft)&&<div className="form-error">Os pontos devem seguir a ordem da polaridade e código/nome são obrigatórios.</div>}<div className="modal-actions"><button onClick={()=>setRuleDraft(null)}>Cancelar</button><button className="primary" disabled={!validRule(ruleDraft)} onClick={saveRule}>Salvar régua</button></div></section></div>}
    {formulaDraft&&<div className="modal-backdrop" onMouseDown={()=>setFormulaDraft(null)}><section className="modal engine-modal" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span>FÓRMULA DEPENDENTE</span><h2>{formulas.some(f=>f.id===formulaDraft.id)?"Editar fórmula":"Nova fórmula"}</h2><p>Documente a expressão e as entradas necessárias para o cálculo.</p></div><button onClick={()=>setFormulaDraft(null)}>×</button></div><div className="engine-form"><label>Código<input value={formulaDraft.code} onChange={e=>setFormulaDraft({...formulaDraft,code:e.target.value.toUpperCase().replace(/\s/g,"_")})}/></label><label className="span-2">Nome<input value={formulaDraft.name} onChange={e=>setFormulaDraft({...formulaDraft,name:e.target.value})}/></label><label className="span-3">Expressão<textarea value={formulaDraft.expression} onChange={e=>setFormulaDraft({...formulaDraft,expression:e.target.value})}/></label><label className="span-3">Descrição<textarea value={formulaDraft.description} onChange={e=>setFormulaDraft({...formulaDraft,description:e.target.value})}/></label><label className="span-3">Dependências separadas por vírgula<input value={formulaDraft.dependencies.join(", ")} onChange={e=>setFormulaDraft({...formulaDraft,dependencies:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label></div><div className="modal-actions"><button onClick={()=>setFormulaDraft(null)}>Cancelar</button><button className="primary" disabled={!formulaDraft.code||!formulaDraft.name||!formulaDraft.expression} onClick={()=>{setFormulas(xs=>xs.some(x=>x.id===formulaDraft.id)?xs.map(x=>x.id===formulaDraft.id?formulaDraft:x):[...xs,formulaDraft]);setSelectedFormula(formulaDraft.id);setFormulaDraft(null);showSaved("Fórmula salva e adicionada ao motor de cálculo.")}}>Salvar fórmula</button></div></section></div>}
  </>;
}

function RulesLegacy({entries}:{entries:Entry[]}) {
  return <><PageTitle eyebrow="MOTOR DE CÁLCULO" title="Réguas e pesos" desc="Configure os pontos de referência e a ponderação das consolidações." actions={<button className="primary">＋ Nova régua</button>} />
    <div className="tabs"><button className="active">Réguas de avaliação</button><button>Pesos de consolidação</button><button>Fórmulas dependentes</button></div>
    <section className="rule-grid">{[["VRC","Valor realizado / curva","MAIOR",70,100,110,14],["PERCENTUAL","Atingimento percentual","MAIOR",80,100,105,4],["PRAZO","Prazo médio de conclusão","MENOR",120,100,85,3],["FCA","Fator de capitalização ajustada","MAIOR",75,100,115,6]].map(r=><article className="rule-card" key={r[0] as string}><div className="rule-head"><span className="rule-code">{r[0]}</span><button>···</button></div><h3>{r[1]}</h3><p>Quanto <b>{r[2]==="MAIOR"?"maior, melhor":"menor, melhor"}</b></p><div className="rule-points"><div><span>MÍNIMO</span><b>{r[3]}%</b><small>Nota 1</small></div><div><span>META</span><b>{r[4]}%</b><small>Nota 10</small></div><div><span>DESAFIO</span><b>{r[5]}%</b><small>Nota 15</small></div></div><div className="rule-gradient"><i></i><i></i><i></i></div><footer><span>{r[6]} indicadores vinculados</span><b>Ativa</b></footer></article>)}</section>
    <section className="panel rule-table"><div className="panel-head"><div><h2>Parâmetros específicos por unidade</h2><p>Sobrescritas da régua padrão para cada distribuidora</p></div><button>Configurar →</button></div><table><thead><tr><th>Indicador</th><th>Unidade</th><th>Régua</th><th>Mínimo</th><th>Meta</th><th>Desafio</th><th>Polaridade</th></tr></thead><tbody>{entries.slice(0,4).map(e=><tr key={e.id}><td>{e.indicator}</td><td><span className="company-code">{e.company}</span></td><td>{e.rule}</td><td>{fmt(e.min*100,0)}%</td><td>{fmt(e.target*100,0)}%</td><td>{fmt(e.challenge*100,0)}%</td><td>↑ Maior é melhor</td></tr>)}</tbody></table></section></>;
}

function Governance({notify}:{notify:(message:string)=>void}) {
  const [tab,setTab]=useState<"organizacao"|"acessos"|"integracoes">("organizacao");
  const units=[
    ["MA","Equatorial Maranhão","8 segmentos","12 regionais","Ativa"],
    ["PA","Equatorial Pará","8 segmentos","10 regionais","Ativa"],
    ["PI","Equatorial Piauí","7 segmentos","8 regionais","Ativa"],
    ["AL","Equatorial Alagoas","7 segmentos","6 regionais","Ativa"],
    ["RS","CEEE Equatorial","8 segmentos","9 regionais","Ativa"],
    ["AP","CEA Equatorial","6 segmentos","5 regionais","Ativa"],
    ["GO","Equatorial Goiás","9 segmentos","11 regionais","Ativa"],
  ];
  const people=[
    ["Mariana Costa","Apurador","Avanço Físico VR","MA · Obras RD","Edição"],
    ["Paulo Nunes","Responsável técnico","Status do Cronograma","MA · Obras AT","Homologação"],
    ["Ana Lima","Apurador","Financeiro e Capitalização","MA · Corporativo","Edição"],
    ["Rafael Alves","Gestor","Aprovação de Obras","PA · Obras RD","Gestão"],
    ["Carla Souza","Apurador","Obras Fiscalizadas","PI · Manutenção RD","Edição"],
  ];
  return <><PageTitle eyebrow="GOVERNANÇA E CONTROLE" title="Organização e acessos" desc="Administre unidades, responsáveis, permissões e integrações corporativas." actions={<button className="primary" onClick={()=>notify("Novo cadastro aberto com trilha de auditoria ativa.")}>＋ Novo cadastro</button>} />
    <div className="tabs governance-tabs"><button className={tab==="organizacao"?"active":""} onClick={()=>setTab("organizacao")}>Estrutura organizacional</button><button className={tab==="acessos"?"active":""} onClick={()=>setTab("acessos")}>Responsáveis e permissões</button><button className={tab==="integracoes"?"active":""} onClick={()=>setTab("integracoes")}>Integrações</button></div>
    {tab==="organizacao"&&<><div className="governance-kpis"><article><span>UNIDADES ATIVAS</span><strong>7</strong><small>0 inativas no cenário atual</small></article><article><span>SEGMENTOS</span><strong>53</strong><small>41 áreas executoras elegíveis</small></article><article><span>REGIONAIS</span><strong>61</strong><small>Códigos compostos validados</small></article><article><span>COBERTURA</span><strong>100<small>%</small></strong><small>Indicadores com unidade vinculada</small></article></div><section className="table-panel"><div className="toolbar"><div className="search">⌕<input placeholder="Buscar unidade, segmento ou regional..."/></div><button className="chip active">Ativas <b>7</b></button><button className="chip">Inativas <b>0</b></button></div><table><thead><tr><th>Código</th><th>Unidade organizacional</th><th>Segmentos</th><th>Regionais</th><th>Status</th><th>Vigência</th><th></th></tr></thead><tbody>{units.map(u=><tr key={u[0]}><td><span className="company-code">{u[0]}</span></td><td><strong>{u[1]}</strong><small>Chave base {u[0]}-ORG-2025</small></td><td>{u[2]}</td><td>{u[3]}</td><td><span className="status done"><i></i>{u[4]}</span></td><td>Desde jan/2025</td><td><button className="row-action" onClick={()=>notify(`${u[1]} aberta para edição versionada.`)}>Gerenciar</button></td></tr>)}</tbody></table></section></>}
    {tab==="acessos"&&<><div className="permission-banner"><div><span>POLÍTICA DE ACESSO</span><h3>Permissões por papel, indicador e unidade</h3><p>Valores previstos, realizados e homologados possuem alçadas independentes. Toda alteração registra autor, data e versão.</p></div><b>✓ 12 usuários ativos</b></div><section className="table-panel"><table><thead><tr><th>Usuário</th><th>Papel</th><th>Indicador / escopo</th><th>Unidade</th><th>Permissão</th><th>Status</th><th></th></tr></thead><tbody>{people.map(p=><tr key={p[0]}><td><div className="owner">{p[0].split(" ").map(x=>x[0]).join("").slice(0,2)}<span>{p[0]}</span></div></td><td><span className="audit-action">{p[1]}</span></td><td>{p[2]}</td><td>{p[3]}</td><td>{p[4]}</td><td><span className="status done"><i></i>Ativo</span></td><td><button className="row-action" onClick={()=>notify(`Permissões de ${p[0]} abertas.`)}>Editar</button></td></tr>)}</tbody></table></section></>}
    {tab==="integracoes"&&<div className="integration-grid"><article><div className="integration-icon">ID</div><span>IDENTIDADE</span><h3>SSO corporativo</h3><p>Preparado para autenticação centralizada e sincronização de perfis do Grupo Equatorial.</p><div className="integration-status"><i></i>Arquitetura preparada</div><button onClick={()=>notify("Checklist técnico de SSO aberto.")}>Ver checklist</button></article><article><div className="integration-icon">EV</div><span>INVESTIMENTOS</span><h3>Integração EVA</h3><p>Reutilização futura de premissas financeiras, parâmetros corporativos e ciclo de vida dos projetos.</p><div className="integration-status planned"><i></i>Evolução planejada</div><button onClick={()=>notify("Mapa de integração EVA aberto.")}>Ver mapeamento</button></article><article><div className="integration-icon">API</div><span>INTEROPERABILIDADE</span><h3>API de resultados</h3><p>Camada preparada para consumo das notas finais por processos de desempenho e portais externos.</p><div className="integration-status"><i></i>Disponível no núcleo</div><button onClick={()=>notify("Documentação da API aberta.")}>Documentação</button></article></div>}
  </>;
}

function Reports() {
  const yearly=[8.12,8.58,9.12];
  return <><PageTitle eyebrow="INTELIGÊNCIA GERENCIAL" title="Relatórios e comparativos" desc="Analise desempenho histórico por meta, índice, indicador, área e período." actions={<><button>⇩ Exportar relatório</button><button className="primary">Gerar material do comitê</button></>} />
    <Filters month="Outubro" setMonth={()=>undefined} company="Todas" setCompany={()=>undefined}/>
    <section className="report-grid"><article className="panel report-history"><div className="panel-head"><div><h2>Comparativo anual</h2><p>Nota global da Torre · Outubro</p></div><span className="valid">↑ 6,3% em três anos</span></div><div className="year-bars">{yearly.map((v,i)=><div key={v}><strong>{fmt(v,2)}</strong><i style={{height:`${v/15*180}px`}}></i><span>{2023+i}</span></div>)}</div></article><article className="panel"><div className="panel-head"><div><h2>Conformidade da apuração</h2><p>Qualidade dos dados do período</p></div></div><div className="compliance-ring"><div><strong>96%</strong><span>pronto para comitê</span></div></div><ul className="report-checks"><li><i className="ok"></i><span>Pesos e hierarquias</span><b>100%</b></li><li><i className="ok"></i><span>Réguas e polaridades</span><b>100%</b></li><li><i className="warn"></i><span>Resultados homologados</span><b>94%</b></li><li><i className="warn"></i><span>Entregas no prazo</span><b>91%</b></li></ul></article></section>
    <section className="panel executive-report"><div className="panel-head"><div><h2>Desempenho por visão gerencial</h2><p>Comparativo consolidado para Planejamento, Finanças e Governança</p></div><button>Detalhar dimensões →</button></div><div className="view-comparison">{[["Torre Elegível",9.12,.24],["Direção de Engenharia",8.74,.11],["Direção de Obras",8.46,-.08],["Superintendências",8.91,.32]].map(v=><div key={v[0] as string}><span>{v[0]}</span><div className="bar"><i style={{width:`${(v[1] as number)/15*100}%`}}></i></div><strong>{fmt(v[1] as number,2)}</strong><em className={(v[2] as number)>=0?"up":"down"}>{(v[2] as number)>=0?"↑":"↓"} {fmt(Math.abs(v[2] as number),2)}</em></div>)}</div></section>
  </>;
}

function Calendar({entries}:{entries:Entry[]}) {
  return <><PageTitle eyebrow="GOVERNANÇA DO PERÍODO" title="Calendário de apuração" desc="Acompanhe deadlines, validações, comitês e lançamento das notas." actions={<button className="primary">＋ Novo evento</button>} />
    <div className="calendar-head"><button>‹</button><h2>Novembro 2025</h2><button>›</button><span></span><button>Hoje</button><button className="active">Mês</button><button>Lista</button></div>
    <section className="calendar-grid">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d=><b key={d}>{d}</b>)}{Array.from({length:35},(_,i)=>{const day=i-5;return <div className={day<1||day>30?"muted":day===5?"today":""} key={i}><span>{day<1?31+day:day>30?day-30:day}</span>{day===3&&<em className="event red">Deadline · PI</em>}{day===4&&<em className="event amber">2 entregas</em>}{day===5&&<><em className="event blue">Deadline geral</em><em className="event green">Validação técnica</em></>}{day===12&&<em className="event purple">Comitê Torre</em>}{day===14&&<em className="event dark">Lançamento notas</em>}</div>})}</section>
    <div className="calendar-summary"><article><span>PRÓXIMO MARCO</span><h3>Deadline geral dos indicadores</h3><p>05 nov · 18:00 · {entries.filter(e=>e.actual===null).length} pendência</p></article><article><span>COMITÊ</span><h3>Reunião de fechamento</h3><p>12 nov · 14:30 · Sala Executiva</p></article><article><span>PUBLICAÇÃO</span><h3>Lançamento das notas</h3><p>14 nov · após validação final</p></article></div></>;
}

function Audit() {
  return <><PageTitle eyebrow="RASTREABILIDADE" title="Auditoria e histórico" desc="Consulte cada alteração de estrutura, valor e fechamento." actions={<button>⇩ Exportar trilha</button>} />
    <div className="audit-kpis"><div><span>ALTERAÇÕES NO PERÍODO</span><strong>128</strong><small>por 12 usuários</small></div><div><span>ÚLTIMA IMPORTAÇÃO</span><strong>40<small> / 42</small></strong><small>registros aceitos</small></div><div><span>INTEGRIDADE</span><strong>100<small>%</small></strong><small>eventos com autor e data</small></div></div>
    <section className="table-panel audit-table"><div className="toolbar"><div className="search">⌕<input placeholder="Buscar evento, usuário ou objeto..."/></div><button className="chip active">Todos</button><button className="chip">Valores</button><button className="chip">Estrutura</button><button className="chip">Importações</button></div><table><thead><tr><th>Data e hora</th><th>Usuário</th><th>Ação</th><th>Objeto</th><th>Detalhe</th><th></th></tr></thead><tbody>{audits.map((a,i)=><tr key={i}><td>{a[0]}</td><td><div className="owner">{a[1].split(" ").map(x=>x[0]).join("").slice(0,2)}<span>{a[1]}</span></div></td><td><span className="audit-action">{a[2]}</span></td><td>{a[3]}</td><td><code>{a[4]}</code></td><td><button className="row-action">Detalhes</button></td></tr>)}</tbody></table></section></>;
}
