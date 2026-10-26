"use client";

import { useMemo, useState } from "react";
import { computePeriod, consolidate, download, fmt, months, toCSV, weightViews, type Issue, type MetaCalc, type NodeCalc } from "./engine";
import { useTorre } from "./store";
import type { View } from "./types";
import { useRows } from "./assessment";
import { Drawer, Empty, Filters, Guarded, Modal, PageTitle, Score } from "./ui";

/** Consolidação de todos os meses do cenário para a meta e visão selecionadas. */
export function useHistory() {
  const { db, scn, meta, weightView } = useTorre();
  return useMemo(() => months.map((_, i) => meta ? consolidate(db, scn, meta, weightView, computePeriod(db, scn, i + 1)) : null), [db, scn, meta, weightView]);
}

export function exportNotes(calc: MetaCalc, label: string, filename: string) {
  const first = Object.values(calc.byCompany)[0];
  download(filename, toCSV([
    ["ITEM_AVALIAVEL", "DISTRIBUIDORA", "NOTA_FINAL", "PESO_DISTRIBUIDORA", ...first.children.map(c => `INDICE_${c.label.toUpperCase()}`)],
    ...calc.globalParts.map(p => [`Cumprimento Torre Investimentos Global · ${label}`, p.co, p.score === null ? null : +p.score.toFixed(4), p.weight, ...calc.byCompany[p.co].children.map(c => c.score === null ? null : +c.score.toFixed(4))]),
    [`Cumprimento Torre Investimentos Global · ${label}`, "GLOBAL", calc.global === null ? null : +calc.global.toFixed(4), 100],
  ]));
}

export function Dashboard() {
  const { db, scn, month, company, meta, calc, issues, weightView, can, go, setFocus } = useTorre();
  const history = useHistory();
  const rows = useRows();
  const [companyDetail, setCompanyDetail] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [validation, setValidation] = useState<"ver" | "fechar" | null>(null);
  const viewLabel = weightViews.find(v => v[0] === weightView)![1];
  const prev = month > 1 ? history[month - 2] : null;
  const scoreOf = (c: MetaCalc | null) => !c ? null : company === "Todas" ? c.global : c.byCompany[company]?.score ?? null;
  const current = scoreOf(calc), before = scoreOf(prev);
  const scoped = rows.filter(r => r.ind.kind === "BASE" && (company === "Todas" || r.v.co === company));
  const delivered = scoped.filter(r => r.v.actual !== null);
  const onTime = delivered.filter(r => r.status !== "APURADO_ATRASO");
  const overdue = scoped.filter(r => r.status === "ATRASADO");
  const errors = issues.filter(i => i.level === "erro");
  const root = calc && company !== "Todas" ? calc.byCompany[company] : null;
  const indexes = calc ? (root ?? calc.byCompany[db.org.companies[0].id]).children.map(c => ({ ...c, score: root ? c.score : calc.nodeGlobal[c.id] })) : [];
  const pendings = buildPendings(rows.filter(r => company === "Todas" || r.v.co === company), issues);

  if (!meta || !calc) return <Empty>Nenhuma meta cadastrada no cenário {scn.year}. Crie uma meta em Estrutura.</Empty>;
  return <><PageTitle eyebrow="PAINEL EXECUTIVO" title="Torre de Investimentos" desc={`${meta.name} · visão ${viewLabel} · ${months[month - 1]}/${scn.year}${scn.closedMonths.includes(month) ? " · período homologado" : " · prévia em apuração"}`}
    actions={<><button onClick={() => exportNotes(calc, viewLabel, `notas-elegiveis-${scn.year}-${String(month).padStart(2, "0")}.csv`)}>⇩ Exportar notas</button>
      <Guarded allowed={can.closePeriod && !scn.closedMonths.includes(month)} reason={scn.closedMonths.includes(month) ? "Período já homologado." : "Fechamento restrito a gestores e administradores."} className="secondary" onClick={() => setValidation("fechar")}>Validar e fechar período</Guarded></>} />
    <Filters />
    <section className="kpi-grid">
      <article className="kpi featured"><div><span>{company === "Todas" ? "NOTA GLOBAL" : `NOTA ${company}`}</span><strong>{current === null ? "—" : fmt(current)}</strong><small>{current !== null && before !== null ? <><b>{current >= before ? "↑" : "↓"} {fmt(Math.abs(current - before))}</b> vs. {months[month - 2].toLowerCase()}</> : "sem comparativo"}</small></div><div className="gauge" style={{ "--score": `${(current ?? 0) / 15 * 100}%` } as React.CSSProperties}><span>{fmt((current ?? 0) / 15 * 100, 0)}%</span></div></article>
      <article className="kpi"><span>APURAÇÃO</span><strong>{delivered.length}<small> / {scoped.length}</small></strong><div className="progress"><i style={{ width: `${scoped.length ? delivered.length / scoped.length * 100 : 0}%` }}></i></div><p>{scoped.length - delivered.length} lançamento(s) pendente(s)</p></article>
      <article className="kpi"><span>NO PRAZO</span><strong>{delivered.length ? fmt(onTime.length / delivered.length * 100, 0) : "—"}<small>%</small></strong><div className="progress warn"><i style={{ width: `${delivered.length ? onTime.length / delivered.length * 100 : 0}%` }}></i></div><p>{overdue.length ? <b className="warning">{overdue.length} atrasado(s)</b> : "Nenhum atraso"} · ref. {db.refDate.split("-").reverse().join("/")}</p></article>
      <article className="kpi clickable" onClick={() => setValidation("ver")}><span>CONSISTÊNCIA</span><strong>{errors.length}<small> erro(s)</small></strong><div className="checks">{errors.length ? "! Ajustes antes do fechamento" : "✓ Pronto para fechamento"}<br />{issues.length - errors.length} alerta(s) <b>ver →</b></div></article>
    </section>
    <section className="dashboard-grid">
      <article className="panel wide"><div className="panel-head"><div><h2>Evolução da nota {company === "Todas" ? "global" : company}</h2><p>Consolidado mensal acumulado · {scn.year}</p></div><div className="legend"><i></i>Nota <i></i>Meta 10</div></div>
        <div className="chart">{history.map((h, i) => { const v = scoreOf(h); return <div className="chart-col" key={i}><span className={i === month - 1 ? "current" : ""} style={{ height: `${(v ?? 0) / 15 * 150}px` }} title={v === null ? "Sem dados" : fmt(v)}><em>{v === null ? "" : fmt(v, 1)}</em></span><small>{months[i].slice(0, 3)}</small></div>; })}<div className="target-line"><span>Meta 10,0</span></div></div></article>
      <article className="panel"><div className="panel-head"><div><h2>Composição da nota</h2><p>Índices da meta · {company === "Todas" ? "ponderado pelas distribuidoras" : company}</p></div></div>
        <div className="index-list">{indexes.map(n => <div key={n.id}><div><span>{n.label}</span><b>{n.score === null ? "—" : fmt(n.score)}</b></div><div className="bar"><i style={{ width: `${(n.score ?? 0) / 15 * 100}%` }}></i></div><small>Peso {fmt(n.weight, 1)}%</small></div>)}</div></article>
      <article className="panel wide"><div className="panel-head"><div><h2>Desempenho por distribuidora</h2><p>Nota consolidada da meta e variação mensal · clique para a memória de cálculo</p></div><button onClick={() => go("relatorios")}>Ver análise completa →</button></div>
        <div className="company-table">{calc.globalParts.map(p => { const pv = prev?.byCompany[p.co]?.score ?? null; const gap = p.score !== null && pv !== null ? p.score - pv : null; return <button key={p.co} onClick={() => setCompanyDetail(p.co)}><span className="company-code">{p.co}</span><strong>{p.label}<small>peso {fmt(p.weight, 2)}%</small></strong><div className="bar"><i style={{ width: `${(p.score ?? 0) / 15 * 100}%` }}></i></div><b className="company-score">{p.score === null ? "—" : fmt(p.score)}</b><em className={gap === null ? "" : gap >= 0 ? "up" : "down"}>{gap === null ? "—" : `${gap >= 0 ? "↑" : "↓"} ${fmt(Math.abs(gap))}`}</em></button>; })}</div></article>
      <article className="panel"><div className="panel-head"><div><h2>Pendências críticas</h2><p>Geradas pelos prazos e validações</p></div><span className="count">{pendings.length}</span></div>
        <div className="pending">{pendings.slice(0, 6).map(item => <button className="pending-item" key={item.id} onClick={() => setPending(item)}><i className={item.severity}>{item.severity === "blue" ? "i" : "!"}</i><span><b>{item.title}</b><small>{item.company} · {item.summary}</small></span><em aria-hidden="true">→</em></button>)}
          {!pendings.length && <p className="hint">Nenhuma pendência no período.</p>}</div></article>
    </section>
    {companyDetail && <CompanyMemory co={companyDetail} onClose={() => setCompanyDetail(null)} />}
    {pending && <Modal eyebrow="PENDÊNCIA" title={pending.title} subtitle={`${pending.company} · ${pending.category}`} onClose={() => setPending(null)}
      actions={<><button onClick={() => setPending(null)}>Fechar</button><button className="primary" onClick={() => { setFocus({ search: pending.search, status: pending.status }); go(pending.view); setPending(null); }}>{pending.action}</button></>}>
      <div className="pending-detail-hero"><i className={pending.severity}>{pending.severity === "blue" ? "i" : "!"}</i><div><span>SITUAÇÃO</span><strong>{pending.summary}</strong><small>{pending.category}</small></div></div>
      <div className="pending-detail-copy"><span>O QUE ESTÁ PENDENTE</span><p>{pending.description}</p><span>IMPACTO</span><p>{pending.impact}</p></div>
    </Modal>}
    {validation && <ValidationModal closing={validation === "fechar"} onClose={() => setValidation(null)} />}
  </>;
}

type Pending = { id: string; severity: "red" | "amber" | "blue"; title: string; company: string; summary: string; category: string; description: string; impact: string; action: string; view: View; search?: string; status?: string };

function buildPendings(rows: ReturnType<typeof useRows>, issues: Issue[]): Pending[] {
  const out: Pending[] = [];
  const group = new Map<string, typeof rows>();
  for (const r of rows.filter(r => r.status === "ATRASADO" || r.status === "VENCE")) {
    const k = `${r.ind.code}|${r.v.co}|${r.status}`;
    group.set(k, [...(group.get(k) ?? []), r]);
  }
  for (const [k, rs] of group) {
    const r = rs[0], late = r.status === "ATRASADO";
    out.push({ id: k, severity: late ? "red" : "amber", title: r.ind.name, company: r.v.co, summary: late ? `Vencido em ${r.deadline.split("-").reverse().join("/")}` : `Vence em ${r.deadline.split("-").reverse().join("/")}`,
      category: "Resultado não informado", description: `${rs.length} área(s) sem valor realizado: ${rs.map(x => x.segName).join(", ")}.`,
      impact: "O indicador fica fora do rateio (pesos renormalizados) e impede o fechamento definitivo do período.", action: "Registrar resultado", view: "apuracao", search: r.ind.name, status: late ? "ATRASADOS" : "PENDENTES" });
  }
  issues.filter(i => i.level === "erro" && i.scope !== "Apuração").forEach((i, n) => out.push({ id: `issue-${n}`, severity: "blue", title: i.scope === "Pesos" ? "Peso divergente" : i.scope === "Fórmulas" ? "Fórmula inválida" : `Inconsistência de ${i.scope.toLowerCase()}`, company: i.scope, summary: i.message, category: "Inconsistência de configuração", description: i.message, impact: "A inconsistência pode distorcer a consolidação e bloqueia o fechamento do período.", action: "Corrigir configuração", view: i.view }));
  return out.sort((a, b) => ["red", "amber", "blue"].indexOf(a.severity) - ["red", "amber", "blue"].indexOf(b.severity));
}

export function ValidationModal({ closing, onClose }: { closing?: boolean; onClose: () => void }) {
  const { scn, month, issues, values, mutate, notify, go } = useTorre();
  const missing = [...values.values()].filter(v => v.actual === null && !v.trace).length;
  const errors = [...issues.filter(i => i.level === "erro"), ...(closing && missing ? [{ level: "erro" as const, scope: "Fechamento", message: `${missing} lançamento(s) sem valor realizado: o fechamento exige a apuração completa do período.`, view: "apuracao" as const }] : [])];
  const all = closing ? [...errors.filter(i => i.scope === "Fechamento"), ...issues] : issues;
  const scopes = [...new Set(all.map(i => i.scope))];
  function close() {
    mutate(d => { const s = d.scenarios.find(x => x.year === scn.year)!; s.closedMonths = [...new Set([...s.closedMonths, month])].sort((a, b) => a - b); },
      { category: "CENARIO", action: "Homologou período", entity: `${months[month - 1]}/${scn.year}`, before: "Em apuração", after: "Fechado" });
    notify(`${months[month - 1]}/${scn.year} homologado. Valores bloqueados para edição.`);
    onClose();
  }
  return <Modal eyebrow={closing ? "FECHAMENTO DO PERÍODO" : "VALIDAÇÃO COMPLETA"} title={`${months[month - 1]}/${scn.year} · ${errors.length ? `${errors.length} erro(s) impeditivo(s)` : "cenário consistente"}`}
    subtitle="Pesos, réguas, estrutura, fórmulas e prazos verificados antes da consolidação (RF-16)." onClose={onClose}
    actions={<><button onClick={onClose}>Fechar</button>{closing && <button className="primary" disabled={!!errors.length} onClick={close}>{errors.length ? "Corrija os erros para fechar" : "Homologar e fechar período"}</button>}</>}>
    <div className="validation-list">
      {!all.length && <p className="ok-text">✓ Nenhuma divergência encontrada.</p>}
      {scopes.map(s => <div key={s}><h4>{s}</h4>{all.filter(i => i.scope === s).map((i, n) => <button key={n} className={i.level} onClick={() => { onClose(); go(i.view); }}><b>{i.level === "erro" ? "Erro" : "Alerta"}</b><span>{i.message}</span><em>→</em></button>)}</div>)}
    </div>
  </Modal>;
}

export function CompanyMemory({ co, onClose }: { co: string; onClose: () => void }) {
  const { db, calc, meta, weightView } = useTorre();
  const node = calc!.byCompany[co];
  const part = calc!.globalParts.find(p => p.co === co);
  const company = db.org.companies.find(c => c.id === co)!;
  return <Drawer eyebrow="MEMÓRIA DE CÁLCULO" title={company.name} subtitle={`${meta.name} · visão ${weightView.toLowerCase()}`} onClose={onClose}>
    <div className="big-score"><span>Nota da distribuidora</span><strong>{node.score === null ? "—" : fmt(node.score)}</strong><small>peso {fmt(part?.weight ?? 0, 2)}% · efetivo {fmt((part?.eff ?? 0) * 100, 2)}% na nota global {calc!.global === null ? "—" : fmt(calc!.global)}</small></div>
    <p className="hint pad">Nota = Σ(nota do filho × peso efetivo). Itens sem valor ou não aplicáveis saem do rateio e os pesos dos demais são renormalizados.</p>
    <div className="memory-tree">{node.children.map(c => <MemoryNode key={c.id} node={c} depth={0} />)}</div>
  </Drawer>;
}

function MemoryNode({ node, depth }: { node: NodeCalc; depth: number }) {
  return <div className={`memory-node d${depth}`}>
    <div className="memory-row"><span>{node.kind === "INDEX" ? "◆" : "•"} {node.label}{node.na && <em className="na">não aplicável</em>}</span><small>peso {fmt(node.weight, 1)}% → efetivo {fmt(node.eff * 100, 1)}%</small><Score value={node.score} /></div>
    {node.areas?.map(a => <div key={a.seg} className="memory-area"><span>{a.label}<small>{a.value?.chave}</small></span><small>{a.result === null ? "sem valor" : `resultado ${fmt(a.result, 1)}`} · peso {fmt(a.eff * 100, 1)}%</small><Score value={a.score} /></div>)}
    {node.children.map(c => <MemoryNode key={c.id} node={c} depth={depth + 1} />)}
  </div>;
}
