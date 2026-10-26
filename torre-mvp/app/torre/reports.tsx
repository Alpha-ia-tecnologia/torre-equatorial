"use client";

import { useMemo, useState } from "react";
import { computePeriod, consolidate, download, fmt, fmtDate, leaves, months, pad, toCSV, weightViews } from "./engine";
import { useTorre } from "./store";
import { useRows } from "./assessment";
import { exportNotes, useHistory } from "./dashboard";
import { Filters, PageTitle, Score } from "./ui";

/** Histórico anterior ao sistema, extraído da planilha de apuração. */
const legacyYears = [{ year: 2023, score: 8.12 }];
const stripYear = (s: string) => s.replace(/ \d{4}$/, "");

export function Reports() {
  const { db, scn, month, company, meta, calc, issues, weightView } = useTorre();
  const rows = useRows();
  const history = useHistory();
  const [committee, setCommittee] = useState(false);
  const viewLabel = weightViews.find(v => v[0] === weightView)![1];
  const pick = (c: typeof calc) => !c ? null : company === "Todas" ? c.global : c.byCompany[company]?.score ?? null;

  const yearly = useMemo(() => [...legacyYears.map(y => ({ ...y, source: "planilha" })), ...db.scenarios.map(s => {
    const m = s.metas.find(x => stripYear(x.name) === stripYear(meta?.name ?? "")) ?? s.metas[0];
    const c = m ? consolidate(db, s, m, weightView, computePeriod(db, s, month)) : null;
    return { year: s.year, score: c ? (company === "Todas" ? c.global : c.byCompany[company]?.score ?? null) : null, source: s.status.toLowerCase() };
  })].sort((a, b) => a.year - b.year), [db, meta, weightView, month, company]);

  const views = useMemo(() => weightViews.map(([id, label]) => {
    const cur = meta ? consolidate(db, scn, meta, id, computePeriod(db, scn, month)) : null;
    const prev = meta && month > 1 ? consolidate(db, scn, meta, id, computePeriod(db, scn, month - 1)) : null;
    const a = pick(cur), b = pick(prev);
    return { id, label, score: a, gap: a !== null && b !== null ? a - b : null };
  }), [db, scn, meta, month, company]); // eslint-disable-line react-hooks/exhaustive-deps

  const byIndicator = useMemo(() => scn.indicators.filter(i => i.active).map(ind => {
    const rs = rows.filter(r => r.ind.code === ind.code && (company === "Todas" || r.v.co === company) && r.v.actual !== null && r.v.planned !== null);
    const planned = rs.reduce((a, r) => a + r.v.planned!, 0), actual = rs.reduce((a, r) => a + r.v.actual!, 0);
    const leaf = meta ? leaves(meta.children).find(l => l.indicator === ind.code) : undefined;
    const score = leaf && calc ? (company === "Todas" ? calc.nodeGlobal[leaf.id] : null) : null;
    return { ind, planned, actual, att: planned ? actual / planned * 100 : null, n: rs.length, score, inMeta: !!leaf };
  }), [rows, scn, company, meta, calc]);

  const base = rows.filter(r => r.ind.kind === "BASE");
  const delivered = base.filter(r => r.v.actual !== null);
  const checks = [
    { label: "Pesos e hierarquias", value: issues.some(i => i.level === "erro" && (i.scope === "Pesos" || i.scope === "Estrutura")) ? 0 : 100 },
    { label: "Réguas e fórmulas", value: issues.some(i => i.level === "erro" && (i.scope === "Réguas" || i.scope === "Fórmulas")) ? 0 : 100 },
    { label: "Resultados informados", value: base.length ? delivered.length / base.length * 100 : 0 },
    { label: "Entregas no prazo", value: delivered.length ? delivered.filter(r => r.status !== "APURADO_ATRASO").length / delivered.length * 100 : 0 },
  ];
  const readiness = checks.reduce((a, c) => a + c.value, 0) / checks.length;
  const maxYear = Math.max(...yearly.map(y => y.score ?? 0), 1);

  function exportReport() {
    const lines: (string | number | null)[][] = [[`Relatório Torre de Investimentos · ${meta?.name} · ${viewLabel} · ${months[month - 1]}/${scn.year}`], [],
      ["COMPARATIVO ANUAL"], ["ANO", "NOTA", "ORIGEM"], ...yearly.map(y => [y.year, y.score === null ? null : +y.score.toFixed(4), y.source]), [],
      ["VISÕES GERENCIAIS"], ["VISAO", "NOTA", "GAP_MES_ANTERIOR"], ...views.map(v => [v.label, v.score === null ? null : +v.score.toFixed(4), v.gap === null ? null : +v.gap.toFixed(4)]), [],
      ["REALIZADO x PREVISTO"], ["INDICADOR", "PREVISTO", "REALIZADO", "ATINGIMENTO_%", "GAP_PP"], ...byIndicator.map(b => [`${b.ind.code} ${b.ind.name}`, +b.planned.toFixed(2), +b.actual.toFixed(2), b.att === null ? null : +b.att.toFixed(2), b.att === null ? null : +(b.att - 100).toFixed(2)])];
    if (calc) lines.push([], ["NOTAS POR DISTRIBUIDORA"], ["DISTRIBUIDORA", "NOTA", ...calc.byCompany[db.org.companies[0].id].children.map(c => c.label)], ...calc.globalParts.map(p => [p.co, p.score === null ? null : +p.score.toFixed(4), ...calc.byCompany[p.co].children.map(c => c.score === null ? null : +c.score.toFixed(4))]));
    download(`relatorio-torre-${scn.year}-${pad(month)}.csv`, toCSV(lines));
  }

  return <><PageTitle eyebrow="INTELIGÊNCIA GERENCIAL" title="Relatórios e comparativos" desc="Desempenho histórico e consolidado por meta, índice, indicador, distribuidora, visão e período."
    actions={<><button onClick={exportReport}>⇩ Exportar relatório</button>{calc && <button onClick={() => exportNotes(calc, viewLabel, `notas-elegiveis-${scn.year}-${pad(month)}.csv`)}>⇩ Notas elegíveis</button>}<button className="primary" onClick={() => setCommittee(true)}>Gerar material do comitê</button></>} />
    <Filters />
    <section className="report-grid"><article className="panel report-history"><div className="panel-head"><div><h2>Comparativo anual</h2><p>Nota {company === "Todas" ? "global" : company} · {months[month - 1]} de cada ano</p></div>{yearly.length > 1 && yearly[0].score && yearly[yearly.length - 1].score && <span className="valid">{(yearly[yearly.length - 1].score! >= yearly[0].score! ? "↑ " : "↓ ") + fmt(Math.abs(yearly[yearly.length - 1].score! / yearly[0].score! - 1) * 100, 1)}% desde {yearly[0].year}</span>}</div>
      <div className="year-bars">{yearly.map(y => <div key={y.year}><strong>{y.score === null ? "—" : fmt(y.score)}</strong><i style={{ height: `${(y.score ?? 0) / maxYear * 170}px` }}></i><span>{y.year}<small>{y.source}</small></span></div>)}</div></article>
      <article className="panel"><div className="panel-head"><div><h2>Conformidade da apuração</h2><p>Qualidade dos dados do período</p></div></div><div className="compliance-ring" style={{ background: `conic-gradient(var(--alpha-accent) ${readiness}%, var(--alpha-surface-3) 0)` }}><div><strong>{fmt(readiness, 0)}%</strong><span>pronto para comitê</span></div></div>
        <ul className="report-checks">{checks.map(c => <li key={c.label}><i className={c.value >= 99.9 ? "ok" : "warn"}></i><span>{c.label}</span><b>{fmt(c.value, 0)}%</b></li>)}</ul></article></section>
    <section className="report-grid"><article className="panel executive-report"><div className="panel-head"><div><h2>Desempenho por visão gerencial</h2><p>Mesma apuração consolidada com os conjuntos de pesos de cada recorte · gap vs. mês anterior</p></div></div>
      <div className="view-comparison">{views.map(v => <div key={v.id}><span>{v.label}</span><div className="bar"><i style={{ width: `${(v.score ?? 0) / 15 * 100}%` }}></i></div><strong>{v.score === null ? "—" : fmt(v.score)}</strong><em className={v.gap === null ? "" : v.gap >= 0 ? "up" : "down"}>{v.gap === null ? "—" : `${v.gap >= 0 ? "↑" : "↓"} ${fmt(Math.abs(v.gap))}`}</em></div>)}</div></article>
      <article className="panel"><div className="panel-head"><div><h2>Evolução mensal</h2><p>{viewLabel} · {scn.year}</p></div></div><div className="spark">{history.map((h, i) => { const v = pick(h); return <div key={i} title={v === null ? "" : fmt(v)}><i style={{ height: `${(v ?? 0) / 15 * 80}px` }} className={i === month - 1 ? "current" : ""}></i><small>{months[i][0]}</small></div>; })}</div></article></section>
    {calc && <section className="panel rule-table"><div className="panel-head"><div><h2>Notas por distribuidora e índice</h2><p>Equivalente às visões HOME e NOTAS ELEGÍVEIS da planilha · item avaliável “Cumprimento Torre Investimentos Global”</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Distribuidora</th>{calc.byCompany[db.org.companies[0].id].children.map(c => <th key={c.id}>{c.label} · {fmt(c.weight, 0)}%</th>)}<th>Nota final</th><th>Peso</th></tr></thead>
        <tbody>{calc.globalParts.map(p => <tr key={p.co}><td><span className="company-code">{p.co}</span> {p.label}</td>{calc.byCompany[p.co].children.map(c => <td key={c.id}><Score value={c.score} /></td>)}<td><Score value={p.score} /></td><td>{fmt(p.weight, 2)}%</td></tr>)}
          <tr className="total-row"><td><strong>Global</strong></td>{calc.byCompany[db.org.companies[0].id].children.map(c => <td key={c.id}><Score value={calc.nodeGlobal[c.id]} /></td>)}<td><Score value={calc.global} /></td><td>100%</td></tr></tbody></table></div></section>}
    <section className="panel rule-table"><div className="panel-head"><div><h2>Realizado × previsto por indicador</h2><p>{company === "Todas" ? "Todas as distribuidoras" : company} · {months[month - 1]}/{scn.year} · valores acumulados</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Indicador</th><th>Previsto</th><th>Realizado</th><th>Atingimento</th><th>Gap</th><th>Nota na meta</th></tr></thead><tbody>{byIndicator.map(b => <tr key={b.ind.code}><td><strong>{b.ind.code} · {b.ind.name}</strong><small>{b.ind.unit} · {b.n} unidade(s) apurada(s)</small></td><td>{fmt(b.planned)}</td><td>{fmt(b.actual)}</td><td>{b.att === null ? "—" : fmt(b.att, 1) + "%"}</td><td className={b.att === null ? "" : b.att >= 100 ? "up" : "down"}>{b.att === null ? "—" : `${b.att >= 100 ? "+" : ""}${fmt(b.att - 100, 1)} p.p.`}</td><td>{b.inMeta ? <Score value={b.score} /> : <small>fora da meta</small>}</td></tr>)}</tbody></table></div></section>
    {committee && calc && <Committee onClose={() => setCommittee(false)} readiness={readiness} views={views} />}
  </>;
}

function Committee({ onClose, readiness, views }: { onClose: () => void; readiness: number; views: { label: string; score: number | null; gap: number | null }[] }) {
  const { db, scn, month, meta, calc, issues } = useTorre();
  const rows = useRows();
  const late = rows.filter(r => r.status === "ATRASADO");
  const c = calc!;
  return <div className="modal-backdrop print-host" onMouseDown={onClose}><section className="modal committee" onMouseDown={e => e.stopPropagation()}>
    <div className="modal-head no-print"><div><span>MATERIAL DE APOIO AO COMITÊ</span><h2>Pré-visualização</h2></div><div className="row-gap"><button className="primary" onClick={() => window.print()}>Imprimir / salvar PDF</button><button aria-label="Fechar" onClick={onClose}>×</button></div></div>
    <div className="print-area">
      <header><span>TORRE DE INVESTIMENTOS · GRUPO EQUATORIAL</span><h1>Comitê de fechamento · {months[month - 1]}/{scn.year}</h1><p>{meta.name} · gerado em {new Date().toLocaleString("pt-BR")} · data de referência {fmtDate(db.refDate)} · {scn.closedMonths.includes(month) ? "período homologado" : "prévia em apuração"}</p></header>
      <div className="committee-kpis"><div><span>Nota global</span><strong>{c.global === null ? "—" : fmt(c.global)}</strong></div><div><span>Prontidão</span><strong>{fmt(readiness, 0)}%</strong></div><div><span>Atrasos</span><strong>{late.length}</strong></div><div><span>Inconsistências</span><strong>{issues.filter(i => i.level === "erro").length}</strong></div></div>
      <h3>Notas por distribuidora</h3>
      <table><thead><tr><th>Distribuidora</th>{c.byCompany[db.org.companies[0].id].children.map(n => <th key={n.id}>{n.label}</th>)}<th>Final</th></tr></thead><tbody>{c.globalParts.map(p => <tr key={p.co}><td>{p.label}</td>{c.byCompany[p.co].children.map(n => <td key={n.id}>{n.score === null ? "—" : fmt(n.score)}</td>)}<td><b>{p.score === null ? "—" : fmt(p.score)}</b></td></tr>)}</tbody></table>
      <h3>Visões gerenciais</h3>
      <table><tbody>{views.map(v => <tr key={v.label}><td>{v.label}</td><td>{v.score === null ? "—" : fmt(v.score)}</td><td>{v.gap === null ? "—" : `${v.gap >= 0 ? "+" : ""}${fmt(v.gap)} vs. mês anterior`}</td></tr>)}</tbody></table>
      <h3>Pendências para deliberação</h3>
      <ul>{late.slice(0, 8).map(r => <li key={r.v.chave}>{r.ind.name} · {r.v.co} · {r.segName}: sem resultado após {fmtDate(r.deadline)}</li>)}{issues.filter(i => i.level === "erro" && i.scope !== "Apuração").map((i, n) => <li key={n}>{i.message}</li>)}{!late.length && !issues.some(i => i.level === "erro") && <li>Nenhuma pendência impeditiva.</li>}</ul>
    </div>
  </section></div>;
}
