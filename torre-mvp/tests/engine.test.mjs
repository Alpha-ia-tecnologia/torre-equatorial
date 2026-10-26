import assert from "node:assert/strict";
import test from "node:test";
import {
  calcOrder, computePeriod, consolidate, entryKey, evalAst, findCycle, parseChave, parseCSV, parseFormula, parseNumber, scoreOf, validateScenario,
} from "../app/torre/engine.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
const rule = (p = {}) => ({ code: "R", name: "R", polarity: "MAIOR", base: "ATINGIMENTO", min: 70, target: 100, challenge: 110, active: true, floor: 0, ceiling: "TETO", overrides: {}, history: [], ...p });
const ind = (code, p = {}) => ({ code, name: code, unit: "%", areas: ["ORD"], kind: "BASE", defaultRule: "R", ownerId: "u", apuradorIds: [], deadlineDay: 5, areaWeighting: "SEGMENTO", piDetail: false, active: true, ...p });

test("régua: pontos de referência 1 / 10 / 15 e interpolação", () => {
  const r = rule();
  assert.equal(scoreOf(60, r), 0);
  near(scoreOf(70, r), 1);
  near(scoreOf(85, r), 5.5);
  near(scoreOf(100, r), 10);
  near(scoreOf(110, r), 15);
  assert.equal(scoreOf(130, r), 15);
  assert.equal(scoreOf(60, rule({ floor: 1 })), 1);
  near(scoreOf(120, rule({ ceiling: "EXTRAPOLAR" })), 20);
});

test("régua: polaridade quanto menor, melhor", () => {
  const r = rule({ polarity: "MENOR", min: 125, target: 100, challenge: 80 });
  near(scoreOf(125, r), 1);
  near(scoreOf(100, r), 10);
  near(scoreOf(80, r), 15);
  assert.equal(scoreOf(140, r), 0);
  near(scoreOf(90, r), 12.5);
});

test("fórmulas: parser, avaliação e erros", () => {
  const { ast, refs } = parseFormula("0.6 * realizado[01] / previsto[01] * 100 + MAX(realizado[03], 2)");
  assert.deepEqual(refs.map(r => `${r.kind}${r.code}`), ["realizado01", "previsto01", "realizado03"]);
  const values = { realizado01: 90, previsto01: 100, realizado03: 5 };
  near(evalAst(ast, r => values[r.kind + r.code]), 59);
  assert.equal(evalAst(parseFormula("realizado[01] / previsto[02]").ast, r => r.code === "02" ? 0 : 1), null);
  assert.throws(() => parseFormula("realizado[01] +"), /incompleta/);
  assert.throws(() => parseFormula("foo(1)"), /desconhecido/);
});

test("dependências: ordem de cálculo e bloqueio de ciclos", () => {
  const list = [ind("03"), ind("04"), ind("05", { kind: "DEPENDENTE", formulaActual: "realizado[04] / realizado[03]" }), ind("06", { kind: "DEPENDENTE", formulaActual: "realizado[05] * 2" })];
  assert.deepEqual(calcOrder(list), ["05", "06"]);
  assert.equal(findCycle(list), null);
  const cyclic = list.map(i => i.code === "03" ? ind("03", { kind: "DEPENDENTE", formulaActual: "realizado[05] * 2" }) : i);
  assert.deepEqual(findCycle(cyclic), ["03", "05", "03"]);
});

test("consolidação: renormaliza pesos quando o indicador não é aplicável", () => {
  const scn = {
    year: 2025, status: "ATIVO", version: 1, createdFrom: null, publishedAt: null, closedMonths: [], events: [], regionalWeights: {},
    rules: [rule()], indicators: [ind("A"), ind("B"), ind("C", { kind: "DEPENDENTE", formulaActual: "realizado[A] + realizado[B]", formulaPlanned: "previsto[A] + previsto[B]" })],
    eligibility: { "B|X": false },
    metas: [{ id: "m", name: "M", roles: [], areas: ["ORD"], active: true, children: [
      { id: "i", kind: "INDEX", name: "I", description: "", weight: 100, children: [{ id: "a", kind: "INDICATOR", indicator: "A", rule: "R", weight: 60 }, { id: "b", kind: "INDICATOR", indicator: "B", rule: "R", weight: 40 }] },
    ] }],
    weights: Object.fromEntries(["ELEGIVEL", "ENGENHARIA", "OBRAS", "SUPER"].map(v => [v, { companies: { X: 50, Y: 50 }, segments: { X: { ORD: 100 }, Y: { ORD: 100 } } }])),
  };
  const db = {
    version: 3, org: { companies: [{ id: "X", name: "X", active: true, since: "" }, { id: "Y", name: "Y", active: true, since: "" }], segments: [{ code: "ORD", name: "Obras", active: true }], regionals: [] },
    users: [], scenarios: [scn], audit: [], activeYear: 2025, currentUserId: "u", refDate: "2025-11-01",
    entries: {
      [entryKey(2025, 10, "A", "X", "ORD")]: { planned: 100, actual: 100, deliveredOn: null },
      [entryKey(2025, 10, "A", "Y", "ORD")]: { planned: 100, actual: 100, deliveredOn: null },
      [entryKey(2025, 10, "B", "Y", "ORD")]: { planned: 100, actual: 70, deliveredOn: null },
    },
  };
  const values = computePeriod(db, scn, 10);
  assert.equal(values.get("C|Y|ORD").actual, 170);
  assert.equal(values.get("C|X|ORD").actual, null);
  const calc = consolidate(db, scn, scn.metas[0], "ELEGIVEL", values);
  near(calc.byCompany.X.score, 10);
  near(calc.byCompany.Y.score, 10 * .6 + 1 * .4);
  near(calc.global, (10 + 6.4) / 2);
  assert.ok(validateScenario(db, scn, 10, values).every(i => i.level !== "erro" || i.scope === "Apuração"));
});

test("importação: CHAVE_INDICADOR, números e CSV", () => {
  assert.deepEqual(parseChave("ma.ord.00|2025-10|01"), { company: "MA", segment: "ORD", regional: "00", year: 2025, month: 10, indicator: "01" });
  assert.equal(parseChave("MA-ORD-00/2025-10/01"), null);
  assert.equal(parseNumber("1.234,56"), 1234.56);
  assert.equal(parseNumber("1234.5"), 1234.5);
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("12,3,4"), "invalid");
  assert.deepEqual(parseCSV('A;B\n"x;y";2\n\n'), [["A", "B"], ["x;y", "2"]]);
});
