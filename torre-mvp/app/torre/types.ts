export type View = "visao" | "apuracao" | "estrutura" | "reguas" | "governanca" | "calendario" | "relatorios" | "auditoria";
export type Polarity = "MAIOR" | "MENOR";
export type Role = "ADMIN" | "GESTOR" | "APURADOR" | "CONSULTA";
export type WeightView = "ELEGIVEL" | "ENGENHARIA" | "OBRAS" | "SUPER";

export type Company = { id: string; name: string; active: boolean; since: string; inactiveSince?: string };
export type Segment = { code: string; name: string; active: boolean };
export type Regional = { id: string; company: string; code: string; name: string; active: boolean };

export type User = { id: string; name: string; role: Role; companies: string[]; active: boolean };

/** Régua: notas fixas 1 (mínimo), 10 (meta) e 15 (desafio), com interpolação linear entre os pontos. */
export type RuleParams = { min: number; target: number; challenge: number };
export type Rule = RuleParams & {
  code: string; name: string; polarity: Polarity; active: boolean;
  /** ATINGIMENTO = realizado ÷ previsto × 100; VALOR = o próprio realizado. */
  base: "ATINGIMENTO" | "VALOR";
  /** Nota abaixo do mínimo (piso) e acima do desafio (teto ou extrapolação). */
  floor: 0 | 1; ceiling: "TETO" | "EXTRAPOLAR";
  overrides: Record<string, RuleParams>;
  history: { at: string; by: string; summary: string }[];
};

export type Indicator = {
  code: string; name: string; unit: string; areas: string[];
  kind: "BASE" | "DEPENDENTE";
  /** Fórmulas de indicadores dependentes, ex.: realizado[04] / realizado[03] * 100 */
  formulaActual?: string; formulaPlanned?: string;
  defaultRule: string; ownerId: string; apuradorIds: string[];
  /** Dia do mês seguinte ao período em que o resultado deve ser entregue. */
  deadlineDay: number;
  /** Ponderação das áreas na consolidação do indicador. */
  areaWeighting: "SEGMENTO" | "VALOR_REFERENCIA";
  piDetail: boolean; active: boolean;
};

export type TreeNode =
  | { id: string; kind: "INDEX"; name: string; description: string; weight: number; children: TreeNode[] }
  | { id: string; kind: "INDICATOR"; indicator: string; rule: string; weight: number };

export type Meta = { id: string; name: string; roles: string[]; areas: string[]; active: boolean; children: TreeNode[] };

export type WeightSet = { companies: Record<string, number>; segments: Record<string, Record<string, number>> };

export type CalEventType = "VALIDACAO" | "COMITE" | "LANCAMENTO" | "OUTRO";
export type CalEvent = { id: string; date: string; type: CalEventType; title: string; month: number; ownerId?: string };

export type ScenarioStatus = "ATIVO" | "RASCUNHO" | "ENCERRADO";
export type Scenario = {
  year: number; status: ScenarioStatus; version: number; createdFrom: number | null; publishedAt: string | null;
  metas: Meta[]; indicators: Indicator[]; rules: Rule[];
  /** Apenas combinações não elegíveis são gravadas: `${indicador}|${distribuidora}` → false */
  eligibility: Record<string, boolean>;
  weights: Record<WeightView, WeightSet>;
  regionalWeights: Record<string, Record<string, number>>;
  events: CalEvent[]; closedMonths: number[];
};

export type PiRow = { pi: string; name: string; planned: number; actual: number | null };
export type Entry = { planned: number | null; actual: number | null; deliveredOn: string | null; note?: string; pis?: PiRow[] };

export type AuditCategory = "VALOR" | "ESTRUTURA" | "REGUA" | "PESO" | "IMPORTACAO" | "CENARIO" | "ACESSO" | "ORGANIZACAO" | "CALENDARIO";
export type AuditEvent = {
  id: string; at: string; userId: string; userName: string; category: AuditCategory;
  action: string; entity: string; before?: string; after?: string; year: number;
};

export type DB = {
  version: number;
  org: { companies: Company[]; segments: Segment[]; regionals: Regional[] };
  users: User[];
  scenarios: Scenario[];
  /** Chave `${ano}|${mês}|${indicador}|${distribuidora}|${segmento}` */
  entries: Record<string, Entry>;
  audit: AuditEvent[];
  activeYear: number;
  currentUserId: string;
  /** Data simulada usada para prazos e status ("hoje" da demonstração). */
  refDate: string;
};
