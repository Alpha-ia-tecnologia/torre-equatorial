import type { DB, Entry, Indicator, Meta, Rule, RuleParams, Scenario, TreeNode, View, WeightView } from "./types";

export const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export const weightViews: [WeightView, string][] = [["ELEGIVEL", "Torre Elegível"], ["ENGENHARIA", "Direção Engenharia"], ["OBRAS", "Direção Obras"], ["SUPER", "Superintendências"]];

export const fmt = (n: number, d = 2) => n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });
export const fmtDate = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
export const pad = (n: number) => String(n).padStart(2, "0");
export const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
export const near100 = (n: number) => Math.abs(n - 100) < 0.02;

export const entryKey = (year: number, month: number, ind: string, co: string, seg: string) => `${year}|${month}|${ind}|${co}|${seg}`;

/** CHAVE_INDICADOR: unidade organizacional (empresa.segmento.regional) | período | indicador. */
export const chave = (co: string, seg: string, year: number, month: number, ind: string) => `${co}.${seg}.00|${year}-${pad(month)}|${ind}`;
export function parseChave(raw: string) {
  const m = raw.trim().toUpperCase().match(/^([A-Z0-9]+)\.([A-Z0-9]+)\.([0-9]{2})\|(\d{4})-(\d{2})\|([A-Z0-9_-]+)$/);
  if (!m) return null;
  return { company: m[1], segment: m[2], regional: m[3], year: +m[4], month: +m[5], indicator: m[6] };
}

export const isEligible = (scn: Scenario, ind: string, co: string) => scn.eligibility[`${ind}|${co}`] !== false;

export function deadlineFor(ind: Indicator, year: number, month: number) {
  const y = month === 12 ? year + 1 : year, m = month === 12 ? 1 : month + 1;
  return `${y}-${pad(m)}-${pad(ind.deadlineDay)}`;
}
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
}

// ─── Réguas ────────────────────────────────────────────────────────────────

export const ruleParams = (rule: Rule, co?: string): RuleParams => (co && rule.overrides[co]) || rule;

export function validRuleParams(polarity: Rule["polarity"], p: RuleParams) {
  return polarity === "MAIOR" ? p.min < p.target && p.target < p.challenge : p.min > p.target && p.target > p.challenge;
}

export function resultOf(planned: number | null, actual: number | null, rule: Rule) {
  if (actual === null) return null;
  if (rule.base === "VALOR") return actual;
  if (!planned) return null;
  return actual / planned * 100;
}

/** Interpolação linear por trecho: mínimo → 1, meta → 10, desafio → 15, respeitando a polaridade. */
export function scoreOf(result: number | null, rule: Rule, p: RuleParams = rule) {
  if (result === null || !Number.isFinite(result)) return null;
  const dir = rule.polarity === "MAIOR" ? 1 : -1;
  const pos = (x: number) => x * dir;
  const r = pos(result), min = pos(p.min), target = pos(p.target), challenge = pos(p.challenge);
  if (r < min) return rule.floor;
  if (r <= target) return 1 + (r - min) * 9 / (target - min);
  if (r <= challenge || rule.ceiling === "EXTRAPOLAR") return 10 + (r - target) * 5 / (challenge - target);
  return 15;
}

// ─── Fórmulas de indicadores dependentes ────────────────────────────────────

export type Ast =
  | { t: "num"; v: number }
  | { t: "ref"; kind: "realizado" | "previsto"; code: string }
  | { t: "neg"; a: Ast }
  | { t: "bin"; op: "+" | "-" | "*" | "/"; a: Ast; b: Ast }
  | { t: "fn"; name: "MIN" | "MAX" | "ABS"; args: Ast[] };
export type FormulaRef = { kind: "realizado" | "previsto"; code: string };
export class FormulaError extends Error {}

type Token = { t: "num"; v: number } | { t: "id"; v: string } | { t: "code"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/\d/.test(c) || (c === "." && /\d/.test(src[i + 1] ?? ""))) {
      const m = src.slice(i).match(/^\d*\.?\d+/)!;
      out.push({ t: "num", v: parseFloat(m[0]) }); i += m[0].length; continue;
    }
    if (/[A-Za-zÀ-ú_]/.test(c)) {
      const m = src.slice(i).match(/^[A-Za-zÀ-ú_]+/)!;
      out.push({ t: "id", v: m[0] }); i += m[0].length; continue;
    }
    if (c === "[") {
      const end = src.indexOf("]", i);
      if (end < 0) throw new FormulaError("Colchete sem fechamento: use realizado[CÓDIGO].");
      const code = src.slice(i + 1, end).trim().toUpperCase();
      if (!/^[A-Z0-9_-]+$/.test(code)) throw new FormulaError(`Código de indicador inválido: "${code}".`);
      out.push({ t: "code", v: code }); i = end + 1; continue;
    }
    if ("+-*/(),;".includes(c)) { out.push({ t: "op", v: c === ";" ? "," : c }); i++; continue; }
    throw new FormulaError(`Caractere inesperado "${c}" na posição ${i + 1}.`);
  }
  return out;
}

export function parseFormula(src: string): { ast: Ast; refs: FormulaRef[] } {
  const tokens = tokenize(src);
  const refs: FormulaRef[] = [];
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  const expect = (v: string) => { if (!isOp(v)) throw new FormulaError(`Era esperado "${v}".`); p++; };

  function expr(): Ast {
    let a = term();
    while (isOp("+") || isOp("-")) { const op = (tokens[p++] as { v: "+" | "-" }).v; a = { t: "bin", op, a, b: term() }; }
    return a;
  }
  function term(): Ast {
    let a = factor();
    while (isOp("*") || isOp("/")) { const op = (tokens[p++] as { v: "*" | "/" }).v; a = { t: "bin", op, a, b: factor() }; }
    return a;
  }
  function factor(): Ast {
    const tk = peek();
    if (!tk) throw new FormulaError("Expressão incompleta.");
    if (isOp("-")) { p++; return { t: "neg", a: factor() }; }
    if (isOp("(")) { p++; const a = expr(); expect(")"); return a; }
    if (tk.t === "num") { p++; return { t: "num", v: tk.v }; }
    if (tk.t === "id") {
      p++;
      const name = tk.v.toLowerCase();
      if (name === "realizado" || name === "previsto") {
        const code = peek();
        if (code?.t !== "code") throw new FormulaError(`Informe o indicador: ${name}[CÓDIGO].`);
        p++;
        refs.push({ kind: name, code: code.v });
        return { t: "ref", kind: name, code: code.v };
      }
      const fn = tk.v.toUpperCase();
      if (fn === "MIN" || fn === "MAX" || fn === "ABS") {
        expect("(");
        const args = [expr()];
        while (isOp(",")) { p++; args.push(expr()); }
        expect(")");
        if (fn === "ABS" && args.length !== 1) throw new FormulaError("ABS recebe um argumento.");
        return { t: "fn", name: fn, args };
      }
      throw new FormulaError(`Identificador desconhecido "${tk.v}". Use realizado[X], previsto[X], MIN, MAX ou ABS.`);
    }
    throw new FormulaError("Expressão inválida.");
  }

  if (!tokens.length) throw new FormulaError("A fórmula está vazia.");
  const ast = expr();
  if (p < tokens.length) throw new FormulaError("Há termos sobrando no fim da expressão.");
  return { ast, refs };
}

export function evalAst(ast: Ast, resolve: (ref: FormulaRef) => number | null): number | null {
  switch (ast.t) {
    case "num": return ast.v;
    case "ref": return resolve(ast);
    case "neg": { const a = evalAst(ast.a, resolve); return a === null ? null : -a; }
    case "bin": {
      const a = evalAst(ast.a, resolve), b = evalAst(ast.b, resolve);
      if (a === null || b === null) return null;
      if (ast.op === "/") return b === 0 ? null : a / b;
      return ast.op === "+" ? a + b : ast.op === "-" ? a - b : a * b;
    }
    case "fn": {
      const args = ast.args.map(x => evalAst(x, resolve));
      if (args.some(x => x === null)) return null;
      const xs = args as number[];
      return ast.name === "ABS" ? Math.abs(xs[0]) : ast.name === "MIN" ? Math.min(...xs) : Math.max(...xs);
    }
  }
}

export function formulaRefs(ind: Indicator) {
  if (ind.kind !== "DEPENDENTE") return [];
  const refs: string[] = [];
  for (const f of [ind.formulaActual, ind.formulaPlanned]) {
    if (!f?.trim()) continue;
    try { refs.push(...parseFormula(f).refs.map(r => r.code)); } catch { /* erro reportado na validação */ }
  }
  return [...new Set(refs)];
}

/** Retorna o primeiro ciclo encontrado no grafo de dependências, ex.: ["05", "03", "05"]. */
export function findCycle(indicators: Indicator[]): string[] | null {
  const graph = new Map(indicators.map(i => [i.code, formulaRefs(i)]));
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  function visit(code: string): string[] | null {
    state.set(code, 1); stack.push(code);
    for (const dep of graph.get(code) ?? []) {
      if (state.get(dep) === 1) return [...stack.slice(stack.indexOf(dep)), dep];
      if (!state.has(dep) && graph.has(dep)) { const c = visit(dep); if (c) return c; }
    }
    stack.pop(); state.set(code, 2);
    return null;
  }
  for (const code of graph.keys()) if (!state.has(code)) { const c = visit(code); if (c) return c; }
  return null;
}

/** Ordem topológica de cálculo: origens antes dos dependentes. Indicadores em ciclo ficam de fora. */
export function calcOrder(indicators: Indicator[]) {
  const deps = new Map(indicators.filter(i => i.kind === "DEPENDENTE").map(i => [i.code, formulaRefs(i)]));
  const done = new Set(indicators.filter(i => i.kind === "BASE").map(i => i.code));
  const order: string[] = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const [code, refs] of deps) {
      if (done.has(code) || !refs.every(r => done.has(r))) continue;
      done.add(code); order.push(code); progressed = true;
    }
  }
  return order;
}

// ─── Valores do período ─────────────────────────────────────────────────────

export type SourceTrace = { kind: "realizado" | "previsto"; code: string; chave: string; value: number | null };
export type UnitValue = {
  ind: string; co: string; seg: string; chave: string;
  planned: number | null; actual: number | null; entry?: Entry; trace?: SourceTrace[]; formulaError?: string;
};
export type PeriodValues = Map<string, UnitValue>;
export const unitKey = (ind: string, co: string, seg: string) => `${ind}|${co}|${seg}`;

export function computePeriod(db: DB, scn: Scenario, month: number): PeriodValues {
  const values: PeriodValues = new Map();
  const companies = db.org.companies;
  const year = scn.year;
  for (const ind of scn.indicators) {
    if (ind.kind !== "BASE" || !ind.active) continue;
    for (const co of companies) {
      if (!isEligible(scn, ind.code, co.id)) continue;
      for (const seg of ind.areas) {
        const entry = db.entries[entryKey(year, month, ind.code, co.id, seg)];
        if (!entry && !co.active) continue;
        values.set(unitKey(ind.code, co.id, seg), { ind: ind.code, co: co.id, seg, chave: chave(co.id, seg, year, month, ind.code), planned: entry?.planned ?? null, actual: entry?.actual ?? null, entry });
      }
    }
  }
  const byCode = new Map(scn.indicators.map(i => [i.code, i]));
  for (const code of calcOrder(scn.indicators)) {
    const ind = byCode.get(code)!;
    if (!ind.active) continue;
    let actualAst: Ast | null = null, plannedAst: Ast | null = null, error: string | undefined;
    try {
      actualAst = parseFormula(ind.formulaActual ?? "").ast;
      plannedAst = ind.formulaPlanned?.trim() ? parseFormula(ind.formulaPlanned).ast : null;
    } catch (e) { error = (e as Error).message; }
    for (const co of companies) {
      if (!isEligible(scn, code, co.id) || !co.active) continue;
      for (const seg of ind.areas) {
        const trace: SourceTrace[] = [];
        const resolve = (ref: FormulaRef) => {
          const src = byCode.get(ref.code);
          const pick = (v: UnitValue | undefined) => v ? (ref.kind === "realizado" ? v.actual : v.planned) : null;
          let value: number | null = null;
          const same = values.get(unitKey(ref.code, co.id, seg));
          if (same) value = pick(same);
          else if (src) {
            const parts = src.areas.map(s => pick(values.get(unitKey(ref.code, co.id, s)))).filter((x): x is number => x !== null);
            value = parts.length ? sum(parts) : null;
          }
          trace.push({ kind: ref.kind, code: ref.code, chave: chave(co.id, same ? seg : "*", year, month, ref.code), value });
          return value;
        };
        const actual = actualAst ? evalAst(actualAst, resolve) : null;
        const planned = plannedAst ? evalAst(plannedAst, resolve) : null;
        values.set(unitKey(code, co.id, seg), { ind: code, co: co.id, seg, chave: chave(co.id, seg, year, month, code), planned, actual, trace, formulaError: error });
      }
    }
  }
  return values;
}

export function unitScore(v: UnitValue | undefined, rule: Rule | undefined) {
  if (!v || !rule) return { result: null, score: null };
  const params = ruleParams(rule, v.co);
  const result = resultOf(v.planned, v.actual, rule);
  return { result, score: scoreOf(result, rule, params) };
}

// ─── Consolidação ───────────────────────────────────────────────────────────

export type CalcPart = { label: string; score: number | null; weight: number; eff: number };
export type NodeCalc = {
  id: string; kind: "META" | "INDEX" | "INDICATOR"; label: string; weight: number; score: number | null;
  eff: number; children: NodeCalc[]; areas?: (CalcPart & { seg: string; value?: UnitValue; result: number | null })[];
  indicator?: string; rule?: string; na?: boolean;
};
export type MetaCalc = {
  byCompany: Record<string, NodeCalc>;
  global: number | null;
  globalParts: (CalcPart & { co: string })[];
  nodeGlobal: Record<string, number | null>;
};

function weighted(parts: { score: number | null; weight: number }[]) {
  const valid = parts.filter(p => p.score !== null && p.weight > 0);
  const total = sum(valid.map(p => p.weight));
  if (!total) return { score: null, total };
  return { score: sum(valid.map(p => p.score! * p.weight)) / total, total };
}

export function consolidate(db: DB, scn: Scenario, meta: Meta, view: WeightView, values: PeriodValues): MetaCalc {
  const ws = scn.weights[view];
  const rules = new Map(scn.rules.map(r => [r.code, r]));
  const inds = new Map(scn.indicators.map(i => [i.code, i]));

  function calcNode(node: TreeNode, co: string): NodeCalc {
    if (node.kind === "INDICATOR") {
      const ind = inds.get(node.indicator);
      const rule = rules.get(node.rule);
      const label = ind?.name ?? node.indicator;
      if (!ind || !isEligible(scn, ind.code, co)) return { id: node.id, kind: "INDICATOR", label, weight: node.weight, score: null, eff: 0, children: [], indicator: node.indicator, rule: node.rule, na: true };
      const areas = ind.areas.filter(s => meta.areas.includes(s)).map(seg => {
        const value = values.get(unitKey(ind.code, co, seg));
        const { result, score } = unitScore(value, rule);
        const weight = ind.areaWeighting === "VALOR_REFERENCIA" ? Math.abs(value?.planned ?? 0) : ws.segments[co]?.[seg] ?? 0;
        return { label: db.org.segments.find(s => s.code === seg)?.name ?? seg, seg, value, result, score, weight, eff: 0 };
      }).filter(a => a.value);
      const { score, total } = weighted(areas);
      areas.forEach(a => { a.eff = a.score !== null && total ? a.weight / total : 0; });
      return { id: node.id, kind: "INDICATOR", label, weight: node.weight, score, eff: 0, children: [], areas, indicator: node.indicator, rule: node.rule, na: !areas.length };
    }
    const children = node.children.map(c => calcNode(c, co));
    const { score, total } = weighted(children);
    children.forEach(c => { c.eff = c.score !== null && total ? c.weight / total : 0; });
    return { id: node.id, kind: "INDEX", label: node.name, weight: node.weight, score, eff: 0, children };
  }

  const byCompany: Record<string, NodeCalc> = {};
  for (const co of db.org.companies) {
    const children = meta.children.map(c => calcNode(c, co.id));
    const { score, total } = weighted(children);
    children.forEach(c => { c.eff = c.score !== null && total ? c.weight / total : 0; });
    byCompany[co.id] = { id: meta.id, kind: "META", label: meta.name, weight: 100, score, eff: 1, children };
  }

  const globalParts = db.org.companies.filter(c => c.active || byCompany[c.id].score !== null).map(c => ({ co: c.id, label: c.name, score: byCompany[c.id].score, weight: ws.companies[c.id] ?? 0, eff: 0 }));
  const g = weighted(globalParts);
  globalParts.forEach(p => { p.eff = p.score !== null && g.total ? p.weight / g.total : 0; });

  const nodeGlobal: Record<string, number | null> = {};
  const walk = (calcs: { co: string; node: NodeCalc }[]) => {
    const first = calcs[0].node;
    nodeGlobal[first.id] = weighted(calcs.map(c => ({ score: c.node.score, weight: ws.companies[c.co] ?? 0 }))).score;
    first.children.forEach((_, i) => walk(calcs.map(c => ({ co: c.co, node: c.node.children[i] }))));
  };
  walk(db.org.companies.map(c => ({ co: c.id, node: byCompany[c.id] })));

  return { byCompany, global: g.score, globalParts, nodeGlobal };
}

// ─── Estrutura ──────────────────────────────────────────────────────────────

export function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.kind === "INDEX") { const f = findNode(n.children, id); if (f) return f; }
  }
  return null;
}
export function findParent(nodes: TreeNode[], id: string, parent: TreeNode[] = nodes): TreeNode[] | null {
  for (const n of nodes) {
    if (n.id === id) return parent;
    if (n.kind === "INDEX") { const f = findParent(n.children, id, n.children); if (f) return f; }
  }
  return null;
}
/** Caminho de nomes até o nó; usado para mostrar ciclos ao mover índices. */
export function pathTo(nodes: TreeNode[], id: string, trail: string[] = []): string[] | null {
  for (const n of nodes) {
    const label = n.kind === "INDEX" ? n.name : n.indicator;
    if (n.id === id) return [...trail, label];
    if (n.kind === "INDEX") { const f = pathTo(n.children, id, [...trail, label]); if (f) return f; }
  }
  return null;
}
export function leaves(nodes: TreeNode[]): Extract<TreeNode, { kind: "INDICATOR" }>[] {
  return nodes.flatMap(n => n.kind === "INDICATOR" ? [n] : leaves(n.children));
}
export function indexes(nodes: TreeNode[]): Extract<TreeNode, { kind: "INDEX" }>[] {
  return nodes.flatMap(n => n.kind === "INDEX" ? [n, ...indexes(n.children)] : []);
}

// ─── Status de entrega ──────────────────────────────────────────────────────

export type DeliveryStatus = "APURADO" | "APURADO_ATRASO" | "HOMOLOGADO" | "ATRASADO" | "VENCE" | "PENDENTE" | "CALCULADO" | "AGUARDANDO";
export const statusLabel: Record<DeliveryStatus, [string, string]> = {
  APURADO: ["Apurado", "done"], APURADO_ATRASO: ["Entregue com atraso", "warn"], HOMOLOGADO: ["Homologado", "done"],
  ATRASADO: ["Atrasado", "late"], VENCE: ["Vence em breve", "warn"], PENDENTE: ["Pendente", "idle"],
  CALCULADO: ["Calculado", "done"], AGUARDANDO: ["Aguardando origem", "idle"],
};

export function deliveryStatus(v: UnitValue, ind: Indicator, scn: Scenario, month: number, refDate: string): DeliveryStatus {
  if (ind.kind === "DEPENDENTE") return v.actual === null ? "AGUARDANDO" : "CALCULADO";
  const deadline = deadlineFor(ind, scn.year, month);
  if (v.actual !== null) {
    if (scn.closedMonths.includes(month)) return "HOMOLOGADO";
    return v.entry?.deliveredOn && v.entry.deliveredOn > deadline ? "APURADO_ATRASO" : "APURADO";
  }
  if (refDate > deadline) return "ATRASADO";
  return daysBetween(refDate, deadline) <= 2 ? "VENCE" : "PENDENTE";
}

// ─── Validações ─────────────────────────────────────────────────────────────

export type Issue = { level: "erro" | "alerta"; scope: string; message: string; view: View };

export function validateScenario(db: DB, scn: Scenario, month: number, values?: PeriodValues): Issue[] {
  const issues: Issue[] = [];
  const err = (scope: string, message: string, view: View) => issues.push({ level: "erro", scope, message, view });
  const warn = (scope: string, message: string, view: View) => issues.push({ level: "alerta", scope, message, view });
  const rules = new Map(scn.rules.map(r => [r.code, r]));
  const inds = new Map(scn.indicators.map(i => [i.code, i]));

  for (const meta of scn.metas.filter(m => m.active)) {
    const total = sum(meta.children.map(c => c.weight));
    if (!meta.children.length) err("Estrutura", `${meta.name}: meta sem índices.`, "estrutura");
    else if (!near100(total)) err("Estrutura", `${meta.name}: pesos dos índices somam ${fmt(total)}% (esperado 100%).`, "estrutura");
    for (const idx of indexes(meta.children)) {
      const t = sum(idx.children.map(c => c.weight));
      if (!idx.children.length) warn("Estrutura", `${meta.name} › ${idx.name}: índice sem filhos.`, "estrutura");
      else if (!near100(t)) err("Estrutura", `${meta.name} › ${idx.name}: filhos somam ${fmt(t)}% (esperado 100%).`, "estrutura");
    }
    for (const leaf of leaves(meta.children)) {
      const ind = inds.get(leaf.indicator), rule = rules.get(leaf.rule);
      if (!ind) err("Estrutura", `${meta.name}: indicador ${leaf.indicator} não existe no catálogo.`, "estrutura");
      else if (!ind.active) warn("Estrutura", `${meta.name}: indicador ${ind.name} está inativo.`, "estrutura");
      if (!rule) err("Réguas", `${meta.name}: indicador ${ind?.name ?? leaf.indicator} sem régua vinculada.`, "reguas");
      else if (!rule.active) err("Réguas", `${meta.name}: ${ind?.name ?? leaf.indicator} usa a régua inativa ${rule.code}.`, "reguas");
      if (ind && !ind.areas.some(a => meta.areas.includes(a))) warn("Estrutura", `${meta.name}: ${ind.name} não tem área executora vinculada à meta.`, "estrutura");
    }
  }

  for (const rule of scn.rules) {
    if (!validRuleParams(rule.polarity, rule)) err("Réguas", `Régua ${rule.code}: parâmetros incoerentes com a polaridade.`, "reguas");
    for (const [co, p] of Object.entries(rule.overrides)) if (!validRuleParams(rule.polarity, p)) err("Réguas", `Régua ${co}_${rule.code}: parâmetros incoerentes com a polaridade.`, "reguas");
  }

  for (const ind of scn.indicators.filter(i => i.kind === "DEPENDENTE")) {
    try {
      const refs = [...parseFormula(ind.formulaActual ?? "").refs, ...(ind.formulaPlanned?.trim() ? parseFormula(ind.formulaPlanned).refs : [])];
      for (const r of refs) if (!inds.has(r.code)) err("Fórmulas", `${ind.code} ${ind.name}: referencia o indicador inexistente ${r.code}.`, "reguas");
    } catch (e) { err("Fórmulas", `${ind.code} ${ind.name}: ${(e as Error).message}`, "reguas"); }
  }
  const cycle = findCycle(scn.indicators);
  if (cycle) err("Fórmulas", `Dependência circular: ${cycle.join(" → ")}.`, "reguas");

  for (const [view, label] of weightViews) {
    const ws = scn.weights[view];
    const active = db.org.companies.filter(c => c.active);
    const total = sum(active.map(c => ws.companies[c.id] ?? 0));
    if (!near100(total)) err("Pesos", `${label}: pesos entre distribuidoras somam ${fmt(total)}%.`, "reguas");
    for (const co of active) {
      if (!(ws.companies[co.id] > 0)) warn("Pesos", `${label}: ${co.name} sem peso na consolidação global.`, "reguas");
      const segs = sum(Object.values(ws.segments[co.id] ?? {}));
      if (!near100(segs)) err("Pesos", `${label} · ${co.id}: pesos entre áreas somam ${fmt(segs)}%.`, "reguas");
    }
  }
  for (const [key, regs] of Object.entries(scn.regionalWeights)) {
    const total = sum(Object.values(regs));
    if (!near100(total)) err("Pesos", `Regionais ${key.replace("|", " · ")}: pesos somam ${fmt(total)}%.`, "reguas");
  }

  if (values) {
    for (const v of values.values()) {
      const ind = inds.get(v.ind);
      if (!ind) continue;
      const st = deliveryStatus(v, ind, scn, month, db.refDate);
      if (st === "ATRASADO") err("Apuração", `${ind.name} · ${v.co} · ${v.seg}: resultado não informado após o prazo.`, "apuracao");
      if (v.formulaError) err("Fórmulas", `${ind.name}: ${v.formulaError}`, "reguas");
    }
    const missing = [...values.values()].filter(v => v.actual === null && inds.get(v.ind)?.kind === "BASE").length;
    if (missing) warn("Apuração", `${missing} resultado(s) ainda sem valor realizado em ${months[month - 1]}.`, "apuracao");
  }
  return issues;
}

// ─── CSV ────────────────────────────────────────────────────────────────────

export function toCSV(rows: (string | number | null | undefined)[][]) {
  const cell = (x: string | number | null | undefined) => {
    const s = x === null || x === undefined ? "" : typeof x === "number" ? String(x).replace(".", ",") : x;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map(r => r.map(cell).join(";")).join("\r\n");
}

export function parseCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/)[0] ?? "";
  const sep = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cur = "", quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

/** Aceita "1.234,56", "1234,56" e "1234.56". */
export function parseNumber(raw: string): number | null | "invalid" {
  const s = raw.trim().replace(/\s|%/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : "invalid";
}

export function download(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
