"use client";

import { useEffect, useMemo, useState } from "react";
import {
  chave, deadlineFor, deliveryStatus, download, entryKey, fmt, fmtDate, leaves, months, parseChave, parseCSV, parseNumber,
  resultOf, ruleParams, scoreOf, toCSV, unitKey, unitScore, type DeliveryStatus, type UnitValue,
} from "./engine";
import { useTorre, type AuditInput } from "./store";
import type { DB, Entry, Indicator, PiRow, Rule, Scenario } from "./types";
import { Drawer, Empty, Filters, Guarded, Modal, Owner, PageTitle, Score, Status } from "./ui";

export type Row = { v: UnitValue; ind: Indicator; rule?: Rule; result: number | null; score: number | null; status: DeliveryStatus; deadline: string; segName: string };

export function useRows(): Row[] {
  const { db, scn, values, month } = useTorre();
  return useMemo(() => {
    const inds = new Map(scn.indicators.map(i => [i.code, i]));
    const rules = new Map(scn.rules.map(r => [r.code, r]));
    const segs = new Map(db.org.segments.map(s => [s.code, s.name]));
    return [...values.values()].map(v => {
      const ind = inds.get(v.ind)!, rule = rules.get(ind.defaultRule);
      const { result, score } = unitScore(v, rule);
      return { v, ind, rule, result, score, status: deliveryStatus(v, ind, scn, month, db.refDate), deadline: deadlineFor(ind, scn.year, month), segName: segs.get(v.seg) ?? v.seg };
    }).sort((a, b) => a.ind.code.localeCompare(b.ind.code) || a.v.co.localeCompare(b.v.co) || a.v.seg.localeCompare(b.v.seg));
  }, [db, scn, values, month]);
}

const statusGroups: [string, string, (s: DeliveryStatus) => boolean][] = [
  ["TODOS", "Todos", () => true],
  ["PENDENTES", "Pendentes", s => s === "PENDENTE" || s === "VENCE"],
  ["ATRASADOS", "Atrasados", s => s === "ATRASADO"],
  ["APURADOS", "Apurados", s => s === "APURADO" || s === "APURADO_ATRASO" || s === "HOMOLOGADO"],
  ["CALCULADOS", "Calculados", s => s === "CALCULADO" || s === "AGUARDANDO"],
];

export function Assessment() {
  const { db, scn, user, can, month, company, focus, setFocus, mutate, notify } = useTorre();
  const rows = useRows();
  const [search, setSearch] = useState(focus?.search ?? "");
  const [group, setGroup] = useState(focus?.status ?? "TODOS");
  const [segment, setSegment] = useState("Todas");
  const [mine, setMine] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [importing, setImporting] = useState(false);
  useEffect(() => { if (focus) setFocus(null); }, [focus, setFocus]);

  const isMine = (r: Row) => r.ind.ownerId === user.id || (r.ind.apuradorIds.includes(user.id) && (user.companies.includes("*") || user.companies.includes(r.v.co)));
  const base = rows.filter(r => (company === "Todas" || r.v.co === company) && (segment === "Todas" || r.v.seg === segment) && (!mine || isMine(r))
    && `${r.ind.code} ${r.ind.name} ${r.segName} ${r.v.co} ${r.v.chave}`.toLowerCase().includes(search.toLowerCase()));
  const shown = base.filter(r => statusGroups.find(g => g[0] === group)![2](r.status));
  const closed = scn.closedMonths.includes(month);
  const ownerName = (id: string) => db.users.find(u => u.id === id)?.name ?? "—";

  function exportRows() {
    download(`apuracao-${scn.year}-${String(month).padStart(2, "0")}.csv`, toCSV([
      ["CHAVE_INDICADOR", "INDICADOR", "DISTRIBUIDORA", "AREA", "PREVISTO", "REALIZADO", "RESULTADO_%", "NOTA", "STATUS", "PRAZO", "RESPONSAVEL"],
      ...shown.map(r => [r.v.chave, `${r.ind.code} ${r.ind.name}`, r.v.co, r.segName, r.v.planned, r.v.actual, r.result === null ? null : +r.result.toFixed(4), r.score === null ? null : +r.score.toFixed(4), r.status, fmtDate(r.deadline), ownerName(r.ind.ownerId)]),
    ]));
    notify(`${shown.length} linhas exportadas.`);
  }

  return <>
    <PageTitle eyebrow="OPERAÇÃO MENSAL" title="Apuração de resultados" desc="Lance, importe, valide e acompanhe os indicadores do período por unidade organizacional."
      actions={<>
        <Guarded allowed={can.importValues} reason="Importação disponível para apuradores e administradores em cenário aberto." onClick={() => setImporting(true)}>⇧ Importar lote</Guarded>
        <button onClick={exportRows}>⇩ Exportar</button>
      </>} />
    <Filters show={["month", "company", "segment"]} segment={segment} setSegment={setSegment} />
    {closed && <div className="banner info"><b>Período homologado.</b> {months[month - 1]}/{scn.year} está fechado: os valores ficam bloqueados para edição e importação.
      {can.closePeriod && user.role === "ADMIN" && <button onClick={() => { mutate(d => { const s = d.scenarios.find(x => x.year === scn.year)!; s.closedMonths = s.closedMonths.filter(m => m !== month); }, { category: "CENARIO", action: "Reabriu período", entity: `${months[month - 1]}/${scn.year}`, before: "Fechado", after: "Aberto" }); notify("Período reaberto para ajustes."); }}>Reabrir período</button>}
    </div>}
    <div className="toolbar">
      <div className="search">⌕<input placeholder="Buscar indicador, CHAVE, área ou distribuidora..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      {statusGroups.map(([id, label, test]) => <button key={id} className={`chip ${group === id ? "active" : ""}`} onClick={() => setGroup(id)}>{label} <b>{base.filter(r => test(r.status)).length}</b></button>)}
      {user.role === "APURADOR" && <button className={`chip ${mine ? "active" : ""}`} onClick={() => setMine(!mine)}>Meus indicadores</button>}
    </div>
    <section className="table-panel"><div className="table-scroll"><table>
      <thead><tr><th>Indicador</th><th>Unidade / área</th><th>Previsto</th><th>Realizado</th><th>Resultado</th><th>Nota</th><th>Status</th><th>Prazo</th><th>Responsável</th><th></th></tr></thead>
      <tbody>{shown.map(r => {
        const editable = can.editValue(r.ind, r.v.co, "actual", month) || can.editValue(r.ind, r.v.co, "planned", month);
        return <tr key={unitKey(r.v.ind, r.v.co, r.v.seg)}>
          <td><button className="indicator-link" onClick={() => setDetail(r)}><span className="code">{r.ind.code}</span><div><strong>{r.ind.name}</strong><small>{r.ind.kind === "DEPENDENTE" ? "ƒ(x) dependente · " : ""}Régua {r.ind.defaultRule} · {r.ind.unit}{r.v.entry?.pis ? ` · ${r.v.entry.pis.length} PIs` : ""}</small></div><span className="indicator-open" aria-hidden="true">→</span></button></td>
          <td><strong>{r.v.co} · {r.segName}</strong><small>{r.v.chave}</small></td>
          <td>{r.v.planned === null ? "—" : fmt(r.v.planned)}</td>
          <td className={r.v.actual === null ? "missing" : ""}>{r.v.actual === null ? (r.ind.kind === "DEPENDENTE" ? "Aguardando" : "Não informado") : fmt(r.v.actual)}</td>
          <td>{r.result === null ? "—" : r.rule?.base === "VALOR" ? fmt(r.result, 2) : fmt(r.result, 1) + "%"}</td>
          <td><Score value={r.score} onClick={() => setDetail(r)} /></td>
          <td><Status status={r.status} /></td>
          <td>{fmtDate(r.deadline)}</td>
          <td><Owner name={ownerName(r.ind.ownerId)} /></td>
          <td>{editable ? <button className="row-action" onClick={() => setEditing(r)}>Editar</button> : <button className="row-action" onClick={() => setDetail(r)}>Ver</button>}</td>
        </tr>;
      })}</tbody>
    </table></div>
    {!shown.length && <Empty>Nenhum indicador encontrado para os filtros selecionados.</Empty>}
    <div className="table-footer"><span>Exibindo {shown.length} de {rows.length} lançamentos · {months[month - 1]}/{scn.year}</span><span>Data de referência: {fmtDate(db.refDate)}</span></div></section>
    {detail && <IndicatorDetail row={detail} onClose={() => setDetail(null)} onEdit={() => { setEditing(detail); setDetail(null); }} />}
    {editing && <EntryEditor row={editing} onClose={() => setEditing(null)} />}
    {importing && <ImportModal onClose={() => setImporting(false)} />}
  </>;
}

// ─── Lançamento ─────────────────────────────────────────────────────────────

export function EntryEditor({ row, onClose }: { row: Row; onClose: () => void }) {
  const { db, scn, can, month, mutate, notify } = useTorre();
  const { v, ind, rule } = row;
  const key = entryKey(scn.year, month, v.ind, v.co, v.seg);
  const current: Entry = db.entries[key] ?? { planned: null, actual: null, deliveredOn: null };
  const [planned, setPlanned] = useState(current.planned === null ? "" : String(current.planned));
  const [actual, setActual] = useState(current.actual === null ? "" : String(current.actual));
  const [note, setNote] = useState(current.note ?? "");
  const [pis, setPis] = useState<PiRow[]>(current.pis ?? []);
  const canPlanned = can.editValue(ind, v.co, "planned", month), canActual = can.editValue(ind, v.co, "actual", month);
  const usePis = ind.piDetail && pis.length > 0;
  const num = (s: string) => s.trim() === "" ? null : Number(s.replace(",", "."));
  const p = usePis ? pis.reduce((a, x) => a + x.planned, 0) : num(planned);
  const a = usePis ? (pis.some(x => x.actual !== null) ? pis.reduce((s, x) => s + (x.actual ?? 0), 0) : null) : num(actual);
  const invalid = [p, a].some(x => x !== null && !Number.isFinite(x));
  const result = rule && !invalid ? resultOf(p, a, rule) : null;
  const score = rule ? scoreOf(result, rule, ruleParams(rule, v.co)) : null;

  function save() {
    const changes: AuditInput[] = [];
    const entity = `${ind.name} · ${v.chave}`;
    if (p !== current.planned) changes.push({ category: "VALOR", action: "Atualizou previsto", entity, before: current.planned === null ? "vazio" : fmt(current.planned), after: p === null ? "vazio" : fmt(p) });
    if (a !== current.actual) changes.push({ category: "VALOR", action: "Atualizou realizado", entity, before: current.actual === null ? "vazio" : fmt(current.actual), after: a === null ? "vazio" : fmt(a) });
    if (usePis && JSON.stringify(pis) !== JSON.stringify(current.pis ?? [])) changes.push({ category: "VALOR", action: "Detalhou por PI", entity, after: `${pis.length} projetos de investimento` });
    if (!changes.length && note === (current.note ?? "")) { onClose(); return; }
    mutate(d => {
      d.entries[key] = { planned: p, actual: a, deliveredOn: a !== current.actual && a !== null ? d.refDate : current.deliveredOn, note: note || undefined, pis: usePis ? pis : undefined };
    }, changes);
    notify("Valor salvo. Notas de indicador, índice, meta e distribuidora recalculadas.");
    onClose();
  }

  return <Modal eyebrow="LANÇAMENTO DE RESULTADO" title={ind.name} subtitle={`${v.chave} · ${months[month - 1]}/${scn.year} · valores acumulados`} onClose={onClose}
    actions={<><button onClick={onClose}>Cancelar</button><button className="primary" disabled={invalid} onClick={save}>Salvar e recalcular</button></>}>
    {(!canPlanned || !canActual) && <div className="banner info compact">{canPlanned ? "" : "Previsto: somente o responsável técnico ou o administrador altera. "}{canActual ? "" : "Realizado bloqueado para o seu perfil."}</div>}
    {usePis ? <div className="pi-editor">
      <table><thead><tr><th>PI</th><th>Descrição</th><th>Previsto</th><th>Realizado</th></tr></thead><tbody>{pis.map((x, i) => <tr key={i}>
        <td><input value={x.pi} disabled={!canPlanned} onChange={e => setPis(pis.map((y, j) => j === i ? { ...y, pi: e.target.value } : y))} /></td>
        <td><input value={x.name} disabled={!canPlanned} onChange={e => setPis(pis.map((y, j) => j === i ? { ...y, name: e.target.value } : y))} /></td>
        <td><input type="number" value={x.planned} disabled={!canPlanned} onChange={e => setPis(pis.map((y, j) => j === i ? { ...y, planned: +e.target.value } : y))} /></td>
        <td><input type="number" value={x.actual ?? ""} disabled={!canActual} onChange={e => setPis(pis.map((y, j) => j === i ? { ...y, actual: e.target.value === "" ? null : +e.target.value } : y))} /></td>
      </tr>)}</tbody></table>
      {canPlanned && <button className="row-action" onClick={() => setPis([...pis, { pi: `PI-${String(scn.year).slice(2)}-${String(pis.length + 1).padStart(4, "0")}`, name: "Novo projeto", planned: 0, actual: null }])}>＋ Adicionar PI</button>}
      <p className="hint">Total consolidado do indicador = soma dos PIs.</p>
    </div> : <div className="form-grid">
      <label>Previsto acumulado ({ind.unit})<input type="number" value={planned} disabled={!canPlanned} onChange={e => setPlanned(e.target.value)} /></label>
      <label>Realizado acumulado ({ind.unit})<input autoFocus type="number" value={actual} disabled={!canActual} onChange={e => setActual(e.target.value)} /></label>
      {ind.piDetail && canPlanned && <button className="row-action span-2" onClick={() => setPis([{ pi: `PI-${String(scn.year).slice(2)}-0001`, name: "Projeto principal", planned: p ?? 0, actual: a }])}>Detalhar por Projeto de Investimento (PI)</button>}
    </div>}
    <div className="calc-preview"><span>RESULTADO</span><strong>{result === null ? "—" : rule?.base === "VALOR" ? fmt(result) : fmt(result, 1) + "%"}</strong><span>NOTA ({rule?.code}{rule?.overrides[v.co] ? ` · ${v.co}` : ""})</span><strong className="score">{score === null ? "—" : fmt(score)}</strong></div>
    <label className="notes">Justificativa / observação<textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Contextualize o resultado, se necessário." /></label>
  </Modal>;
}

// ─── Memória de cálculo ─────────────────────────────────────────────────────

export function IndicatorDetail({ row, onClose, onEdit }: { row: Row; onClose: () => void; onEdit?: () => void }) {
  const { db, scn, can, month, meta, calc, weightView } = useTorre();
  const { v, ind, rule, result, score, status } = row;
  const params = rule ? ruleParams(rule, v.co) : null;
  const users = (ids: string[]) => ids.map(id => db.users.find(u => u.id === id)?.name).filter(Boolean).join(", ") || "—";
  const leaf = meta ? leaves(meta.children).find(l => l.indicator === ind.code) : undefined;
  const companyCalc = calc?.byCompany[v.co];
  const path: { label: string; weight: string; score: number | null }[] = [];
  if (companyCalc && leaf) {
    const walk = (node: typeof companyCalc, trail: typeof path): boolean => {
      if (node.id === leaf.id) {
        const area = node.areas?.find(a => a.seg === v.seg);
        path.push({ label: `${row.segName} (área)`, weight: area ? fmt(area.eff * 100, 1) + "%" : "—", score: area?.score ?? null }, { label: `${node.label} (indicador · régua ${node.rule})`, weight: fmt(node.weight, 1) + "%", score: node.score }, ...trail);
        return true;
      }
      return node.children.some(c => walk(c, [{ label: node.kind === "META" ? `${node.label} · ${v.co}` : node.label, weight: node.kind === "META" ? "100%" : fmt(node.weight, 1) + "%", score: node.score }, ...trail]));
    };
    walk(companyCalc, []);
    const gp = calc!.globalParts.find(g => g.co === v.co);
    path.push({ label: `Nota global da Torre (${weightView.toLowerCase()})`, weight: gp ? fmt(gp.weight, 2) + "% da distribuidora" : "—", score: calc!.global });
  }
  const history = db.audit.filter(a => a.entity.includes(v.chave));
  const pos = (x: number) => rule?.polarity === "MENOR" ? -x : x;
  const pct = (x: number) => params ? Math.min(100, Math.max(0, (pos(x) - pos(params.min)) / (pos(params.challenge) - pos(params.min)) * 100)) : 0;

  return <Drawer eyebrow="MEMÓRIA DE CÁLCULO" title={ind.name} subtitle={`CHAVE ${v.chave}`} onClose={onClose}
    actions={<><button className="drawer-close" onClick={onClose}><span aria-hidden="true">×</span>Fechar</button>{onEdit && (can.editValue(ind, v.co, "actual", month) || can.editValue(ind, v.co, "planned", month)) && <button className="drawer-edit primary" onClick={onEdit}><span aria-hidden="true">✎</span>Editar resultado</button>}</>}>
    <div className="detail-summary">
      <div><span>Código</span><strong>{ind.code} · {ind.kind === "DEPENDENTE" ? "Dependente" : "Base"}</strong></div><div><span>Unidade</span><strong>{v.co} · {row.segName}</strong></div>
      <div><span>Responsável técnico</span><strong>{users([ind.ownerId])}</strong></div><div><span>Apuradores</span><strong>{users(ind.apuradorIds)}</strong></div>
      <div><span>Prazo</span><strong>{fmtDate(row.deadline)}</strong></div><div><span>Status</span><strong><Status status={status} /></strong></div>
    </div>
    <div className="big-score"><span>Nota da área (régua padrão {rule?.code})</span><strong>{score === null ? "—" : fmt(score)}</strong><small>{v.entry?.deliveredOn ? `Entregue em ${fmtDate(v.entry.deliveredOn)}` : "Sem entrega"}</small></div>
    <h3>Valores do período · {months[month - 1]}/{scn.year}</h3>
    <div className="trace"><div><span>Previsto</span><b>{v.planned === null ? "—" : fmt(v.planned)}</b></div><i>→</i><div><span>Realizado</span><b>{v.actual === null ? "Sem valor" : fmt(v.actual)}</b></div><i>→</i><div><span>{rule?.base === "VALOR" ? "Valor avaliado" : "Atingimento"}</span><b>{result === null ? "—" : rule?.base === "VALOR" ? fmt(result) : fmt(result, 1) + "%"}</b></div></div>
    {ind.kind === "DEPENDENTE" && <>
      <h3>Fórmula e origem dos valores</h3>
      <div className="formula-box"><span>REALIZADO</span><code>{ind.formulaActual}</code>{ind.formulaPlanned && <><span>PREVISTO</span><code>{ind.formulaPlanned}</code></>}<p>Mesma unidade organizacional e período · origem localizada pela CHAVE_INDICADOR trocando apenas o código do indicador.</p></div>
      <table className="mini-table"><thead><tr><th>Variável</th><th>CHAVE de origem</th><th>Valor</th></tr></thead><tbody>{(v.trace ?? []).map((t, i) => <tr key={i}><td>{t.kind}[{t.code}]</td><td><code>{t.chave}</code></td><td>{t.value === null ? "—" : fmt(t.value)}</td></tr>)}</tbody></table>
      {v.formulaError && <div className="form-error">{v.formulaError}</div>}
    </>}
    {v.entry?.pis && <><h3>Detalhamento por Projeto de Investimento</h3>
      <table className="mini-table"><thead><tr><th>PI</th><th>Previsto</th><th>Realizado</th><th>%</th></tr></thead><tbody>{v.entry.pis.map(p => <tr key={p.pi}><td><strong>{p.pi}</strong><small>{p.name}</small></td><td>{fmt(p.planned)}</td><td>{p.actual === null ? "—" : fmt(p.actual)}</td><td>{p.actual === null || !p.planned ? "—" : fmt(p.actual / p.planned * 100, 1) + "%"}</td></tr>)}</tbody></table></>}
    {rule && params && <><h3>Régua aplicada · {rule.code}{rule.overrides[v.co] ? ` (específica ${v.co})` : ""}</h3>
      <div className="ruler"><div style={{ left: `${result === null ? 0 : pct(result)}%` }}></div><span style={{ left: "0%" }}>Mín. {fmt(params.min, 1)}</span><span style={{ left: `${pct(params.target)}%` }}>Meta {fmt(params.target, 1)}</span><span style={{ left: "100%" }}>Des. {fmt(params.challenge, 1)}</span></div>
      <div className="formula-box"><span>INTERPOLAÇÃO LINEAR POR TRECHO</span><code>mínimo → 1 · meta → 10 · desafio → 15</code><p>Polaridade “quanto {rule.polarity === "MAIOR" ? "maior, melhor" : "menor, melhor"}” · abaixo do mínimo: nota {rule.floor} · acima do desafio: {rule.ceiling === "TETO" ? "teto 15" : "extrapola"}</p></div></>}
    <h3>Composição superior · {meta?.name}</h3>
    {path.length ? <ul className="composition">{path.map((p, i) => <li key={i}><span>{p.label}</span><b>{p.weight} · nota {p.score === null ? "—" : fmt(p.score)}</b></li>)}</ul> : <p className="hint pad">Indicador não compõe a meta selecionada.</p>}
    <h3>Histórico de alterações</h3>
    {history.length ? <ul className="composition">{history.slice(0, 6).map(h => <li key={h.id}><span>{new Date(h.at).toLocaleString("pt-BR")} · {h.userName}<small>{h.action}</small></span><b>{h.before ?? ""} → {h.after ?? ""}</b></li>)}</ul> : <p className="hint pad">Nenhuma alteração registrada para esta CHAVE.</p>}
  </Drawer>;
}

// ─── Importação em lote ─────────────────────────────────────────────────────

type ParsedRow = { line: number; raw: string[]; key?: string; parsed?: ReturnType<typeof parseChave>; planned: number | null; actual: number | null; pi?: string; piName?: string; errors: string[] };

function templateRows(db: DB, scn: Scenario, month: number, mode: "RESULTADOS" | "CURVA") {
  const header = ["CHAVE_INDICADOR", "INDICADOR", "PREVISTO", "REALIZADO", "PI", "DESCRICAO_PI"];
  const rows: (string | number | null)[][] = [header];
  const monthsToFill = mode === "CURVA" ? Array.from({ length: 12 }, (_, i) => i + 1) : [month];
  for (const ind of scn.indicators.filter(i => i.kind === "BASE" && i.active)) for (const co of db.org.companies.filter(c => c.active)) {
    if (scn.eligibility[`${ind.code}|${co.id}`] === false) continue;
    for (const seg of ind.areas) for (const m of monthsToFill) {
      const e = db.entries[entryKey(scn.year, m, ind.code, co.id, seg)];
      const prev = scn.createdFrom ? db.entries[entryKey(scn.createdFrom, m, ind.code, co.id, seg)] : undefined;
      rows.push([chave(co.id, seg, scn.year, m, ind.code), ind.name, e?.planned ?? prev?.planned ?? null, mode === "CURVA" ? null : e?.actual ?? null, null, null]);
    }
  }
  return rows;
}

function exampleCSV(db: DB, scn: Scenario, month: number) {
  const pending = [...Object.entries(db.entries)].filter(([k, e]) => k.startsWith(`${scn.year}|${month}|`) && e.actual === null).slice(0, 5);
  const lines = pending.map(([k, e]) => { const [, , ind, co, seg] = k.split("|"); return [chave(co, seg, scn.year, month, ind), "", String(e.planned ?? "").replace(".", ","), String(((e.planned ?? 100) * .96).toFixed(2)).replace(".", ","), "", ""]; });
  const prev = month > 1 ? month - 1 : month;
  return [
    "CHAVE_INDICADOR;INDICADOR;PREVISTO;REALIZADO;PI;DESCRICAO_PI",
    ...lines.map(l => l.join(";")),
    `MA-ORD-00/${scn.year}-${String(month).padStart(2, "0")}/01;Formato antigo;100;98;;`,
    `${chave("PI", "EAT", scn.year, month, "02")};Não elegível;50;48;;`,
    `${chave("MA", "ORD", scn.year, month, "05")};Dependente;100;99;;`,
    `${chave("MA", "ORD", scn.year, prev, "01")};Período fechado;100;98;;`,
    `${chave("PA", "ORD", scn.year, month, "99")};Indicador inexistente;10;9;;`,
    `${chave("GO", "AUT", scn.year, month, "06")};Área não executora;10;9;;`,
    `${chave("AL", "ORD", scn.year, month, "06")};Número inválido;12;12,3,4;;`,
  ].join("\n");
}

export function ImportModal({ onClose }: { onClose: () => void }) {
  const { db, scn, can, month, mutate, notify } = useTorre();
  const [mode, setMode] = useState<"RESULTADOS" | "CURVA">("RESULTADOS");
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const inds = new Map(scn.indicators.map(i => [i.code, i]));

  function validate(source = text) {
    const rows = parseCSV(source);
    if (!rows.length) { notify("Arquivo vazio.", "warn"); return; }
    const header = rows[0].map(h => h.trim().toUpperCase());
    const col = (name: string) => header.indexOf(name);
    const [ci, cp, ca, cpi, cpn] = [col("CHAVE_INDICADOR"), col("PREVISTO"), col("REALIZADO"), col("PI"), col("DESCRICAO_PI")];
    if (ci < 0) { notify("Cabeçalho sem a coluna CHAVE_INDICADOR.", "err"); return; }
    const seen = new Set<string>();
    const out: ParsedRow[] = rows.slice(1).map((raw, i) => {
      const errors: string[] = [];
      const parsedKey = parseChave(raw[ci] ?? "");
      const planned = cp >= 0 ? parseNumber(raw[cp] ?? "") : null, actual = ca >= 0 && mode === "RESULTADOS" ? parseNumber(raw[ca] ?? "") : null;
      const pi = cpi >= 0 ? raw[cpi]?.trim() || undefined : undefined;
      if (planned === "invalid") errors.push("PREVISTO não é um número válido");
      if (actual === "invalid") errors.push("REALIZADO não é um número válido");
      if (!parsedKey) errors.push("CHAVE fora do padrão EMPRESA.SEGMENTO.REGIONAL|AAAA-MM|INDICADOR");
      else {
        const { company, segment, regional, year, month: m, indicator } = parsedKey;
        const co = db.org.companies.find(c => c.id === company), seg = db.org.segments.find(s => s.code === segment), ind = inds.get(indicator);
        if (year !== scn.year) errors.push(`Período de outro cenário (${year})`);
        if (m < 1 || m > 12) errors.push("Mês inválido");
        else if (scn.closedMonths.includes(m)) errors.push(`${months[m - 1]} já homologado`);
        if (!co) errors.push(`Distribuidora ${company} não cadastrada`); else if (!co.active) errors.push(`Distribuidora ${company} inativa`);
        if (!seg) errors.push(`Segmento ${segment} não cadastrado`); else if (!seg.active) errors.push(`Segmento ${segment} inativo`);
        if (regional !== "00") errors.push("Lançamento por regional não habilitado (use 00 = área consolidada)");
        if (!ind) errors.push(`Indicador ${indicator} não existe no cenário`);
        else {
          if (ind.kind === "DEPENDENTE") errors.push("Indicador dependente é calculado por fórmula");
          if (!ind.active) errors.push("Indicador inativo");
          if (co && scn.eligibility[`${ind.code}|${co.id}`] === false) errors.push("Indicador não aplicável à distribuidora (matriz de elegibilidade)");
          if (seg && !ind.areas.includes(seg.code)) errors.push(`${seg.name} não é área executora do indicador`);
          if (pi && !ind.piDetail) errors.push("Indicador não detalha por PI");
          if (co && typeof planned === "number" && !can.editValue(ind, co.id, "planned", m)) errors.push("Sem permissão para alterar o previsto");
          if (co && typeof actual === "number" && !can.editValue(ind, co.id, "actual", m)) errors.push("Sem permissão para lançar o realizado");
        }
        const dupKey = `${raw[ci].trim().toUpperCase()}|${pi ?? ""}`;
        if (seen.has(dupKey)) errors.push("CHAVE duplicada no arquivo"); seen.add(dupKey);
        if (planned === null && actual === null) errors.push("Nenhum valor informado");
      }
      return { line: i + 2, raw, key: parsedKey ? entryKey(parsedKey.year, parsedKey.month, parsedKey.indicator, parsedKey.company, parsedKey.segment) : undefined, parsed: parsedKey, planned: typeof planned === "number" ? planned : null, actual: typeof actual === "number" ? actual : null, pi, piName: cpn >= 0 ? raw[cpn]?.trim() : undefined, errors };
    });
    setParsed(out);
  }

  function apply() {
    const ok = parsed!.filter(r => !r.errors.length && r.key);
    const groups = new Map<string, ParsedRow[]>();
    ok.forEach(r => groups.set(r.key!, [...(groups.get(r.key!) ?? []), r]));
    const audits: AuditInput[] = [{ category: "IMPORTACAO", action: mode === "CURVA" ? "Carregou curva de previsto" : "Importou lote", entity: `${scn.year} · ${groups.size} CHAVES`, after: `${ok.length} válidos · ${parsed!.length - ok.length} rejeitados` }];
    const show = (n: number | null | undefined) => n === null || n === undefined ? "vazio" : fmt(n);
    for (const [key, rows] of groups) {
      const before = db.entries[key], p = rows[0].parsed!;
      const entity = `${inds.get(p.indicator)?.name} · ${chave(p.company, p.segment, p.year, p.month, p.indicator)}`;
      const planned = rows.some(r => r.pi) ? rows.reduce((a, r) => a + (r.planned ?? 0), 0) : rows[0].planned;
      const actual = rows.some(r => r.pi) ? rows.reduce((a, r) => a + (r.actual ?? 0), 0) : rows[0].actual;
      if (planned !== null && planned !== before?.planned) audits.push({ category: "VALOR", action: "Importou previsto", entity, before: show(before?.planned), after: show(planned) });
      if (actual !== null && actual !== before?.actual) audits.push({ category: "VALOR", action: "Importou realizado", entity, before: show(before?.actual), after: show(actual) });
    }
    mutate(d => {
      for (const [key, rows] of groups) {
        const before = d.entries[key];
        const withPi = rows.filter(r => r.pi);
        const next: Entry = { planned: before?.planned ?? null, actual: before?.actual ?? null, deliveredOn: before?.deliveredOn ?? null, note: before?.note, pis: before?.pis };
        if (withPi.length) {
          next.pis = withPi.map(r => ({ pi: r.pi!, name: r.piName || r.pi!, planned: r.planned ?? 0, actual: r.actual }));
          next.planned = next.pis.reduce((a, x) => a + x.planned, 0);
          next.actual = next.pis.some(x => x.actual !== null) ? next.pis.reduce((a, x) => a + (x.actual ?? 0), 0) : next.actual;
        } else {
          if (rows[0].planned !== null) next.planned = rows[0].planned;
          if (rows[0].actual !== null) next.actual = rows[0].actual;
        }
        if (next.actual !== null && next.actual !== before?.actual) next.deliveredOn = d.refDate;
        d.entries[key] = next;
      }
    }, audits);
    notify(`${ok.length} registro(s) efetivado(s); consolidação recalculada.`);
    onClose();
  }

  const okCount = parsed?.filter(r => !r.errors.length).length ?? 0;
  return <Modal wide eyebrow="RECEBIMENTO EM LOTE" title={mode === "CURVA" ? "Carga de curvas (previsto)" : "Importar resultados"} subtitle="Arquivo CSV separado por ponto e vírgula, mapeado pela CHAVE_INDICADOR. A carga só é efetivada após a validação." onClose={onClose}
    actions={<><button onClick={onClose}>Cancelar</button>{parsed ? <><button onClick={() => setParsed(null)}>Voltar</button><button className="primary" disabled={!okCount} onClick={apply}>Efetivar {okCount} registro(s) válido(s)</button></> : <button className="primary" disabled={!text.trim()} onClick={() => validate()}>Validar arquivo</button>}</>}>
    {!parsed ? <div className="import-body">
      <div className="segmented"><button className={mode === "RESULTADOS" ? "active" : ""} onClick={() => setMode("RESULTADOS")}>Resultados do período</button><button className={mode === "CURVA" ? "active" : ""} onClick={() => setMode("CURVA")}>Curva anual de previsto</button></div>
      <div className="import-actions">
        <button onClick={() => download(`modelo-${mode === "CURVA" ? "curva" : "resultados"}-${scn.year}.csv`, toCSV(templateRows(db, scn, month, mode)))}>⇩ Baixar modelo {mode === "CURVA" ? `(Jan–Dez${scn.createdFrom ? `, pré-preenchido com ${scn.createdFrom}` : ""})` : `(${months[month - 1]})`}</button>
        <label className="file-button">⇧ Selecionar arquivo CSV<input type="file" accept=".csv,.txt" onChange={async e => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} /></label>
        {mode === "RESULTADOS" && <button onClick={() => setText(exampleCSV(db, scn, month))}>Carregar exemplo com inconsistências</button>}
      </div>
      <textarea className="csv-input" value={text} onChange={e => setText(e.target.value)} placeholder={"CHAVE_INDICADOR;INDICADOR;PREVISTO;REALIZADO;PI;DESCRICAO_PI\nMA.ORD.00|2025-10|01;Avanço Físico VR;13800;13250;;"} />
      <p className="hint">Validações: formato da CHAVE, distribuidora/segmento existentes e ativos, indicador aplicável (matriz de elegibilidade), área executora, período aberto, números válidos, duplicidade e permissão do usuário.</p>
    </div> : <div className="import-body">
      <div className="import-summary"><div className="ok"><strong>{okCount}</strong><span>válidos</span></div><div className="bad"><strong>{parsed.length - okCount}</strong><span>com inconsistência</span></div><div><strong>{parsed.length}</strong><span>linhas lidas</span></div></div>
      <div className="table-scroll short"><table className="mini-table"><thead><tr><th>Linha</th><th>CHAVE</th><th>Previsto</th><th>Realizado</th><th>Validação</th></tr></thead><tbody>{parsed.map(r => <tr key={r.line} className={r.errors.length ? "row-bad" : ""}>
        <td>{r.line}</td><td><code>{r.raw[0]}</code>{r.pi && <small>{r.pi}</small>}</td><td>{r.planned === null ? "—" : fmt(r.planned)}</td><td>{r.actual === null ? "—" : fmt(r.actual)}</td>
        <td>{r.errors.length ? <span className="err-text">{r.errors.join(" · ")}</span> : <span className="ok-text">✓ Pronto para carga</span>}</td>
      </tr>)}</tbody></table></div>
    </div>}
  </Modal>;
}
