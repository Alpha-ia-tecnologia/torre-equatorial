"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { computePeriod, consolidate, validateScenario, type Issue, type MetaCalc, type PeriodValues } from "./engine";
import { seedDB } from "./seed";
import type { AuditCategory, DB, Indicator, Meta, Scenario, User, View, WeightView } from "./types";

const STORAGE_KEY = "torre-demo-db";

export type AuditInput = { category: AuditCategory; action: string; entity: string; before?: string; after?: string };
type Toast = { id: number; message: string; tone: "ok" | "warn" | "err" };

export type Permissions = {
  structure: boolean; access: boolean; closePeriod: boolean; calendar: boolean; importValues: boolean;
  editValue: (ind: Indicator, co: string, field: "planned" | "actual", month: number) => boolean;
};

export function permissions(user: User, scn: Scenario): Permissions {
  const admin = user.role === "ADMIN";
  const open = scn.status !== "ENCERRADO";
  return {
    structure: admin && open,
    access: admin,
    closePeriod: open && (admin || user.role === "GESTOR"),
    calendar: open && (admin || user.role === "GESTOR"),
    importValues: open && (admin || user.role === "APURADOR"),
    editValue(ind, co, field, month) {
      if (!open || scn.closedMonths.includes(month) || ind.kind === "DEPENDENTE") return false;
      if (admin) return true;
      if (user.role !== "APURADOR") return false;
      if (ind.ownerId === user.id) return true;
      return field === "actual" && ind.apuradorIds.includes(user.id) && (user.companies.includes("*") || user.companies.includes(co));
    },
  };
}

export const roleLabel: Record<User["role"], string> = { ADMIN: "Administrador da Torre", GESTOR: "Gestor", APURADOR: "Apurador / responsável", CONSULTA: "Consulta" };

type Ctx = {
  db: DB; scn: Scenario; user: User; can: Permissions;
  mutate: (fn: (draft: DB) => void, audit?: AuditInput | AuditInput[]) => void;
  notify: (message: string, tone?: Toast["tone"]) => void;
  reset: () => void;
  view: View; go: (v: View) => void;
  month: number; setMonth: (m: number) => void;
  company: string; setCompany: (c: string) => void;
  weightView: WeightView; setWeightView: (v: WeightView) => void;
  meta: Meta; setMetaId: (id: string) => void;
  values: PeriodValues; calc: MetaCalc | null; issues: Issue[];
  /** Busca/atalho entre telas, ex.: pendência que abre a apuração filtrada. */
  focus: { search?: string; status?: string } | null; setFocus: (f: Ctx["focus"]) => void;
};

const TorreContext = createContext<Ctx | null>(null);
export const useTorre = () => useContext(TorreContext)!;

export function lastMonthWithData(db: DB, year: number) {
  let last = 0;
  for (const key of Object.keys(db.entries)) {
    const [y, m] = key.split("|");
    if (+y === year && +m > last && db.entries[key].actual !== null) last = +m;
  }
  return last || 1;
}

export function TorreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(seedDB);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [view, setView] = useState<View>("visao");
  const [month, setMonth] = useState(10);
  const [company, setCompany] = useState("Todas");
  const [weightView, setWeightView] = useState<WeightView>("ELEGIVEL");
  const [metaId, setMetaId] = useState("");
  const [focus, setFocus] = useState<Ctx["focus"]>(null);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const stored = raw ? JSON.parse(raw) as DB : null;
      // Hidratação após a montagem: o servidor sempre renderiza a base padrão.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored?.version === seedDB().version) { setDb(stored); setMonth(lastMonthWithData(stored, stored.activeYear)); }
    } catch { /* base de demonstração padrão */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* armazenamento indisponível */ }
  }, [db]);

  const notify = useCallback((message: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts(xs => [...xs, { id, message, tone }]);
    setTimeout(() => setToasts(xs => xs.filter(t => t.id !== id)), 3200);
  }, []);

  const mutate = useCallback((fn: (draft: DB) => void, audit?: AuditInput | AuditInput[]) => {
    setDb(prev => {
      const next = structuredClone(prev);
      fn(next);
      const user = next.users.find(u => u.id === next.currentUserId)!;
      for (const a of audit ? [audit].flat() : []) {
        next.audit.unshift({ ...a, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), userId: user.id, userName: user.name, year: next.activeYear });
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const fresh = seedDB();
    setDb(fresh); setMonth(10); setCompany("Todas"); setMetaId(""); setView("visao");
    notify("Base de demonstração restaurada.");
  }, [notify]);

  const scn = db.scenarios.find(s => s.year === db.activeYear) ?? db.scenarios[0];
  const user = db.users.find(u => u.id === db.currentUserId) ?? db.users[0];
  const meta = scn.metas.find(m => m.id === metaId) ?? scn.metas.find(m => m.active) ?? scn.metas[0];
  const can = useMemo(() => permissions(user, scn), [user, scn]);
  const values = useMemo(() => computePeriod(db, scn, month), [db, scn, month]);
  const calc = useMemo(() => meta ? consolidate(db, scn, meta, weightView, values) : null, [db, scn, meta, weightView, values]);
  const issues = useMemo(() => validateScenario(db, scn, month, values), [db, scn, month, values]);

  const ctx: Ctx = {
    db, scn, user, can, mutate, notify, reset, view, go: setView, month, setMonth, company, setCompany,
    weightView, setWeightView, meta, setMetaId, values, calc, issues, focus, setFocus,
  };
  return <TorreContext.Provider value={ctx}>
    {children}
    <div className="toast-stack" aria-live="polite">{toasts.map(t => <div key={t.id} className={`toast ${t.tone}`}>{t.tone === "ok" ? "✓" : "!"} {t.message}</div>)}</div>
  </TorreContext.Provider>;
}
