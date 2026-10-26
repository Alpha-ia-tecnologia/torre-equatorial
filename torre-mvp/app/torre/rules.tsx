"use client";

import { useState } from "react";
import { calcOrder, findCycle, fmt, formulaRefs, leaves, near100, scoreOf, sum, unitKey, validRuleParams, weightViews } from "./engine";
import { useTorre } from "./store";
import type { Indicator, Rule, RuleParams, Scenario, WeightView } from "./types";
import { IndicatorModal, WeightInput } from "./structure";
import { Guarded, Modal, PageTitle } from "./ui";

const scnOf = (d: { scenarios: Scenario[] }, year: number) => d.scenarios.find(s => s.year === year)!;
const paramsText = (p: RuleParams) => `${fmt(p.min, 2)} / ${fmt(p.target, 2)} / ${fmt(p.challenge, 2)}`;

export function Rules() {
  const { scn, can, issues } = useTorre();
  const [tab, setTab] = useState<"rules" | "weights" | "formulas">("rules");
  const [ruleDraft, setRuleDraft] = useState<Rule | null>(null);
  const [formulaModal, setFormulaModal] = useState<{ ind: Indicator | null } | null>(null);
  const weightErrors = issues.filter(i => i.scope === "Pesos").length;
  const reason = scn.status === "ENCERRADO" ? "Cenário encerrado: parâmetros históricos preservados." : "Parametrização restrita a administradores da Torre.";
  return <><PageTitle eyebrow="MOTOR DE CÁLCULO" title="Réguas, pesos e fórmulas" desc="Parâmetros de nota, ponderações por visão e indicadores dependentes, sem alteração de código."
    actions={tab === "rules" ? <Guarded allowed={can.structure} reason={reason} className="primary" onClick={() => setRuleDraft({ code: "", name: "", polarity: "MAIOR", base: "ATINGIMENTO", min: 70, target: 100, challenge: 110, active: true, floor: 0, ceiling: "TETO", overrides: {}, history: [] })}>＋ Nova régua</Guarded>
      : tab === "formulas" ? <Guarded allowed={can.structure} reason={reason} className="primary" onClick={() => setFormulaModal({ ind: null })}>＋ Novo indicador dependente</Guarded> : undefined} />
    <section className="engine-summary"><div><span>RÉGUAS ATIVAS</span><strong>{scn.rules.filter(r => r.active).length}<small> + {sum(scn.rules.map(r => Object.keys(r.overrides).length))} específicas</small></strong></div>
      <div><span>PESOS</span><strong className={weightErrors ? "warn" : "ok"}>{weightErrors ? `${weightErrors} divergência(s)` : "Consistentes"}</strong></div>
      <div><span>INDICADORES DEPENDENTES</span><strong>{scn.indicators.filter(i => i.kind === "DEPENDENTE").length}</strong></div>
      <div><span>CENÁRIO</span><strong className="source-label">{scn.year} · v{scn.version}</strong></div></section>
    <div className="tabs"><button className={tab === "rules" ? "active" : ""} onClick={() => setTab("rules")}>Réguas de avaliação <b>{scn.rules.length}</b></button><button className={tab === "weights" ? "active" : ""} onClick={() => setTab("weights")}>Pesos de consolidação {weightErrors > 0 && <b className="warn-b">{weightErrors}</b>}</button><button className={tab === "formulas" ? "active" : ""} onClick={() => setTab("formulas")}>Fórmulas dependentes <b>{scn.indicators.filter(i => i.kind === "DEPENDENTE").length}</b></button></div>
    {tab === "rules" && <RulesTab onEdit={setRuleDraft} />}
    {tab === "weights" && <WeightsTab />}
    {tab === "formulas" && <FormulasTab onEdit={ind => setFormulaModal({ ind })} />}
    {ruleDraft && <RuleModal draft={ruleDraft} onClose={() => setRuleDraft(null)} />}
    {formulaModal && <IndicatorModal ind={formulaModal.ind} preset={{ kind: "DEPENDENTE", formulaActual: "", formulaPlanned: "" }} onClose={() => setFormulaModal(null)} />}
  </>;
}

function RulesTab({ onEdit }: { onEdit: (r: Rule) => void }) {
  const { db, scn, can, mutate, notify } = useTorre();
  const [selected, setSelected] = useState(scn.rules[0]?.code ?? "");
  const [history, setHistory] = useState<Rule | null>(null);
  const [sim, setSim] = useState({ rule: scn.rules[0]?.code ?? "", co: "", planned: 100, actual: 97.7 });
  const rule = scn.rules.find(r => r.code === selected) ?? scn.rules[0];
  const linked = (code: string) => scn.metas.flatMap(m => leaves(m.children).filter(l => l.rule === code).map(l => `${scn.indicators.find(i => i.code === l.indicator)?.name ?? l.indicator} (${m.name.replace(/ \d{4}$/, "")})`));
  const simRule = scn.rules.find(r => r.code === sim.rule) ?? scn.rules[0];
  const simResult = simRule?.base === "VALOR" ? sim.actual : sim.planned ? sim.actual / sim.planned * 100 : 0;
  const user = db.users.find(u => u.id === db.currentUserId)!;

  function setOverride(co: string, p: RuleParams | null) {
    mutate(d => { const r = scnOf(d, scn.year).rules.find(x => x.code === rule.code)!; if (p) r.overrides[co] = p; else delete r.overrides[co]; r.history.unshift({ at: new Date().toISOString(), by: user.name, summary: p ? `${co}: ${paramsText(p)}` : `${co}: volta à régua padrão` }); },
      { category: "REGUA", action: p ? "Ajustou régua específica" : "Removeu régua específica", entity: `${co}_${rule.code}`, before: rule.overrides[co] ? paramsText(rule.overrides[co]) : `padrão ${paramsText(rule)}`, after: p ? paramsText(p) : `padrão ${paramsText(rule)}` });
  }

  return <>
    <section className="rule-grid robust">{scn.rules.map(r => { const l = linked(r.code); return <article className={`rule-card ${!r.active ? "inactive" : ""} ${r.code === rule?.code ? "selected" : ""}`} key={r.code} onClick={() => setSelected(r.code)}>
      <div className="rule-head"><span className="rule-code">{r.code}</span><div>{can.structure && <button onClick={e => { e.stopPropagation(); onEdit(structuredClone(r)); }}>Editar</button>}<button onClick={e => { e.stopPropagation(); setHistory(r); }}>Histórico</button></div></div>
      <h3>{r.name}</h3><p>Quanto <b>{r.polarity === "MAIOR" ? "maior, melhor" : "menor, melhor"}</b> · {r.base === "VALOR" ? "valor absoluto" : "atingimento %"} · piso {r.floor} · {r.ceiling === "TETO" ? "teto 15" : "extrapola"}</p>
      <div className="rule-points"><div><span>MÍNIMO</span><b>{fmt(r.min, r.min % 1 ? 2 : 0)}</b><small>Nota 1</small></div><div><span>META</span><b>{fmt(r.target, r.target % 1 ? 2 : 0)}</b><small>Nota 10</small></div><div><span>DESAFIO</span><b>{fmt(r.challenge, r.challenge % 1 ? 2 : 0)}</b><small>Nota 15</small></div></div>
      <div className={`rule-gradient ${r.polarity === "MENOR" ? "reverse" : ""}`}><i></i><i></i><i></i></div>
      <footer><span title={l.join("\n")}>{l.length} vínculo(s) · {Object.keys(r.overrides).length} específica(s)</span>{can.structure && <button className={`mini-toggle ${r.active ? "on" : ""}`} onClick={e => { e.stopPropagation(); if (r.active && l.length) { notify(`Régua ${r.code} vinculada a ${l.length} indicador(es): desvincule antes de inativar.`, "warn"); return; } mutate(d => { scnOf(d, scn.year).rules.find(x => x.code === r.code)!.active = !r.active; }, { category: "REGUA", action: r.active ? "Inativou régua" : "Ativou régua", entity: r.code }); }}><i></i>{r.active ? "Ativa" : "Inativa"}</button>}</footer>
    </article>; })}</section>
    {rule && <section className="panel rule-table"><div className="panel-head"><div><h2>Régua {rule.code} por distribuidora</h2><p>Chave composta DISTRIBUIDORA_RÉGUA (tabela REGUAS). Sem ajuste específico, vale a régua padrão.</p></div><span className="valid">{Object.keys(rule.overrides).length} específica(s)</span></div>
      <div className="table-scroll"><table><thead><tr><th>Distribuidora</th><th>Chave</th><th>Mínimo · nota 1</th><th>Meta · nota 10</th><th>Desafio · nota 15</th><th>Origem</th><th></th></tr></thead>
        <tbody>{db.org.companies.map(c => { const o = rule.overrides[c.id]; const p = o ?? rule; const bad = o && !validRuleParams(rule.polarity, o); return <tr key={c.id} className={bad ? "row-bad" : ""}>
          <td><span className="company-code">{c.id}</span> {c.name}</td><td><code>{c.id}_{rule.code}</code></td>
          {(["min", "target", "challenge"] as const).map(k => <td key={k}>{o && can.structure ? <WeightInput value={o[k]} suffix="" onCommit={v => setOverride(c.id, { ...o, [k]: v })} /> : fmt(p[k], 2)}</td>)}
          <td>{o ? <span className="tag">Específica{bad ? " · incoerente" : ""}</span> : "Padrão"}</td>
          <td>{can.structure && (o ? <button className="row-action" onClick={() => setOverride(c.id, null)}>Usar padrão</button> : <button className="row-action" onClick={() => setOverride(c.id, { min: rule.min, target: rule.target, challenge: rule.challenge })}>Personalizar</button>)}</td>
        </tr>; })}</tbody></table></div></section>}
    <section className="panel simulator wide-sim"><span>SIMULADOR DA RÉGUA</span><h3>Teste de resultado e nota</h3><div>
      <label>Régua<select value={sim.rule} onChange={e => setSim({ ...sim, rule: e.target.value })}>{scn.rules.map(r => <option key={r.code}>{r.code}</option>)}</select></label>
      <label>Distribuidora<select value={sim.co} onChange={e => setSim({ ...sim, co: e.target.value })}><option value="">Padrão</option>{db.org.companies.map(c => <option key={c.id}>{c.id}</option>)}</select></label>
      <label>Previsto<input type="number" value={sim.planned} disabled={simRule?.base === "VALOR"} onChange={e => setSim({ ...sim, planned: +e.target.value })} /></label>
      <label>Realizado<input type="number" value={sim.actual} onChange={e => setSim({ ...sim, actual: +e.target.value })} /></label>
      <div className="sim-result"><span>{simRule?.base === "VALOR" ? "VALOR" : "ATINGIMENTO"}<strong>{fmt(simResult, 2)}{simRule?.base === "VALOR" ? "" : "%"}</strong></span><i>→</i><span>NOTA<strong>{simRule ? fmt(scoreOf(simResult, simRule, (sim.co && simRule.overrides[sim.co]) || simRule) ?? 0, 2) : "—"}</strong></span></div>
    </div></section>
    {history && <Modal eyebrow="VERSIONAMENTO DA RÉGUA" title={`${history.code} · ${history.name}`} onClose={() => setHistory(null)}><ul className="composition pad-list">{history.history.map((h, i) => <li key={i}><span>{new Date(h.at).toLocaleString("pt-BR")} · {h.by}</span><b>{h.summary}</b></li>)}</ul></Modal>}
  </>;
}

function RuleModal({ draft: initial, onClose }: { draft: Rule; onClose: () => void }) {
  const { db, scn, mutate, notify } = useTorre();
  const [draft, setDraft] = useState(initial);
  const exists = scn.rules.some(r => r.code === initial.code && initial.code);
  const set = (p: Partial<Rule>) => setDraft({ ...draft, ...p });
  const error = !draft.code.trim() || !draft.name.trim() ? "Código e nome são obrigatórios." : !exists && scn.rules.some(r => r.code === draft.code) ? "Código já cadastrado." : !validRuleParams(draft.polarity, draft) ? (draft.polarity === "MAIOR" ? "Para “quanto maior, melhor”: mínimo < meta < desafio." : "Para “quanto menor, melhor”: mínimo > meta > desafio (RN-05.1).") : "";
  function save() {
    const user = db.users.find(u => u.id === db.currentUserId)!;
    const summary = `${draft.polarity} · ${paramsText(draft)} · piso ${draft.floor} · ${draft.ceiling.toLowerCase()}`;
    mutate(d => { const s = scnOf(d, scn.year); const next = { ...draft, history: [{ at: new Date().toISOString(), by: user.name, summary }, ...draft.history] }; const i = s.rules.findIndex(r => r.code === draft.code); if (i >= 0) s.rules[i] = next; else s.rules.push(next); },
      { category: "REGUA", action: exists ? "Alterou régua" : "Criou régua", entity: draft.code, before: exists ? paramsText(initial) : undefined, after: summary });
    notify("Régua salva; notas dependentes recalculadas."); onClose();
  }
  return <Modal eyebrow="CONFIGURAÇÃO DA RÉGUA" title={exists ? `Editar régua ${draft.code}` : "Nova régua"} subtitle="Pontos fixos: mínimo = nota 1, meta = nota 10, desafio = nota 15; interpolação linear entre eles." onClose={onClose}
    actions={<><button onClick={onClose}>Cancelar</button><button className="primary" disabled={!!error} onClick={save}>Salvar régua</button></>}>
    <div className="engine-form">
      <label>Código<input value={draft.code} disabled={exists} onChange={e => set({ code: e.target.value.toUpperCase().replace(/\s/g, "") })} /></label>
      <label className="span-2">Nome<input value={draft.name} onChange={e => set({ name: e.target.value })} /></label>
      <label>Polaridade<select value={draft.polarity} onChange={e => set({ polarity: e.target.value as Rule["polarity"] })}><option value="MAIOR">Quanto maior, melhor</option><option value="MENOR">Quanto menor, melhor</option></select></label>
      <label>Base do resultado<select value={draft.base} onChange={e => set({ base: e.target.value as Rule["base"] })}><option value="ATINGIMENTO">Atingimento (realizado ÷ previsto)</option><option value="VALOR">Valor absoluto do realizado</option></select></label>
      <label>Abaixo do mínimo<select value={draft.floor} onChange={e => set({ floor: +e.target.value as 0 | 1 })}><option value={0}>Nota 0</option><option value={1}>Piso nota 1</option></select></label>
      <label>Mínimo · nota 1<input type="number" value={draft.min} onChange={e => set({ min: +e.target.value })} /></label>
      <label>Meta · nota 10<input type="number" value={draft.target} onChange={e => set({ target: +e.target.value })} /></label>
      <label>Desafio · nota 15<input type="number" value={draft.challenge} onChange={e => set({ challenge: +e.target.value })} /></label>
      <label className="span-2">Acima do desafio<select value={draft.ceiling} onChange={e => set({ ceiling: e.target.value as Rule["ceiling"] })}><option value="TETO">Teto: nota 15</option><option value="EXTRAPOLAR">Extrapola a interpolação</option></select></label>
    </div>
    {error && <div className="form-error">{error}</div>}
  </Modal>;
}

function WeightsTab() {
  const { db, scn, can, mutate, notify, weightView, setWeightView, calc, meta } = useTorre();
  const [level, setLevel] = useState<"companies" | "segments" | "regionals">("companies");
  const [co, setCo] = useState(db.org.companies[0].id);
  const [seg, setSeg] = useState("ORD");
  const ws = scn.weights[weightView];
  const viewLabel = weightViews.find(v => v[0] === weightView)![1];
  const companyName = db.org.companies.find(c => c.id === co)?.name;
  const regKey = `${co}|${seg}`;
  const items: { id: string; label: string; sub: string; value: number }[] =
    level === "companies" ? db.org.companies.filter(c => c.active || ws.companies[c.id]).map(c => ({ id: c.id, label: c.name, sub: c.active ? "Consolidação global" : "Inativa · histórico", value: ws.companies[c.id] ?? 0 }))
    : level === "segments" ? db.org.segments.filter(s => s.active || ws.segments[co]?.[s.code] !== undefined).map(s => ({ id: s.code, label: s.name, sub: s.active ? `${co}.${s.code}` : "Inativo · histórico", value: ws.segments[co]?.[s.code] ?? 0 }))
    : db.org.regionals.filter(r => r.company === co && (r.active || scn.regionalWeights[regKey]?.[r.id] !== undefined)).map(r => ({ id: r.id, label: `Regional ${r.name}`, sub: `${co}.${seg}.${r.code}${r.active ? "" : " · inativa"}`, value: scn.regionalWeights[regKey]?.[r.id] ?? 0 }));
  const total = sum(items.map(i => i.value));
  const scope = level === "companies" ? `${viewLabel} · distribuidoras` : level === "segments" ? `${viewLabel} · ${co} · áreas` : `${co} · ${seg} · regionais`;

  function write(id: string, value: number, before: number) {
    mutate(d => {
      const s = scnOf(d, scn.year);
      if (level === "companies") s.weights[weightView].companies[id] = value;
      else if (level === "segments") (s.weights[weightView].segments[co] ??= {})[id] = value;
      else (s.regionalWeights[regKey] ??= {})[id] = value;
    }, { category: "PESO", action: "Alterou peso", entity: `${scope} · ${id}`, before: `${fmt(before)}%`, after: `${fmt(value)}%` });
  }
  function normalize() {
    if (!total) return;
    const next = items.map(i => ({ ...i, value: Math.round(i.value / total * 10000) / 100 }));
    const diff = Math.round((100 - sum(next.map(i => i.value))) * 100) / 100;
    next.sort((a, b) => b.value - a.value)[0].value = Math.round((next[0].value + diff) * 100) / 100;
    mutate(d => { const s = scnOf(d, scn.year); for (const i of next) { if (level === "companies") s.weights[weightView].companies[i.id] = i.value; else if (level === "segments") (s.weights[weightView].segments[co] ??= {})[i.id] = i.value; else (s.regionalWeights[regKey] ??= {})[i.id] = i.value; } },
      { category: "PESO", action: "Normalizou pesos", entity: scope, before: `Σ ${fmt(total)}%`, after: "Σ 100,00%" });
    notify("Pesos normalizados para 100%.");
  }

  return <div className="weights-layout"><section className="panel weights-editor">
    <div className="panel-head"><div><h2>Pesos · {scope}</h2><p>{level === "regionals" ? "Pesos entre regionais dentro da área (aba ÁREAS_REGIONAIS)." : `Conjunto da visão ${viewLabel} (aba PESOS) para ${scn.year}.`}</p></div><div className={`weight-total ${near100(total) ? "valid" : "invalid"}`}><span>SOMA</span><strong>{fmt(total, 2)}%</strong></div></div>
    <div className="weight-tools">
      <label>Nível<select value={level} onChange={e => setLevel(e.target.value as typeof level)}><option value="companies">Entre distribuidoras</option><option value="segments">Entre áreas da distribuidora</option><option value="regionals">Entre regionais da área</option></select></label>
      {level !== "regionals" && <label>Visão / recorte<select value={weightView} onChange={e => setWeightView(e.target.value as WeightView)}>{weightViews.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
      {level !== "companies" && <label>Distribuidora<select value={co} onChange={e => setCo(e.target.value)}>{db.org.companies.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}</select></label>}
      {level === "regionals" && <label>Área<select value={seg} onChange={e => setSeg(e.target.value)}>{db.org.segments.filter(s => s.active).map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>}
      {can.structure && <button onClick={normalize}>Normalizar 100%</button>}
    </div>
    <div className="weight-list"><div className="weight-row head"><span>Item</span><span>Peso</span><span>Participação</span><span>Efetivo</span></div>
      {items.map(i => <div className="weight-row" key={i.id}><div><strong>{i.label}</strong><small>{i.sub}</small></div><WeightInput value={i.value} disabled={!can.structure} onCommit={v => write(i.id, v, i.value)} /><div className="bar"><i style={{ width: `${total ? i.value / total * 100 : 0}%` }}></i></div><b>{total ? fmt(i.value / total * 100, 2) : "0,00"}%</b></div>)}
      {level === "regionals" && !items.length && <p className="hint">Sem regionais cadastradas para {companyName}.</p>}
    </div>
  </section>
  <aside className="weights-aside"><article><span>VALIDAÇÃO AUTOMÁTICA</span><h3>{near100(total) ? "Nível consistente" : "Ajuste necessário"}</h3><ul><li className={near100(total) ? "ok" : "bad"}>{near100(total) ? "✓" : "!"} Soma dos pesos em 100% (RN-07.1)</li><li className={items.every(i => i.value >= 0) ? "ok" : "bad"}>✓ Nenhum peso negativo</li><li className="ok">✓ Itens não apurados saem do rateio com renormalização</li></ul></article>
    <article><span>EFEITO NA CONSOLIDAÇÃO</span><h3>{meta?.name}</h3><div className="weight-tree"><b>Nota global · {viewLabel} <em>{calc?.global === null || !calc ? "—" : fmt(calc.global)}</em></b><i></i>{calc?.globalParts.slice(0, 4).map(p => <b key={p.co}>{p.co} · peso efetivo {fmt(p.eff * 100, 1)}% <em>{p.score === null ? "—" : fmt(p.score)}</em></b>)}</div><p className="hint">Recalculado a cada alteração de peso.</p></article></aside></div>;
}

function FormulasTab({ onEdit }: { onEdit: (ind: Indicator) => void }) {
  const { db, scn, can, values, month } = useTorre();
  const deps = scn.indicators.filter(i => i.kind === "DEPENDENTE");
  const [selected, setSelected] = useState(deps[0]?.code ?? "");
  const [co, setCo] = useState("MA");
  const ind = deps.find(i => i.code === selected) ?? deps[0];
  const order = calcOrder(scn.indicators);
  const cycle = findCycle(scn.indicators);
  const name = (code: string) => scn.indicators.find(i => i.code === code)?.name ?? "inexistente";
  return <div className="formula-layout"><section className="formula-catalog">{deps.map(f => <button className={ind?.code === f.code ? "active" : ""} key={f.code} onClick={() => setSelected(f.code)}><span className="formula-icon">ƒ</span><div><strong>{f.code} · {f.name}</strong><small>{formulaRefs(f).length} dependência(s) · ordem {order.indexOf(f.code) + 1 || "—"}</small></div><i className={f.active ? "on" : ""}></i></button>)}</section>
    <section className="panel formula-detail">{ind ? <>
      <div className="panel-head"><div><span className="rule-code">{ind.code}</span><h2>{ind.name}</h2><p>Calculado na mesma unidade organizacional e período das origens · régua padrão {ind.defaultRule}</p></div>{can.structure && <button className="row-action" onClick={() => onEdit(ind)}>Editar fórmula</button>}</div>
      <div className="expression-box"><span>REALIZADO</span><code>{ind.formulaActual}</code>{ind.formulaPlanned && <><span>PREVISTO</span><code>{ind.formulaPlanned}</code></>}</div>
      <h3>Dependências</h3><div className="dependency-flow">{formulaRefs(ind).map(r => <span key={r}>{r} · {name(r)}<b>→</b></span>)}<strong>{ind.code}</strong></div>
      <h3>Teste com valores reais · {db.org.companies.find(c => c.id === co)?.name}</h3>
      <label className="inline-select">Distribuidora<select value={co} onChange={e => setCo(e.target.value)}>{db.org.companies.map(c => <option key={c.id}>{c.id}</option>)}</select></label>
      <table className="mini-table"><thead><tr><th>Área</th><th>Origens (CHAVE → valor)</th><th>Previsto</th><th>Realizado</th></tr></thead><tbody>{ind.areas.map(seg => { const v = values.get(unitKey(ind.code, co, seg)); return <tr key={seg}><td>{seg}</td><td>{v?.trace?.map((t, i) => <small key={i}><code>{t.kind}[{t.code}]</code> {t.chave} → {t.value === null ? "—" : fmt(t.value)}</small>) ?? <small>Não aplicável</small>}</td><td>{v?.planned == null ? "—" : fmt(v.planned)}</td><td>{v?.actual == null ? "—" : fmt(v.actual)}</td></tr>; })}</tbody></table>
      <p className="hint">Período {month}/{scn.year}. Alterar um valor de origem recalcula o dependente automaticamente.</p>
    </> : <p className="hint">Nenhum indicador dependente cadastrado.</p>}</section>
    <aside className="panel simulator"><span>ORDEM DE CÁLCULO</span><h3>Grafo de dependências</h3>
      <ol className="calc-order">{scn.indicators.filter(i => i.kind === "BASE").length > 0 && <li><b>Bases</b> {scn.indicators.filter(i => i.kind === "BASE").map(i => i.code).join(", ")}</li>}{order.map(c => <li key={c}><b>{c}</b> ← {formulaRefs(scn.indicators.find(i => i.code === c)!).join(", ")}</li>)}</ol>
      <div className={cycle ? "form-error" : "ok-box"}>{cycle ? `Ciclo: ${cycle.join(" → ")}` : "✓ Nenhuma dependência circular"}</div>
      <small>Para testar o bloqueio de ciclos: edite o indicador 03 no catálogo, mude para “Dependente” e use <code>realizado[05] * 2</code>. O salvamento é recusado e o ciclo é exibido.</small>
    </aside></div>;
}
