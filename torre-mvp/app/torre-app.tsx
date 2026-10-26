"use client";

import { useState } from "react";
import { Assessment } from "./torre/assessment";
import { Audit } from "./torre/audit";
import { Calendar, useDeadlines } from "./torre/calendar";
import { Dashboard, ValidationModal } from "./torre/dashboard";
import { daysBetween, fmtDate, months } from "./torre/engine";
import { Governance } from "./torre/governance";
import { Reports } from "./torre/reports";
import { Rules } from "./torre/rules";
import { lastMonthWithData, roleLabel, TorreProvider, useTorre } from "./torre/store";
import { Structure } from "./torre/structure";
import type { View } from "./torre/types";
import { Guarded, initials } from "./torre/ui";

const nav: [View, string, string][] = [
  ["visao", "Visão geral", "⌂"], ["apuracao", "Apuração", "◫"], ["estrutura", "Estrutura", "⌘"],
  ["reguas", "Réguas e pesos", "⌁"], ["governanca", "Governança", "◇"], ["calendario", "Calendário", "◷"],
  ["relatorios", "Relatórios", "▥"], ["auditoria", "Auditoria", "◎"],
];

export default function TorreApp() {
  return <TorreProvider><Shell /></TorreProvider>;
}

/** Alertas de prazo próximos e vencidos para o usuário atual (RF-10.8). */
function useNotifications() {
  const { db, scn, user } = useTorre();
  const deadlines = useDeadlines();
  const sees = (ownerId: string, apuradores: string[], co: string) => user.role === "ADMIN" || user.role === "GESTOR" || ownerId === user.id || (apuradores.includes(user.id) && (user.companies.includes("*") || user.companies.includes(co)));
  const items = deadlines.flatMap(d => {
    const mine = d.statuses.filter(s => (s.status === "ATRASADO" || s.status === "VENCE") && sees(d.ind.ownerId, d.ind.apuradorIds, s.co));
    if (!mine.length) return [];
    const late = mine.some(s => s.status === "ATRASADO");
    return [{ key: `${d.ind.code}-${d.period}`, tone: late ? "red" : "amber", title: `${d.ind.code} · ${d.ind.name}`, sub: `${late ? "Vencido" : "Vence"} em ${fmtDate(d.date)} · ${[...new Set(mine.map(s => s.co))].join(", ")} · período ${months[d.period - 1].toLowerCase()}`, search: d.ind.name, period: d.period }];
  });
  const events = scn.events.filter(e => { const n = daysBetween(db.refDate, e.date); return n >= 0 && n <= 7 && (user.role === "ADMIN" || user.role === "GESTOR" || e.ownerId === user.id); })
    .map(e => ({ key: e.id, tone: "blue", title: e.title, sub: `${fmtDate(e.date)} · em ${daysBetween(db.refDate, e.date)} dia(s)`, search: undefined, period: e.month }));
  return [...items, ...events];
}

function Shell() {
  const { db, scn, user, view, go, issues, mutate, reset, setMetaId, setMonth, setFocus, can } = useTorre();
  const [bell, setBell] = useState(false);
  const [validate, setValidate] = useState(false);
  const notes = useNotifications();
  const errors = issues.filter(i => i.level === "erro").length;

  function switchYear(year: number) {
    mutate(d => { d.activeYear = year; });
    setMetaId(""); setMonth(lastMonthWithData(db, year));
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">T</div><div><strong>TORRE</strong><span>Investimentos</span></div></div>
      <label className="context"><span>CENÁRIO ATIVO</span><select value={scn.year} onChange={e => switchYear(+e.target.value)}>{[...db.scenarios].sort((a, b) => b.year - a.year).map(s => <option key={s.year} value={s.year}>Apuração {s.year}</option>)}</select><small className={scn.status.toLowerCase()}>{scn.status === "ATIVO" ? "Em andamento" : scn.status === "RASCUNHO" ? "Rascunho em preparação" : "Encerrado · somente leitura"} · v{scn.version}</small></label>
      <nav>{nav.map(([id, label, icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => go(id)}><i>{icon}</i>{label}</button>)}</nav>
      <div className="sidebar-bottom">
        <button className="health" onClick={() => setValidate(true)}><span className={`dot ${errors ? "bad" : ""}`}></span><div><strong>{errors ? `${errors} inconsistência(s)` : "Modelo consistente"}</strong><small>{errors ? "Clique para revisar antes do fechamento" : "Pesos, réguas e fórmulas validados"}</small></div></button>
        <div className="profile"><span>{initials(user.name)}</span><div><strong>{user.name}</strong><small>{roleLabel[user.role]}</small></div><button title="Restaurar base de demonstração" onClick={() => { if (confirm("Restaurar a base de demonstração? As alterações feitas neste navegador serão perdidas.")) reset(); }}>↺</button></div>
      </div>
    </aside>
    <main>
      <header className="topbar">
        <div className="breadcrumb"><span>Torre de Investimentos</span><b>/</b><strong>{nav.find(n => n[0] === view)?.[1]}</strong></div>
        <div className="top-actions">
          <button className="ref-chip" title="Data simulada usada para prazos e status" onClick={() => go("calendario")}>◷ Hoje: {fmtDate(db.refDate)}</button>
          <label className="user-switch" title="Simular outro usuário para demonstrar permissões"><span>Usuário</span><select value={user.id} onChange={e => mutate(d => { d.currentUserId = e.target.value; })}>{db.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.name} · {roleLabel[u.role]}</option>)}</select></label>
          <div className="bell-wrap"><button className="icon-button" aria-label="Notificações" onClick={() => setBell(!bell)}>♢{notes.length > 0 && <em>{notes.length}</em>}</button>
            {bell && <div className="notifications" onMouseLeave={() => setBell(false)}><header><strong>Alertas de prazo</strong><small>{user.name} · ref. {fmtDate(db.refDate)}</small></header>
              {notes.length ? notes.map(n => <button key={n.key} className={n.tone} onClick={() => { setBell(false); setMonth(n.period); if (n.search) { setFocus({ search: n.search }); go("apuracao"); } else go("calendario"); }}><i></i><span><b>{n.title}</b><small>{n.sub}</small></span></button>) : <p>Nenhum alerta para você.</p>}</div>}
          </div>
          <Guarded allowed={can.importValues} reason="Seu perfil não lança resultados." className="primary" onClick={() => { setFocus({ status: "PENDENTES" }); go("apuracao"); }}>＋ Lançar resultado</Guarded>
        </div>
      </header>
      <div className="content" key={`${view}-${scn.year}`}>
        {scn.status === "ENCERRADO" && <div className="banner info">Cenário {scn.year} encerrado: histórico preservado e independente dos demais anos (somente leitura).</div>}
        {view === "visao" && <Dashboard />}
        {view === "apuracao" && <Assessment />}
        {view === "estrutura" && <Structure />}
        {view === "reguas" && <Rules />}
        {view === "governanca" && <Governance />}
        {view === "calendario" && <Calendar />}
        {view === "relatorios" && <Reports />}
        {view === "auditoria" && <Audit />}
      </div>
    </main>
    {validate && <ValidationModal onClose={() => setValidate(false)} />}
  </div>;
}
