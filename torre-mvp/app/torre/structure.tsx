"use client";

import { useState } from "react";
import { findCycle, findNode, findParent, fmt, indexes, leaves, near100, parseFormula, pathTo, sum } from "./engine";
import { useTorre } from "./store";
import type { DB, Indicator, Meta, Scenario, TreeNode } from "./types";
import { ValidationModal } from "./dashboard";
import { Empty, Guarded, Modal, PageTitle } from "./ui";

const metaOf = (d: DB, year: number, metaId: string) => d.scenarios.find(s => s.year === year)!.metas.find(m => m.id === metaId)!;
const uid = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function WeightInput({ value, disabled, onCommit, suffix = "%" }: { value: number; disabled?: boolean; onCommit: (v: number) => void; suffix?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { if (draft !== null && +draft !== value && Number.isFinite(+draft) && +draft >= 0) onCommit(+draft); setDraft(null); };
  if (disabled) return <b className="weight-static">{fmt(value, value % 1 ? 2 : 0)}{suffix}</b>;
  return <label className="weight-input"><input type="number" min="0" step="0.01" value={draft ?? value} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()} /><span>{suffix}</span></label>;
}

const SumBadge = ({ nodes }: { nodes: TreeNode[] }) => {
  const total = sum(nodes.map(n => n.weight));
  return <span className={near100(total) ? "valid" : "invalid-badge"}>{near100(total) ? "✓" : "!"} Σ {fmt(total, 2)}%</span>;
};

export function Structure() {
  const { db, scn, can, issues, mutate, notify, meta, setMetaId } = useTorre();
  const [tab, setTab] = useState<"arvore" | "catalogo" | "matriz">("arvore");
  const [modal, setModal] = useState<null | { type: "index" | "indicator"; parent: string | null } | { type: "move"; node: string } | { type: "meta"; meta: Meta | null } | { type: "replicate" } | { type: "history" } | { type: "validate" } | { type: "indicatorDef"; ind: Indicator | null }>(null);
  const structural = issues.filter(i => i.scope === "Estrutura" || i.scope === "Réguas" || i.scope === "Fórmulas");
  const lock = scn.status === "ENCERRADO" ? "Cenário encerrado: a estrutura histórica é preservada sem alterações." : "Cadastro estrutural restrito a administradores da Torre.";

  function updateMeta(fn: (m: Meta) => void, action: string, entity: string, before?: string, after?: string) {
    mutate(d => fn(metaOf(d, scn.year, meta.id)), { category: "ESTRUTURA", action, entity: `${meta.name} › ${entity}`, before, after });
  }

  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    if (node.kind === "INDICATOR") {
      const ind = scn.indicators.find(i => i.code === node.indicator);
      const usedIn = scn.metas.filter(m => leaves(m.children).some(l => l.indicator === node.indicator)).length;
      return <div className="tree-leaf" key={node.id}><i>{node.indicator}</i><div><strong>{ind?.name ?? "Indicador removido"}</strong><small>{ind?.kind === "DEPENDENTE" ? "Indicador dependente · fórmula configurada" : `Base · ${ind?.unit}`} · {usedIn > 1 ? `reutilizado em ${usedIn} metas` : "usado nesta meta"}</small></div>
        {can.structure ? <select className="rule-select" value={node.rule} onChange={e => { const v = e.target.value; updateMeta(m => { (findNode(m.children, node.id) as typeof node).rule = v; }, "Alterou régua do indicador", ind?.name ?? node.indicator, node.rule, v); }}>{scn.rules.filter(r => r.active || r.code === node.rule).map(r => <option key={r.code}>{r.code}</option>)}</select> : <span className="tag">{node.rule}</span>}
        <WeightInput value={node.weight} disabled={!can.structure} onCommit={v => updateMeta(m => { findNode(m.children, node.id)!.weight = v; }, "Alterou peso", ind?.name ?? node.indicator, `${fmt(node.weight)}%`, `${fmt(v)}%`)} />
        <span className="tag">{ind?.kind === "DEPENDENTE" ? "ƒ(x)" : "Base"}</span>
        {can.structure && <div className="node-actions"><button title="Mover" onClick={() => setModal({ type: "move", node: node.id })}>⇅</button><button title="Remover" onClick={() => updateMeta(m => { const p = findParent(m.children, node.id)!; p.splice(p.findIndex(x => x.id === node.id), 1); }, "Removeu indicador", ind?.name ?? node.indicator, `Peso ${fmt(node.weight)}%`)}>×</button></div>}
      </div>;
    }
    return <div className="branch" key={node.id}>
      <div className="tree-index"><i>{node.name[0]}</i><div><strong>{node.name}</strong><small>{node.description} · {node.children.length} filho(s)</small></div>
        <SumBadge nodes={node.children} />
        <WeightInput value={node.weight} disabled={!can.structure} onCommit={v => updateMeta(m => { findNode(m.children, node.id)!.weight = v; }, "Alterou peso", node.name, `${fmt(node.weight)}%`, `${fmt(v)}%`)} />
        {can.structure && <div className="node-actions"><button title="Adicionar índice filho" onClick={() => setModal({ type: "index", parent: node.id })}>＋◆</button><button title="Adicionar indicador" onClick={() => setModal({ type: "indicator", parent: node.id })}>＋•</button><button title="Mover" onClick={() => setModal({ type: "move", node: node.id })}>⇅</button><button title="Remover" onClick={() => updateMeta(m => { const p = findParent(m.children, node.id)!; p.splice(p.findIndex(x => x.id === node.id), 1); }, "Removeu índice", node.name, `${node.children.length} filho(s)`)}>×</button></div>}
      </div>
      {node.children.map(c => renderNode(c, depth + 1))}
    </div>;
  }

  const allIndexes = meta ? indexes(meta.children) : [];
  return <><PageTitle eyebrow="CONFIGURAÇÃO DO CENÁRIO" title="Estrutura de avaliação" desc="Metas, índices e indicadores em hierarquia ponderada, versionada por ano."
    actions={<><Guarded allowed={can.access} reason="Somente administradores replicam cenários." onClick={() => setModal({ type: "replicate" })}>⧉ Replicar ano</Guarded>
      <Guarded allowed={can.structure} reason={lock} className="primary" onClick={() => setModal({ type: "meta", meta: null })}>＋ Nova meta</Guarded></>} />
    <ScenarioStrip onHistory={() => setModal({ type: "history" })} />
    <div className="tabs"><button className={tab === "arvore" ? "active" : ""} onClick={() => setTab("arvore")}>Metas e árvore <b>{scn.metas.length}</b></button><button className={tab === "catalogo" ? "active" : ""} onClick={() => setTab("catalogo")}>Catálogo de indicadores <b>{scn.indicators.length}</b></button><button className={tab === "matriz" ? "active" : ""} onClick={() => setTab("matriz")}>Matriz de elegibilidade</button></div>
    {tab === "arvore" && (meta ? <div className="structure-layout"><section className="tree-panel">
      <div className="meta-tabs">{scn.metas.map(m => <button key={m.id} className={m.id === meta.id ? "active" : ""} onClick={() => setMetaId(m.id)}>{m.name}{!m.active && <em> · inativa</em>}</button>)}</div>
      <div className="panel-head"><div><h2>{meta.name}</h2><p>Cargos: {meta.roles.join(", ") || "—"} · Áreas: {meta.areas.map(a => db.org.segments.find(s => s.code === a)?.name ?? a).join(", ")}</p></div>
        <div className="row-gap"><SumBadge nodes={meta.children} />{can.structure && <button className="row-action" onClick={() => setModal({ type: "meta", meta })}>Editar meta</button>}</div></div>
      <div className="tree"><div className="tree-root"><i>◆</i><div><strong>Nota final · {meta.name}</strong><small>Σ(nota do índice × peso) · {db.org.companies.filter(c => c.active).length} distribuidoras</small></div><b>100%</b>{can.structure && <div className="node-actions"><button title="Adicionar índice" onClick={() => setModal({ type: "index", parent: null })}>＋◆</button><button title="Adicionar indicador direto na meta" onClick={() => setModal({ type: "indicator", parent: null })}>＋•</button></div>}</div>
        {meta.children.map(c => renderNode(c, 0))}
        {!meta.children.length && <Empty>Meta sem índices. Adicione o primeiro índice para compor a nota final.</Empty>}
      </div>
    </section><aside className="summary-panel"><span>RESUMO DO CENÁRIO</span><h3>Apuração {scn.year}</h3>
      <dl><div><dt>{scn.metas.filter(m => m.active).length}</dt><dd>Metas ativas</dd></div><div><dt>{allIndexes.length}</dt><dd>Índices na meta</dd></div><div><dt>{leaves(meta.children).length}</dt><dd>Indicadores na meta</dd></div><div><dt>{db.org.companies.filter(c => c.active).length}</dt><dd>Distribuidoras</dd></div><div><dt>{db.org.companies.filter(c => c.active).length * meta.areas.length}</dt><dd>Áreas executoras</dd></div><div><dt>{scn.indicators.filter(i => i.kind === "DEPENDENTE").length}</dt><dd>Dependentes</dd></div></dl>
      <hr /><span>VALIDAÇÕES</span>
      <ul>{structural.length ? structural.slice(0, 6).map((i, n) => <li key={n} className={i.level === "erro" ? "bad" : "warn"}>! {i.message}</li>) : <><li>✓ Pesos da meta e dos índices totalizam 100%</li><li>✓ Todos os indicadores têm régua ativa</li><li>✓ Nenhuma dependência circular</li></>}</ul>
      <button onClick={() => setModal({ type: "validate" })}>Executar validação completa</button></aside></div> : <Empty>Nenhuma meta no cenário.</Empty>)}
    {tab === "catalogo" && <Catalog onEdit={ind => setModal({ type: "indicatorDef", ind })} />}
    {tab === "matriz" && <Eligibility />}

    {modal?.type === "index" && <IndexModal onClose={() => setModal(null)} onSave={(name, description, weight) => { updateMeta(m => { const node: TreeNode = { id: uid(), kind: "INDEX", name, description, weight, children: [] }; if (modal.parent) (findNode(m.children, modal.parent) as Extract<TreeNode, { kind: "INDEX" }>).children.push(node); else m.children.push(node); }, "Criou índice", name, undefined, `Peso ${fmt(weight)}%`); notify("Índice criado. Ajuste os pesos para totalizar 100%."); setModal(null); }} />}
    {modal?.type === "indicator" && <LeafModal scn={scn} onClose={() => setModal(null)} onSave={(code, rule, weight) => { const ind = scn.indicators.find(i => i.code === code)!; updateMeta(m => { const node: TreeNode = { id: uid(), kind: "INDICATOR", indicator: code, rule, weight }; if (modal.parent) (findNode(m.children, modal.parent) as Extract<TreeNode, { kind: "INDEX" }>).children.push(node); else m.children.push(node); }, "Incluiu indicador", `${code} ${ind.name}`, undefined, `Peso ${fmt(weight)}% · régua ${rule}`); notify("Indicador vinculado reutilizando o cadastro base."); setModal(null); }} />}
    {modal?.type === "move" && <MoveModal meta={meta} nodeId={modal.node} onClose={() => setModal(null)} onMove={target => { const node = findNode(meta.children, modal.node)!; const label = node.kind === "INDEX" ? node.name : node.indicator; updateMeta(m => { const from = findParent(m.children, modal.node)!; const [n] = from.splice(from.findIndex(x => x.id === modal.node), 1); if (target) (findNode(m.children, target) as Extract<TreeNode, { kind: "INDEX" }>).children.push(n); else m.children.push(n); }, "Moveu item", label, pathTo(meta.children, modal.node)?.join(" › "), target ? pathTo(meta.children, target)?.join(" › ") : "Raiz da meta"); notify("Hierarquia reorganizada."); setModal(null); }} />}
    {modal?.type === "meta" && <MetaModal meta={modal.meta} onClose={() => setModal(null)} onSave={m => {
      const editing = modal.meta;
      mutate(d => { const s = d.scenarios.find(x => x.year === scn.year)!; if (editing) Object.assign(s.metas.find(x => x.id === editing.id)!, m); else s.metas.push({ ...m, id: `m-${Date.now().toString(36)}`, children: [] }); },
        { category: "ESTRUTURA", action: editing ? "Editou meta" : "Criou meta", entity: m.name, before: editing ? `${editing.roles.join(", ")} · ${editing.areas.join(", ")}${editing.active ? "" : " · inativa"}` : undefined, after: `${m.roles.join(", ")} · ${m.areas.join(", ")}${m.active ? "" : " · inativa"}` });
      notify(editing ? "Meta atualizada." : "Meta criada. Adicione os índices e pesos."); setModal(null);
    }} />}
    {modal?.type === "replicate" && <ReplicateModal onClose={() => setModal(null)} />}
    {modal?.type === "history" && <HistoryModal onClose={() => setModal(null)} />}
    {modal?.type === "validate" && <ValidationModal onClose={() => setModal(null)} />}
    {modal?.type === "indicatorDef" && <IndicatorModal ind={modal.ind} onClose={() => setModal(null)} />}
  </>;
}

function ScenarioStrip({ onHistory }: { onHistory: () => void }) {
  const { db, scn, can, mutate, notify, setMetaId, setMonth } = useTorre();
  const diff = (s: Scenario) => {
    const src = db.scenarios.find(x => x.year === s.createdFrom);
    if (!src) return null;
    const flat = (x: Scenario) => new Map(x.metas.flatMap(m => [...indexes(m.children), ...leaves(m.children)]).map(n => [n.id, JSON.stringify({ w: n.weight, r: n.kind === "INDICATOR" ? n.rule : "" })]));
    const a = flat(src), b = flat(s);
    let n = [...b].filter(([id, v]) => a.get(id) !== v).length + [...a.keys()].filter(id => !b.has(id)).length;
    n += s.rules.filter(r => { const o = src.rules.find(x => x.code === r.code); return !o || o.min !== r.min || o.target !== r.target || o.challenge !== r.challenge; }).length;
    n += s.indicators.filter(i => JSON.stringify(i) !== JSON.stringify(src.indicators.find(x => x.code === i.code))).length;
    return n;
  };
  const statusLabel = { ATIVO: "ATIVO", RASCUNHO: "RASCUNHO", ENCERRADO: "ENCERRADO" };
  return <div className="scenario-strip">
    {[...db.scenarios].sort((a, b) => a.year - b.year).map(s => { const d = diff(s); return <article key={s.year} className={s.year === scn.year ? "active" : ""} onClick={() => { mutate(x => { x.activeYear = s.year; }); setMetaId(""); setMonth(Math.max(1, ...Object.keys(db.entries).filter(k => k.startsWith(`${s.year}|`) && db.entries[k].actual !== null).map(k => +k.split("|")[1]))); }}>
      <span>{s.year}</span><div><strong>{s.status === "ATIVO" ? "Apuração vigente" : s.status === "RASCUNHO" ? "Cenário em preparação" : "Histórico preservado"}</strong><small>Versão {s.version}{s.createdFrom ? ` · origem ${s.createdFrom}` : ""}{d !== null ? ` · ${d} alteração(ões) vs ${s.createdFrom}` : ""}</small></div><b className={s.status.toLowerCase()}>{statusLabel[s.status]}</b>
    </article>; })}
    {scn.status === "RASCUNHO" && can.access && <button className="publish" onClick={() => { mutate(d => { const s = d.scenarios.find(x => x.year === scn.year)!; s.status = "ATIVO"; s.version += 1; s.publishedAt = new Date().toISOString(); }, { category: "CENARIO", action: "Publicou cenário", entity: `Cenário ${scn.year}`, before: `Rascunho v${scn.version}`, after: `Ativo v${scn.version + 1}` }); notify(`Cenário ${scn.year} publicado.`); }}>Publicar {scn.year} →</button>}
    <button onClick={onHistory}>Histórico de versões →</button>
  </div>;
}

function IndexModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, description: string, weight: number) => void }) {
  const [name, setName] = useState(""), [description, setDescription] = useState(""), [weight, setWeight] = useState(0);
  return <Modal eyebrow="NOVO ÍNDICE" title="Adicionar índice" subtitle="Um índice pode conter outros índices e/ou indicadores." onClose={onClose} actions={<><button onClick={onClose}>Cancelar</button><button className="primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), description.trim(), weight)}>Adicionar</button></>}>
    <div className="engine-form"><label className="span-2">Nome<input autoFocus value={name} onChange={e => setName(e.target.value)} /></label><label>Peso no pai (%)<input type="number" value={weight} onChange={e => setWeight(+e.target.value)} /></label><label className="span-3">Descrição<input value={description} onChange={e => setDescription(e.target.value)} /></label></div>
  </Modal>;
}

function LeafModal({ scn, onClose, onSave }: { scn: Scenario; onClose: () => void; onSave: (code: string, rule: string, weight: number) => void }) {
  const active = scn.indicators.filter(i => i.active);
  const [code, setCode] = useState(active[0]?.code ?? ""), [rule, setRule] = useState(active[0]?.defaultRule ?? ""), [weight, setWeight] = useState(0);
  return <Modal eyebrow="VINCULAR INDICADOR" title="Adicionar indicador ao índice" subtitle="O indicador é reutilizado do catálogo: peso e régua valem apenas neste contexto." onClose={onClose} actions={<><button onClick={onClose}>Cancelar</button><button className="primary" disabled={!code || !rule} onClick={() => onSave(code, rule, weight)}>Vincular</button></>}>
    <div className="engine-form"><label className="span-3">Indicador do catálogo<select value={code} onChange={e => { setCode(e.target.value); setRule(scn.indicators.find(i => i.code === e.target.value)?.defaultRule ?? rule); }}>{active.map(i => <option key={i.code} value={i.code}>{i.code} · {i.name}{i.kind === "DEPENDENTE" ? " (dependente)" : ""}</option>)}</select></label>
      <label className="span-2">Régua neste contexto<select value={rule} onChange={e => setRule(e.target.value)}>{scn.rules.filter(r => r.active).map(r => <option key={r.code} value={r.code}>{r.code} · {r.name}</option>)}</select></label><label>Peso no índice (%)<input type="number" value={weight} onChange={e => setWeight(+e.target.value)} /></label></div>
  </Modal>;
}

function MoveModal({ meta, nodeId, onClose, onMove }: { meta: Meta; nodeId: string; onClose: () => void; onMove: (target: string | null) => void }) {
  const [target, setTarget] = useState<string>("");
  const node = findNode(meta.children, nodeId)!;
  const descendant = target && node.kind === "INDEX" && (target === nodeId || !!findNode(node.children, target));
  const cycle = descendant ? [...(pathTo(meta.children, target) ?? []), node.kind === "INDEX" ? node.name : ""].join(" → ") : "";
  return <Modal eyebrow="REORGANIZAR HIERARQUIA" title={`Mover ${node.kind === "INDEX" ? node.name : node.indicator}`} subtitle="O sistema impede referências que gerem ciclos na árvore (RN-02.2)." onClose={onClose}
    actions={<><button onClick={onClose}>Cancelar</button><button className="primary" disabled={!!descendant} onClick={() => onMove(target || null)}>Mover</button></>}>
    <div className="engine-form"><label className="span-3">Novo pai<select value={target} onChange={e => setTarget(e.target.value)}><option value="">Raiz da meta</option>{indexes(meta.children).map(i => <option key={i.id} value={i.id}>{pathTo(meta.children, i.id)?.join(" › ")}</option>)}</select></label></div>
    {descendant && <div className="form-error">Ciclo detectado: {cycle}. Um índice não pode ser filho de si mesmo ou de um descendente.</div>}
  </Modal>;
}

function MetaModal({ meta, onClose, onSave }: { meta: Meta | null; onClose: () => void; onSave: (m: Omit<Meta, "id" | "children">) => void }) {
  const { db, scn } = useTorre();
  const [name, setName] = useState(meta?.name ?? `Nova meta ${scn.year}`);
  const [roles, setRoles] = useState(meta?.roles.join(", ") ?? "");
  const [areas, setAreas] = useState<string[]>(meta?.areas ?? []);
  const [active, setActive] = useState(meta?.active ?? true);
  return <Modal eyebrow="CADASTRO DE META" title={meta ? "Editar meta" : "Nova meta"} subtitle={`Ano de vigência ${scn.year}. A composição (índices e pesos) é feita na árvore.`} onClose={onClose}
    actions={<><button onClick={onClose}>Cancelar</button><button className="primary" disabled={!name.trim() || !areas.length} onClick={() => onSave({ name: name.trim(), roles: roles.split(",").map(x => x.trim()).filter(Boolean), areas, active })}>Salvar meta</button></>}>
    <div className="engine-form"><label className="span-2">Nome<input value={name} onChange={e => setName(e.target.value)} /></label><label>Situação<select value={active ? "1" : "0"} onChange={e => setActive(e.target.value === "1")}><option value="1">Ativa</option><option value="0">Inativa</option></select></label>
      <label className="span-3">Cargos vinculados (separados por vírgula)<input value={roles} onChange={e => setRoles(e.target.value)} placeholder="Diretores, Gerentes" /></label>
      <fieldset className="span-3 checks-grid"><legend>Áreas executoras</legend>{db.org.segments.filter(s => s.active || areas.includes(s.code)).map(s => <label key={s.code}><input type="checkbox" checked={areas.includes(s.code)} disabled={!s.active && !areas.includes(s.code)} onChange={e => setAreas(e.target.checked ? [...areas, s.code] : areas.filter(a => a !== s.code))} />{s.name}{!s.active && " (inativa)"}</label>)}</fieldset></div>
  </Modal>;
}

function Catalog({ onEdit }: { onEdit: (ind: Indicator | null) => void }) {
  const { db, scn, can } = useTorre();
  const name = (id: string) => db.users.find(u => u.id === id)?.name ?? "—";
  return <section className="table-panel"><div className="toolbar"><span className="hint">Cadastro base único: o mesmo indicador pode ser usado em várias metas com pesos e réguas diferentes.</span><span className="spacer" /><Guarded allowed={can.structure} reason="Cadastro restrito a administradores." className="primary" onClick={() => onEdit(null)}>＋ Novo indicador</Guarded></div>
    <div className="table-scroll"><table><thead><tr><th>Indicador</th><th>Tipo</th><th>Áreas executoras</th><th>Régua padrão</th><th>Responsável · apuradores</th><th>Prazo</th><th>Ponderação</th><th>Uso</th><th></th></tr></thead>
      <tbody>{scn.indicators.map(i => { const used = scn.metas.filter(m => leaves(m.children).some(l => l.indicator === i.code)); return <tr key={i.code} className={i.active ? "" : "row-muted"}>
        <td><div className="cell-ind"><span className="code">{i.code}</span><div><strong>{i.name}</strong><small>{i.unit}{i.piDetail ? " · detalha por PI" : ""}{i.active ? "" : " · inativo"}</small></div></div></td>
        <td>{i.kind === "DEPENDENTE" ? <><span className="tag">ƒ(x)</span><small><code>{i.formulaActual}</code></small></> : "Base"}</td>
        <td>{i.areas.map(a => db.org.segments.find(s => s.code === a)?.name ?? a).join(", ")}</td><td>{i.defaultRule}</td>
        <td><strong>{name(i.ownerId)}</strong><small>{i.apuradorIds.map(name).join(", ") || "—"}</small></td><td>Dia {i.deadlineDay} do mês seguinte</td>
        <td>{i.areaWeighting === "VALOR_REFERENCIA" ? "Valor de referência (VR)" : "Peso do segmento"}</td><td>{used.length ? used.map(m => m.name.replace(/ \d{4}$/, "")).join(", ") : "—"}</td>
        <td>{can.structure ? <button className="row-action" onClick={() => onEdit(i)}>Editar</button> : null}</td>
      </tr>; })}</tbody></table></div></section>;
}

export function IndicatorModal({ ind, preset, onClose }: { ind: Indicator | null; preset?: Partial<Indicator>; onClose: () => void }) {
  const { db, scn, mutate, notify } = useTorre();
  const [draft, setDraft] = useState<Indicator>(ind ?? { code: "", name: "", unit: "%", areas: [], kind: "BASE", defaultRule: scn.rules[0]?.code ?? "", ownerId: db.users[0].id, apuradorIds: [], deadlineDay: 5, areaWeighting: "SEGMENTO", piDetail: false, active: true, ...preset });
  const set = (p: Partial<Indicator>) => setDraft({ ...draft, ...p });
  const isNew = !ind;
  let error = "";
  if (!draft.code.trim() || !draft.name.trim()) error = "Código e nome são obrigatórios.";
  else if (isNew && scn.indicators.some(i => i.code === draft.code)) error = `Já existe o indicador ${draft.code}.`;
  else if (!draft.areas.length) error = "Selecione ao menos uma área executora.";
  else if (draft.kind === "DEPENDENTE") {
    try {
      const refs = [...parseFormula(draft.formulaActual ?? "").refs, ...(draft.formulaPlanned?.trim() ? parseFormula(draft.formulaPlanned).refs : [])];
      const missing = refs.find(r => r.code !== draft.code && !scn.indicators.some(i => i.code === r.code));
      if (missing) error = `A fórmula referencia o indicador ${missing.code}, que não existe.`;
      const cycle = findCycle([...scn.indicators.filter(i => i.code !== draft.code), draft]);
      if (cycle) error = `Dependência circular detectada: ${cycle.join(" → ")}. O salvamento foi bloqueado.`;
    } catch (e) { error = `Fórmula inválida: ${(e as Error).message}`; }
  }
  function save() {
    mutate(d => { const s = d.scenarios.find(x => x.year === scn.year)!; const i = s.indicators.findIndex(x => x.code === draft.code); if (i >= 0) s.indicators[i] = draft; else s.indicators.push(draft); },
      { category: "ESTRUTURA", action: isNew ? "Criou indicador" : "Editou indicador", entity: `${draft.code} ${draft.name}`, before: ind ? (ind.kind === "DEPENDENTE" ? ind.formulaActual : `${ind.areas.join(", ")} · ${ind.defaultRule}`) : undefined, after: draft.kind === "DEPENDENTE" ? draft.formulaActual : `${draft.areas.join(", ")} · ${draft.defaultRule}` });
    notify(isNew ? "Indicador criado no catálogo." : "Indicador atualizado; notas recalculadas."); onClose();
  }
  const users = db.users.filter(u => u.active && (u.role === "APURADOR" || u.role === "ADMIN"));
  return <Modal wide eyebrow="CATÁLOGO DE INDICADORES" title={isNew ? "Novo indicador" : `${draft.code} · ${draft.name}`} subtitle="Fórmulas aceitam realizado[CÓDIGO], previsto[CÓDIGO], números, + − × ÷, parênteses, MIN, MAX e ABS." onClose={onClose}
    actions={<><button onClick={onClose}>Cancelar</button><button className="primary" disabled={!!error} onClick={save}>Salvar indicador</button></>}>
    <div className="engine-form">
      <label>Código<input value={draft.code} disabled={!isNew} onChange={e => set({ code: e.target.value.toUpperCase().replace(/\s/g, "") })} /></label>
      <label className="span-2">Nome<input value={draft.name} onChange={e => set({ name: e.target.value })} /></label>
      <label>Tipo<select value={draft.kind} onChange={e => set({ kind: e.target.value as Indicator["kind"], formulaActual: draft.formulaActual ?? "", formulaPlanned: draft.formulaPlanned ?? "" })}><option value="BASE">Base (valor lançado)</option><option value="DEPENDENTE">Dependente (fórmula)</option></select></label>
      <label>Unidade<input value={draft.unit} onChange={e => set({ unit: e.target.value })} /></label>
      <label>Régua padrão<select value={draft.defaultRule} onChange={e => set({ defaultRule: e.target.value })}>{scn.rules.filter(r => r.active).map(r => <option key={r.code}>{r.code}</option>)}</select></label>
      {draft.kind === "DEPENDENTE" && <><label className="span-3">Fórmula do realizado<input className="mono" value={draft.formulaActual ?? ""} onChange={e => set({ formulaActual: e.target.value })} placeholder="realizado[04] / realizado[03] * 100" /></label>
        <label className="span-3">Fórmula do previsto (opcional)<input className="mono" value={draft.formulaPlanned ?? ""} onChange={e => set({ formulaPlanned: e.target.value })} placeholder="previsto[04] / previsto[03] * 100" /></label></>}
      <fieldset className="span-3 checks-grid"><legend>Áreas executoras</legend>{db.org.segments.filter(s => s.active || draft.areas.includes(s.code)).map(s => <label key={s.code}><input type="checkbox" checked={draft.areas.includes(s.code)} disabled={!s.active && !draft.areas.includes(s.code)} onChange={e => set({ areas: e.target.checked ? [...draft.areas, s.code] : draft.areas.filter(a => a !== s.code) })} />{s.name}</label>)}</fieldset>
      <label>Responsável técnico<select value={draft.ownerId} onChange={e => set({ ownerId: e.target.value })}>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <label>Prazo (dia do mês seguinte)<input type="number" min="1" max="28" value={draft.deadlineDay} onChange={e => set({ deadlineDay: Math.min(28, Math.max(1, +e.target.value)) })} /></label>
      <label>Ponderação entre áreas<select value={draft.areaWeighting} onChange={e => set({ areaWeighting: e.target.value as Indicator["areaWeighting"] })}><option value="SEGMENTO">Peso do segmento</option><option value="VALOR_REFERENCIA">Critério financeiro (VR)</option></select></label>
      <fieldset className="span-3 checks-grid"><legend>Apuradores</legend>{users.map(u => <label key={u.id}><input type="checkbox" checked={draft.apuradorIds.includes(u.id)} onChange={e => set({ apuradorIds: e.target.checked ? [...draft.apuradorIds, u.id] : draft.apuradorIds.filter(x => x !== u.id) })} />{u.name}</label>)}</fieldset>
      <label className="inline-check"><input type="checkbox" checked={draft.piDetail} onChange={e => set({ piDetail: e.target.checked })} />Detalhar por Projeto de Investimento (PI)</label>
      <label className="inline-check"><input type="checkbox" checked={draft.active} onChange={e => set({ active: e.target.checked })} />Indicador ativo</label>
    </div>
    {error && <div className="form-error">{error}</div>}
  </Modal>;
}

function Eligibility() {
  const { db, scn, can, mutate } = useTorre();
  const companies = db.org.companies.filter(c => c.active);
  return <section className="panel matrix-panel"><div className="panel-head"><div><h2>Matriz de preenchimento</h2><p>Indicador × distribuidora (aba PREENCHIMENTO). Não aplicável: sai do rateio e os pesos dos demais são renormalizados.</p></div></div>
    <div className="table-scroll"><table className="matrix"><thead><tr><th>Indicador</th>{companies.map(c => <th key={c.id}>{c.id}</th>)}</tr></thead>
      <tbody>{scn.indicators.filter(i => i.active).map(i => <tr key={i.code}><td><strong>{i.code} · {i.name}</strong></td>{companies.map(c => { const on = scn.eligibility[`${i.code}|${c.id}`] !== false; return <td key={c.id}><button className={`elig ${on ? "on" : "off"}`} disabled={!can.structure} title={on ? "Aplicável" : "Não aplicável"}
        onClick={() => mutate(d => { const s = d.scenarios.find(x => x.year === scn.year)!; if (on) s.eligibility[`${i.code}|${c.id}`] = false; else delete s.eligibility[`${i.code}|${c.id}`]; }, { category: "ESTRUTURA", action: "Alterou elegibilidade", entity: `${i.code} ${i.name} · ${c.id}`, before: on ? "Aplicável" : "Não aplicável", after: on ? "Não aplicável" : "Aplicável" })}>{on ? "✓" : "NA"}</button></td>; })}</tr>)}</tbody></table></div></section>;
}

function ReplicateModal({ onClose }: { onClose: () => void }) {
  const { db, mutate, notify, setMetaId, setMonth } = useTorre();
  const years = db.scenarios.map(s => s.year).sort();
  const [source, setSource] = useState(years[years.length - 1]);
  const [target, setTarget] = useState(years[years.length - 1] + 1);
  const [curves, setCurves] = useState(true);
  const exists = db.scenarios.some(s => s.year === target);
  function run() {
    mutate(d => {
      const src = d.scenarios.find(s => s.year === source)!;
      const copy = structuredClone(src);
      const swap = (s: string) => s.replaceAll(String(source), String(target));
      const shift = (date: string) => `${+date.slice(0, 4) + (target - source)}${date.slice(4)}`;
      Object.assign(copy, { year: target, status: "RASCUNHO", version: 1, createdFrom: source, publishedAt: null, closedMonths: [] });
      copy.metas.forEach(m => { m.id = swap(m.id); m.name = swap(m.name); });
      copy.rules.forEach(r => { r.history = [{ at: new Date().toISOString(), by: d.users.find(u => u.id === d.currentUserId)!.name, summary: `Replicada do cenário ${source}` }]; });
      copy.events = copy.events.map(e => ({ ...e, id: swap(e.id), date: shift(e.date) }));
      d.scenarios.push(copy);
      if (curves) for (const [k, e] of Object.entries(d.entries)) {
        const [y, ...rest] = k.split("|");
        if (+y === source && e.planned !== null) d.entries[[target, ...rest].join("|")] = { planned: e.planned, actual: null, deliveredOn: null };
      }
      d.activeYear = target;
    }, { category: "CENARIO", action: "Replicou cenário", entity: `${source} → ${target}`, after: `Rascunho v1${curves ? " · curvas de previsto copiadas" : ""}` });
    setMetaId(""); setMonth(1);
    notify(`Cenário ${target} criado como rascunho. Alterações não afetam ${source}.`); onClose();
  }
  return <Modal eyebrow="FLEXIBILIDADE POR ANO" title="Replicar estrutura de um ano" subtitle="Copia metas, índices, indicadores, réguas, áreas, pesos, elegibilidade e calendário como ponto de partida." onClose={onClose}
    actions={<><button onClick={onClose}>Cancelar</button><button className="primary" disabled={exists} onClick={run}>Criar cenário {target}</button></>}>
    <div className="engine-form"><label>Ano de origem<select value={source} onChange={e => setSource(+e.target.value)}>{years.map(y => <option key={y}>{y}</option>)}</select></label><label>Novo ano<input type="number" value={target} onChange={e => setTarget(+e.target.value)} /></label>
      <label className="inline-check span-3"><input type="checkbox" checked={curves} onChange={e => setCurves(e.target.checked)} />Copiar curvas de previsto como carga inicial (realizados ficam em branco)</label></div>
    {exists && <div className="form-error">Já existe um cenário para {target}.</div>}
  </Modal>;
}

function HistoryModal({ onClose }: { onClose: () => void }) {
  const { db, scn } = useTorre();
  const events = db.audit.filter(a => a.year === scn.year && ["CENARIO", "ESTRUTURA", "REGUA", "PESO"].includes(a.category));
  return <Modal wide eyebrow="VERSIONAMENTO" title={`Histórico do cenário ${scn.year}`} subtitle={`Versão atual ${scn.version}${scn.publishedAt ? ` · publicada em ${new Date(scn.publishedAt).toLocaleDateString("pt-BR")}` : " · rascunho"}`} onClose={onClose}>
    <div className="table-scroll short"><table className="mini-table"><thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Objeto</th><th>Antes → depois</th></tr></thead>
      <tbody>{events.map(e => <tr key={e.id}><td>{new Date(e.at).toLocaleString("pt-BR")}</td><td>{e.userName}</td><td><span className="audit-action">{e.action}</span></td><td>{e.entity}</td><td><code>{e.before ?? ""}{e.before || e.after ? " → " : ""}{e.after ?? ""}</code></td></tr>)}</tbody></table>
      {!events.length && <Empty>Nenhuma alteração estrutural registrada.</Empty>}</div>
  </Modal>;
}
