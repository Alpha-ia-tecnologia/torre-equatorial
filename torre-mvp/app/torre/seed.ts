import { entryKey, pad } from "./engine";
import type { AuditEvent, CalEvent, DB, Entry, Indicator, Meta, Rule, Scenario, WeightSet, WeightView } from "./types";

/** Gerador determinístico: a mesma base é produzida no servidor e no navegador. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Normaliza para somar exatamente 100 com duas casas, ajustando o maior item. */
function to100(weights: Record<string, number>) {
  const total = Object.values(weights).reduce((a, x) => a + x, 0);
  const out = Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, round(v / total * 100)]));
  const diff = round(100 - Object.values(out).reduce((a, x) => a + x, 0));
  const top = Object.entries(out).sort((a, b) => b[1] - a[1])[0][0];
  out[top] = round(out[top] + diff);
  return out;
}

const companies = [
  { id: "MA", name: "Equatorial Maranhão", active: true, since: "2023-01-01" },
  { id: "PA", name: "Equatorial Pará", active: true, since: "2023-01-01" },
  { id: "PI", name: "Equatorial Piauí", active: true, since: "2023-01-01" },
  { id: "AL", name: "Equatorial Alagoas", active: true, since: "2023-01-01" },
  { id: "RS", name: "CEEE Equatorial", active: true, since: "2023-01-01" },
  { id: "AP", name: "CEA Equatorial", active: true, since: "2023-01-01" },
  { id: "GO", name: "Equatorial Goiás", active: true, since: "2023-01-01" },
];
const segments = [
  { code: "AUT", name: "Automação", active: true },
  { code: "EAT", name: "Expansão AT", active: true },
  { code: "MAT", name: "Manutenção AT", active: true },
  { code: "ORD", name: "Obras RD", active: true },
  { code: "REC", name: "Recuperação de Energia", active: true },
  { code: "SRV", name: "Serviços de Rede", active: true },
  { code: "LUZ", name: "Luz para Todos", active: false },
];
const regionalNames: Record<string, string[]> = {
  MA: ["Metropolitana", "Norte", "Sul", "Leste"], PA: ["Metropolitana", "Nordeste", "Oeste"], PI: ["Teresina", "Norte", "Sul"],
  AL: ["Maceió", "Agreste", "Sertão"], RS: ["Porto Alegre", "Litoral", "Campanha"], AP: ["Macapá", "Interior"], GO: ["Goiânia", "Norte", "Sudoeste", "Entorno DF"],
};
const regionals = Object.entries(regionalNames).flatMap(([co, names]) => names.map((name, i) => ({
  id: `${co}-${pad(i + 1)}`, company: co, code: pad(i + 1), name, active: !(co === "RS" && name === "Campanha"),
})));

const users = [
  { id: "u-admin", name: "Nataldo Costa", role: "ADMIN" as const, companies: ["*"], active: true },
  { id: "u-gestor", name: "Rafael Alves", role: "GESTOR" as const, companies: ["*"], active: true },
  { id: "u-paulo", name: "Paulo Nunes", role: "APURADOR" as const, companies: ["*"], active: true },
  { id: "u-ana", name: "Ana Lima", role: "APURADOR" as const, companies: ["*"], active: true },
  { id: "u-mariana", name: "Mariana Costa", role: "APURADOR" as const, companies: ["MA", "PA"], active: true },
  { id: "u-carla", name: "Carla Souza", role: "APURADOR" as const, companies: ["AP", "GO", "PI"], active: true },
  { id: "u-joao", name: "João Ribeiro", role: "APURADOR" as const, companies: ["PI", "AL", "RS"], active: true },
  { id: "u-consulta", name: "Beatriz Moura", role: "CONSULTA" as const, companies: ["*"], active: true },
];

function rules(): Rule[] {
  const base = { active: true, floor: 0 as const, ceiling: "TETO" as const, overrides: {}, history: [{ at: "2025-01-15T10:00:00.000Z", by: "Nataldo Costa", summary: "Importada da planilha V3-R" }] };
  return [
    { ...base, code: "VRC", name: "Avanço físico VR e cronograma", polarity: "MAIOR", base: "ATINGIMENTO", min: 72, target: 95, challenge: 100, overrides: { RS: { min: 70, target: 92, challenge: 100 } } },
    { ...base, code: "FCA", name: "Financeiro e capitalização ajustada", polarity: "MAIOR", base: "ATINGIMENTO", min: 77.5, target: 100, challenge: 105 },
    { ...base, code: "FISC", name: "Obras fiscalizadas RD e AT", polarity: "MAIOR", base: "ATINGIMENTO", min: 80, target: 90, challenge: 100 },
    { ...base, code: "PMO", name: "Prazo médio de obras", polarity: "MENOR", base: "ATINGIMENTO", min: 125, target: 100, challenge: 83.33 },
    { ...base, code: "ENERG", name: "Pendência de energização", polarity: "MENOR", base: "VALOR", min: 29, target: 18.8, challenge: 12, overrides: {
      PA: { min: 25, target: 16, challenge: 10 }, PI: { min: 32, target: 20, challenge: 14 }, AL: { min: 22, target: 15, challenge: 10 },
      RS: { min: 35, target: 24, challenge: 16 }, AP: { min: 30, target: 20, challenge: 13 }, GO: { min: 27, target: 18, challenge: 12 },
    } },
    { ...base, code: "CARTA", name: "Carta diretriz", polarity: "MAIOR", base: "VALOR", min: 1, target: 10, challenge: 15 },
  ];
}

function indicators(year: number): Indicator[] {
  const b = { kind: "BASE" as const, active: true, piDetail: false, areaWeighting: "SEGMENTO" as const };
  const list: Indicator[] = [
    { ...b, code: "01", name: "Avanço Físico VR", unit: "R$ mil", areas: ["ORD", "EAT"], defaultRule: "VRC", ownerId: "u-paulo", apuradorIds: ["u-mariana"], deadlineDay: 5, areaWeighting: "VALOR_REFERENCIA", piDetail: true },
    { ...b, code: "02", name: "Status do Cronograma", unit: "%", areas: ["EAT", "MAT"], defaultRule: "VRC", ownerId: "u-paulo", apuradorIds: ["u-mariana"], deadlineDay: 6 },
    { ...b, code: "03", name: "Avanço Financeiro", unit: "R$ mil", areas: year === 2024 ? ["ORD", "SRV", "LUZ"] : ["ORD", "SRV", "AUT"], defaultRule: "FCA", ownerId: "u-ana", apuradorIds: ["u-mariana"], deadlineDay: 4, areaWeighting: "VALOR_REFERENCIA" },
    { ...b, code: "04", name: "Capitalização", unit: "R$ mil", areas: ["ORD", "SRV"], defaultRule: "FCA", ownerId: "u-ana", apuradorIds: ["u-mariana"], deadlineDay: 4, areaWeighting: "VALOR_REFERENCIA" },
    { ...b, code: "05", name: "Capitalização sobre Financeiro", unit: "%", areas: ["ORD", "SRV"], kind: "DEPENDENTE", formulaActual: "realizado[04] / realizado[03] * 100", formulaPlanned: "previsto[04] / previsto[03] * 100", defaultRule: "FCA", ownerId: "u-ana", apuradorIds: [], deadlineDay: 4 },
    { ...b, code: "06", name: "Aprovação de Obras COMS", unit: "qtd", areas: ["ORD"], defaultRule: "FISC", ownerId: "u-carla", apuradorIds: ["u-joao"], deadlineDay: 6 },
    { ...b, code: "07", name: "Obras Fiscalizadas", unit: "qtd", areas: ["ORD", "MAT"], defaultRule: "FISC", ownerId: "u-carla", apuradorIds: ["u-joao"], deadlineDay: 3 },
    { ...b, code: "08", name: "Prazo Médio de Obras", unit: "dias", areas: ["ORD", "EAT"], defaultRule: "PMO", ownerId: "u-joao", apuradorIds: ["u-carla"], deadlineDay: 7 },
    { ...b, code: "09", name: "Pendência de Energização", unit: "%", areas: ["REC", "SRV"], defaultRule: "ENERG", ownerId: "u-joao", apuradorIds: ["u-carla"], deadlineDay: 7 },
  ];
  if (year >= 2025) list.push({ ...b, code: "11", name: "Índice Físico-Financeiro (IFF)", unit: "%", areas: ["ORD"], kind: "DEPENDENTE", formulaActual: "0.6 * realizado[01] / previsto[01] * 100 + 0.4 * realizado[03] / previsto[03] * 100", formulaPlanned: "100", defaultRule: "VRC", ownerId: "u-paulo", apuradorIds: [], deadlineDay: 5 });
  return list;
}

let nodeSeq = 0;
const leaf = (indicator: string, rule: string, weight: number) => ({ id: `n${++nodeSeq}`, kind: "INDICATOR" as const, indicator, rule, weight });
const index = (name: string, description: string, weight: number, children: Meta["children"]) => ({ id: `n${++nodeSeq}`, kind: "INDEX" as const, name, description, weight, children });

function metas(year: number): Meta[] {
  nodeSeq = year * 100;
  const elegivel: Meta = {
    id: `m-elegivel-${year}`, name: `Meta Torre Elegível ${year}`, roles: ["Diretores", "Superintendentes", "Gerentes"],
    areas: year === 2024 ? ["AUT", "EAT", "MAT", "ORD", "REC", "SRV", "LUZ"] : ["AUT", "EAT", "MAT", "ORD", "REC", "SRV"], active: true,
    children: year === 2024 ? [
      index("AFFA", "Avanço físico-financeiro ajustado", 60, [leaf("01", "VRC", 40), leaf("02", "VRC", 25), leaf("03", "FCA", 20), leaf("05", "FCA", 15)]),
      index("IQO", "Índice de qualidade de obras", 25, [leaf("06", "FISC", 50), leaf("07", "FISC", 50)]),
      index("Prazo médio", "Tempo médio de conclusão", 15, [leaf("08", "PMO", 100)]),
    ] : [
      index("AFFA", "Avanço físico-financeiro ajustado", 60, [leaf("01", "VRC", 35), leaf("02", "VRC", 25), leaf("03", "FCA", 20), leaf("05", "FCA", 20)]),
      index("IQO", "Índice de qualidade de obras", 20, [index("Fiscalização", "Aprovação e fiscalização de obras", 60, [leaf("06", "FISC", 50), leaf("07", "FISC", 50)]), leaf("09", "ENERG", 40)]),
      index("Prazo médio", "Tempo médio de conclusão", 20, [leaf("08", "PMO", 100)]),
    ],
  };
  if (year === 2024) return [elegivel];
  return [elegivel, {
    id: `m-obras-${year}`, name: `Meta Direção de Obras ${year}`, roles: ["Diretor de Obras", "Gerentes de Obras"], areas: ["ORD", "MAT", "SRV"], active: true,
    children: [
      index("Execução", "Execução física e financeira das obras", 70, [leaf("01", "VRC", 50), leaf("11", "VRC", 30), leaf("04", "VRC", 20)]),
      index("Prazo", "Prazo e fiscalização", 30, [leaf("08", "PMO", 60), leaf("07", "FISC", 40)]),
    ],
  }];
}

const companyWeights: Record<WeightView, Record<string, number>> = {
  ELEGIVEL: { MA: 22, PA: 24, PI: 12, AL: 9, RS: 13, AP: 5, GO: 15 },
  ENGENHARIA: { MA: 20, PA: 22, PI: 14, AL: 10, RS: 14, AP: 6, GO: 14 },
  OBRAS: { MA: 25, PA: 25, PI: 10, AL: 8, RS: 12, AP: 5, GO: 15 },
  SUPER: { MA: 14.29, PA: 14.29, PI: 14.29, AL: 14.29, RS: 14.29, AP: 14.26, GO: 14.29 },
};
const segmentBase: Record<string, number> = { AUT: .62, EAT: 18.77, MAT: 2.14, ORD: 61.09, REC: 8.51, SRV: 8.87 };
const viewEmphasis: Record<WeightView, Record<string, number>> = {
  ELEGIVEL: {}, ENGENHARIA: { AUT: 3, EAT: 1.6, MAT: 1.5, ORD: .6 }, OBRAS: { ORD: 1.3, MAT: 1.4, EAT: .8, AUT: .5, REC: .6, SRV: .8 }, SUPER: { AUT: 4, MAT: 3, REC: 1.5, SRV: 1.5, ORD: .5 },
};

function weights(year: number): Record<WeightView, WeightSet> {
  const r = rng(year * 7);
  const out = {} as Record<WeightView, WeightSet>;
  for (const view of Object.keys(companyWeights) as WeightView[]) {
    const segs: WeightSet["segments"] = {};
    for (const co of companies) {
      const raw: Record<string, number> = {};
      for (const [seg, w] of Object.entries(segmentBase)) raw[seg] = w * (viewEmphasis[view][seg] ?? 1) * (co.id === "MA" && view === "ELEGIVEL" ? 1 : .8 + r() * .4);
      if (year === 2024) raw.LUZ = 4;
      segs[co.id] = co.id === "MA" && view === "ELEGIVEL" && year !== 2024 ? { ...segmentBase } : to100(raw);
    }
    out[view] = { companies: { ...companyWeights[view] }, segments: segs };
  }
  // Divergência real da planilha: soma dos pesos de GO na visão elegível em 98,5%.
  if (year === 2025) out.ELEGIVEL.segments.GO.ORD = round(out.ELEGIVEL.segments.GO.ORD - 1.5);
  return out;
}

function regionalWeights() {
  const out: Record<string, Record<string, number>> = {};
  for (const co of companies) for (const seg of ["ORD", "EAT"]) {
    const regs = regionals.filter(r => r.company === co.id && r.active);
    out[`${co.id}|${seg}`] = co.id === "MA" && seg === "ORD" ? { "MA-01": 40, "MA-02": 25, "MA-03": 20, "MA-04": 15 } : to100(Object.fromEntries(regs.map((r, i) => [r.id, 1 + (i === 0 ? .6 : 0)])));
  }
  return out;
}

function events(year: number): CalEvent[] {
  return Array.from({ length: 12 }, (_, i) => i + 1).flatMap(m => {
    const y = m === 12 ? year + 1 : year, n = m === 12 ? 1 : m + 1, d = (day: number) => `${y}-${pad(n)}-${pad(day)}`;
    return [
      { id: `ev-${year}-${m}-val`, date: d(8), type: "VALIDACAO" as const, title: "Validação técnica dos resultados", month: m, ownerId: "u-gestor" },
      { id: `ev-${year}-${m}-com`, date: d(12), type: "COMITE" as const, title: "Comitê da Torre · fechamento", month: m, ownerId: "u-gestor" },
      { id: `ev-${year}-${m}-lan`, date: d(14), type: "LANCAMENTO" as const, title: "Lançamento das notas", month: m, ownerId: "u-admin" },
    ];
  });
}

function scenario(year: number): Scenario {
  return {
    year, status: year === 2024 ? "ENCERRADO" : "ATIVO", version: year === 2024 ? 4 : 3, createdFrom: year === 2024 ? null : 2024,
    publishedAt: `${year}-01-15T10:00:00.000Z`, metas: metas(year), indicators: indicators(year), rules: rules(),
    eligibility: { "02|PI": false, "08|AP": false, "09|AL": false }, weights: weights(year), regionalWeights: regionalWeights(),
    events: events(year), closedMonths: year === 2024 ? Array.from({ length: 12 }, (_, i) => i + 1) : [1, 2, 3, 4, 5, 6, 7, 8, 9],
  };
}

const size: Record<string, number> = { MA: 1.2, PA: 1.4, PI: .8, AL: .6, RS: .9, AP: .35, GO: 1 };
const perf: Record<string, number> = { MA: .93, PA: .955, PI: .89, AL: .97, RS: .85, AP: .91, GO: .945 };
const segFactor: Record<string, Record<string, number>> = {
  "01": { ORD: 1, EAT: .45 }, "03": { ORD: 1, SRV: .35, AUT: .12, LUZ: .2 }, "04": { ORD: 1, SRV: .3 }, "07": { ORD: 1, MAT: .5 },
};
const octoberMissing = new Set(["07|PI", "02|RS", "09|GO", "06|AP"]);

function entries(scn: Scenario, lastMonth: number) {
  const r = rng(scn.year);
  const out: Record<string, Entry> = {};
  const drift = scn.year === 2024 ? -.035 : 0;
  for (const ind of scn.indicators.filter(i => i.kind === "BASE")) for (const co of companies) {
    if (scn.eligibility[`${ind.code}|${co.id}`] === false) continue;
    for (const seg of ind.areas) {
      const bias = perf[co.id] + drift + (r() - .5) * .08;
      const sf = segFactor[ind.code]?.[seg] ?? 1;
      for (let m = 1; m <= lastMonth; m++) {
        const f = bias + m * .003 + (r() - .5) * .03;
        let planned: number, actual: number;
        switch (ind.code) {
          case "01": planned = 1150 * size[co.id] * sf * m; actual = planned * f; break;
          case "02": planned = Math.min(100, m * 9.2); actual = planned * f; break;
          case "03": planned = 260 * size[co.id] * sf * m; actual = planned * (f + .02); break;
          case "04": planned = 255 * size[co.id] * sf * m; actual = planned * (f - .01); break;
          case "06": planned = Math.round(10 * size[co.id] * m); actual = Math.round(planned * f); break;
          case "07": planned = Math.round(12 * size[co.id] * sf * m); actual = Math.round(planned * (f - .04)); break;
          case "08": planned = 100; actual = 100 * (2 - f) + (r() - .5) * 6; break;
          default: planned = 18.8; actual = 18.8 * (2.05 - f) + (r() - .5) * 3;
        }
        const late = scn.year === 2025 && m === 10 && octoberMissing.has(`${ind.code}|${co.id}`);
        const deliveredOn = `${m === 12 ? scn.year + 1 : scn.year}-${pad(m === 12 ? 1 : m + 1)}-${pad(Math.max(1, ind.deadlineDay - 1))}`;
        out[entryKey(scn.year, m, ind.code, co.id, seg)] = { planned: round(planned), actual: late ? null : round(actual), deliveredOn: late ? null : deliveredOn };
      }
    }
  }
  if (scn.year === 2025) {
    const lateDelivery = out[entryKey(2025, 10, "03", "RS", "ORD")];
    if (lateDelivery) lateDelivery.deliveredOn = "2025-11-05";
    const pi = out[entryKey(2025, 10, "01", "MA", "ORD")];
    if (pi?.actual != null && pi.planned != null) {
      const shares: [string, string, number, number][] = [["PI-25-0142", "SE Itaqui · ampliação", .45, .97], ["PI-25-0217", "LD 69 kV Bacabal", .35, 1.01], ["PI-25-0388", "Reforma RD São Luís", .2, .93]];
      pi.pis = shares.map(([code, name, s, f]) => ({ pi: code, name, planned: round(pi.planned! * s), actual: round(pi.planned! * s * f) }));
      pi.planned = round(pi.pis.reduce((a, x) => a + x.planned, 0));
      pi.actual = round(pi.pis.reduce((a, x) => a + (x.actual ?? 0), 0));
    }
  }
  return out;
}

const audit: Omit<AuditEvent, "id">[] = [
  { at: "2025-11-04T12:42:00.000Z", userId: "u-mariana", userName: "Mariana Costa", category: "VALOR", action: "Atualizou realizado", entity: "Avanço Físico VR · MA.ORD.00 · Out/2025", before: "13.850,10", after: "Detalhado por PI", year: 2025 },
  { at: "2025-11-04T11:17:00.000Z", userId: "u-gestor", userName: "Rafael Alves", category: "CENARIO", action: "Homologou período", entity: "Setembro/2025", after: "Período fechado", year: 2025 },
  { at: "2025-11-03T19:31:00.000Z", userId: "u-paulo", userName: "Paulo Nunes", category: "VALOR", action: "Atualizou previsto", entity: "Status do Cronograma · MA.EAT.00 · Out/2025", before: "88,80", after: "92,00", year: 2025 },
  { at: "2025-10-18T17:05:00.000Z", userId: "u-ana", userName: "Ana Lima", category: "IMPORTACAO", action: "Importou lote", entity: "Base mensal · 42 registros", after: "40 válidos · 2 rejeitados", year: 2025 },
  { at: "2025-03-10T13:20:00.000Z", userId: "u-admin", userName: "Nataldo Costa", category: "PESO", action: "Alterou peso", entity: "Torre Elegível · MA · Obras RD", before: "60,00%", after: "61,09%", year: 2025 },
  { at: "2025-01-15T13:00:00.000Z", userId: "u-admin", userName: "Nataldo Costa", category: "CENARIO", action: "Publicou cenário", entity: "Cenário 2025", before: "Rascunho v2", after: "Ativo v3", year: 2025 },
  { at: "2025-01-10T18:40:00.000Z", userId: "u-admin", userName: "Nataldo Costa", category: "ESTRUTURA", action: "Incluiu indicador", entity: "Meta Direção de Obras 2025 › Execução › 11 IFF", after: "Peso 30%", year: 2025 },
  { at: "2024-12-20T14:00:00.000Z", userId: "u-admin", userName: "Nataldo Costa", category: "CENARIO", action: "Replicou cenário", entity: "2024 → 2025", after: "Rascunho criado", year: 2025 },
  { at: "2024-12-18T14:00:00.000Z", userId: "u-admin", userName: "Nataldo Costa", category: "ORGANIZACAO", action: "Desativou segmento", entity: "Luz para Todos (LUZ)", before: "Ativo", after: "Inativo a partir de 2025", year: 2024 },
];

export function seedDB(): DB {
  const s2024 = scenario(2024), s2025 = scenario(2025);
  return {
    version: 3,
    org: { companies: companies.map(c => ({ ...c })), segments: segments.map(s => ({ ...s })), regionals: regionals.map(r => ({ ...r })) },
    users: users.map(u => ({ ...u })),
    scenarios: [s2024, s2025],
    entries: { ...entries(s2024, 12), ...entries(s2025, 10) },
    audit: audit.map((a, i) => ({ ...a, id: `seed-${i}` })),
    activeYear: 2025,
    currentUserId: "u-admin",
    refDate: "2025-11-05",
  };
}
