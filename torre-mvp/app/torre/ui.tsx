"use client";

import { fmt, months, statusLabel, weightViews, type DeliveryStatus } from "./engine";
import { useTorre } from "./store";
import type { WeightView } from "./types";

export function PageTitle({ eyebrow, title, desc, actions }: { eyebrow: string; title: string; desc: string; actions?: React.ReactNode }) {
  return <div className="page-title"><div><span>{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function Modal({ eyebrow, title, subtitle, onClose, children, actions, wide }: { eyebrow: string; title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className={`modal engine-modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()}>
    <div className="modal-head"><div><span>{eyebrow}</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button aria-label="Fechar" onClick={onClose}>×</button></div>
    {children}
    {actions && <div className="modal-actions">{actions}</div>}
  </section></div>;
}

export function Drawer({ eyebrow, title, subtitle, onClose, children, actions }: { eyebrow: string; title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="drawer indicator-detail" role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()}>
    <div className="modal-head"><div><span>{eyebrow}</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button aria-label="Fechar" onClick={onClose}>×</button></div>
    {children}
    {actions && <div className="drawer-actions">{actions}</div>}
  </aside></div>;
}

export const Score = ({ value, onClick }: { value: number | null; onClick?: () => void }) =>
  <button className={`score-pill ${value === null ? "none" : value >= 10 ? "good" : value >= 7 ? "mid" : "bad"}`} onClick={onClick} disabled={!onClick}>{value === null ? "—" : fmt(value, 2)}</button>;

export const Status = ({ status }: { status: DeliveryStatus }) => <span className={`status ${statusLabel[status][1]}`}><i></i>{statusLabel[status][0]}</span>;

export const initials = (name: string) => name.split(" ").map(x => x[0]).join("").slice(0, 2);
export const Owner = ({ name }: { name: string }) => <div className="person"><i>{initials(name)}</i><span>{name}</span></div>;

/** Botão que explica por que a ação está bloqueada para o perfil atual (RF-14). */
export function Guarded({ allowed, reason, className, onClick, children }: { allowed: boolean; reason: string; className?: string; onClick: () => void; children: React.ReactNode }) {
  const { notify } = useTorre();
  return <button className={`${className ?? ""} ${allowed ? "" : "locked"}`} title={allowed ? undefined : reason} onClick={() => allowed ? onClick() : notify(reason, "warn")}>{!allowed && <span aria-hidden="true">🔒 </span>}{children}</button>;
}

type FilterKey = "month" | "company" | "meta" | "view" | "segment";
export function Filters({ show = ["month", "company", "meta", "view"], segment, setSegment }: { show?: FilterKey[]; segment?: string; setSegment?: (s: string) => void }) {
  const { db, scn, month, setMonth, company, setCompany, meta, setMetaId, weightView, setWeightView } = useTorre();
  return <div className="filters">
    <label>Ano<select value={scn.year} disabled><option>{scn.year}</option></select></label>
    {show.includes("month") && <label>Período<select value={month} onChange={e => setMonth(+e.target.value)}>{months.map((m, i) => <option key={m} value={i + 1}>{m}{scn.closedMonths.includes(i + 1) ? " · fechado" : ""}</option>)}</select></label>}
    {show.includes("company") && <label>Distribuidora<select value={company} onChange={e => setCompany(e.target.value)}><option value="Todas">Todas</option>{db.org.companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.active ? "" : " (inativa)"}</option>)}</select></label>}
    {show.includes("meta") && <label>Meta<select value={meta?.id} onChange={e => setMetaId(e.target.value)}>{scn.metas.map(m => <option key={m.id} value={m.id}>{m.name}{m.active ? "" : " (inativa)"}</option>)}</select></label>}
    {show.includes("view") && <label>Visão de pesos<select value={weightView} onChange={e => setWeightView(e.target.value as WeightView)}>{weightViews.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
    {show.includes("segment") && setSegment && <label>Área<select value={segment} onChange={e => setSegment(e.target.value)}><option value="Todas">Todas</option>{db.org.segments.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>}
  </div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
