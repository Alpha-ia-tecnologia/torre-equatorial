"use client";

import { useMemo, useState } from "react";
import { computePeriod, deadlineFor, deliveryStatus, fmtDate, months, pad, unitKey, type DeliveryStatus } from "./engine";
import { useTorre } from "./store";
import type { CalEvent, CalEventType, Indicator } from "./types";
import { Guarded, Modal, PageTitle, Status } from "./ui";

const typeInfo: Record<CalEventType, [string, string]> = { VALIDACAO: ["Validação", "green"], COMITE: ["Comitê", "purple"], LANCAMENTO: ["Lançamento de notas", "dark"], OUTRO: ["Reunião / outro", "blue"] };
type Deadline = { date: string; period: number; ind: Indicator; statuses: { co: string; seg: string; status: DeliveryStatus }[] };

export function useDeadlines() {
  const { db, scn } = useTorre();
  return useMemo(() => {
    const out: Deadline[] = [];
    for (let p = 1; p <= 12; p++) {
      const inds = scn.indicators.filter(i => i.kind === "BASE" && i.active);
      const values = computePeriod(db, scn, p);
      for (const ind of inds) {
        const statuses = [...values.values()].filter(v => v.ind === ind.code).map(v => ({ co: v.co, seg: v.seg, status: deliveryStatus(v, ind, scn, p, db.refDate) }));
        if (statuses.length) out.push({ date: deadlineFor(ind, scn.year, p), period: p, ind, statuses });
      }
    }
    return out;
  }, [db, scn]);
}

export const deadlineTone = (d: Deadline) => d.statuses.some(s => s.status === "ATRASADO") ? "red" : d.statuses.some(s => s.status === "VENCE") ? "amber" : d.statuses.every(s => ["APURADO", "APURADO_ATRASO", "HOMOLOGADO"].includes(s.status)) ? "green" : "blue";

export function Calendar() {
  const { db, scn, can, mutate, notify } = useTorre();
  const [cursor, setCursor] = useState({ y: +db.refDate.slice(0, 4), m: +db.refDate.slice(5, 7) });
  const [mode, setMode] = useState<"mes" | "lista">("mes");
  const [modal, setModal] = useState<null | { deadline: Deadline } | { event: CalEvent | null }>(null);
  const deadlines = useDeadlines();
  const prefix = `${cursor.y}-${pad(cursor.m)}`;
  const monthDeadlines = deadlines.filter(d => d.date.startsWith(prefix));
  const monthEvents = scn.events.filter(e => e.date.startsWith(prefix));
  const first = new Date(cursor.y, cursor.m - 1, 1).getDay();
  const daysIn = new Date(cursor.y, cursor.m, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + daysIn) / 7) * 7 }, (_, i) => i - first + 1);
  const move = (delta: number) => { const m = cursor.m + delta; setCursor({ y: cursor.y + Math.floor((m - 1) / 12), m: ((m - 1) % 12 + 12) % 12 + 1 }); };
  const upcoming = [...scn.events.map(e => ({ date: e.date, title: e.title, sub: `${typeInfo[e.type][0]} · período ${months[e.month - 1].toLowerCase()}` })),
    ...[...new Set(deadlines.map(d => d.date))].map(date => { const ds = deadlines.filter(d => d.date === date); return { date, title: `Deadline · ${ds.length} indicador(es)`, sub: `${ds.reduce((a, d) => a + d.statuses.filter(s => !["APURADO", "APURADO_ATRASO", "HOMOLOGADO"].includes(s.status)).length, 0)} entrega(s) pendente(s)` }; })]
    .filter(x => x.date >= db.refDate).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

  return <><PageTitle eyebrow="GOVERNANÇA DO PERÍODO" title="Calendário de apuração" desc="Deadlines por indicador, validações, comitês e lançamento das notas, com status automático."
    actions={<Guarded allowed={can.calendar} reason="Calendário editável por gestores e administradores." className="primary" onClick={() => setModal({ event: null })}>＋ Novo evento</Guarded>} />
    <div className="calendar-head"><button onClick={() => move(-1)}>‹</button><h2>{months[cursor.m - 1]} {cursor.y}</h2><button onClick={() => move(1)}>›</button><span></span>
      <label className="ref-date">Data de referência (simulação)<input type="date" value={db.refDate} onChange={e => { if (e.target.value) { mutate(d => { d.refDate = e.target.value; }); notify("Status de prazos recalculados para a nova data."); } }} /></label>
      <button onClick={() => setCursor({ y: +db.refDate.slice(0, 4), m: +db.refDate.slice(5, 7) })}>Hoje</button><button className={mode === "mes" ? "active" : ""} onClick={() => setMode("mes")}>Mês</button><button className={mode === "lista" ? "active" : ""} onClick={() => setMode("lista")}>Lista</button></div>
    {mode === "mes" ? <section className="calendar-grid">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => <b key={d}>{d}</b>)}{cells.map((day, i) => {
      const date = `${prefix}-${pad(day)}`, inMonth = day >= 1 && day <= daysIn;
      const ds = inMonth ? monthDeadlines.filter(d => d.date === date) : [], es = inMonth ? monthEvents.filter(e => e.date === date) : [];
      return <div className={!inMonth ? "muted" : date === db.refDate ? "today" : ""} key={i}><span>{inMonth ? day : ""}</span>
        {ds.map(d => <button key={`${d.ind.code}-${d.period}`} className={`event ${deadlineTone(d)}`} onClick={() => setModal({ deadline: d })} title={`${d.ind.name} · período ${months[d.period - 1]}`}>{d.ind.code} {d.ind.name}</button>)}
        {es.map(e => <button key={e.id} className={`event ${typeInfo[e.type][1]}`} onClick={() => setModal({ event: e })}>{e.title}</button>)}
      </div>;
    })}</section> : <section className="table-panel"><table><thead><tr><th>Data</th><th>Tipo</th><th>Item</th><th>Período</th><th>Situação</th></tr></thead><tbody>
      {[...monthDeadlines.map(d => ({ date: d.date, key: `${d.ind.code}-${d.period}`, type: "Deadline", title: `${d.ind.code} · ${d.ind.name}`, period: d.period, sit: `${d.statuses.filter(s => s.status === "ATRASADO").length} atrasada(s) · ${d.statuses.filter(s => ["APURADO", "APURADO_ATRASO", "HOMOLOGADO"].includes(s.status)).length}/${d.statuses.length} entregue(s)`, open: () => setModal({ deadline: d }) })),
        ...monthEvents.map(e => ({ date: e.date, key: e.id, type: typeInfo[e.type][0], title: e.title, period: e.month, sit: db.users.find(u => u.id === e.ownerId)?.name ?? "—", open: () => setModal({ event: e }) }))]
        .sort((a, b) => a.date.localeCompare(b.date)).map(x => <tr key={x.key} className="clickable" onClick={x.open}><td>{fmtDate(x.date)}</td><td><span className="audit-action">{x.type}</span></td><td>{x.title}</td><td>{months[x.period - 1]}</td><td>{x.sit}</td></tr>)}</tbody></table></section>}
    <div className="calendar-legend"><span><i className="red"></i>Prazo vencido com pendência</span><span><i className="amber"></i>Vence em até 2 dias</span><span><i className="blue"></i>No prazo</span><span><i className="green"></i>Todas as entregas feitas</span></div>
    <div className="calendar-summary">{upcoming.map(u => <article key={u.date + u.title}><span>{fmtDate(u.date)}</span><h3>{u.title}</h3><p>{u.sub}</p></article>)}</div>
    {modal && "deadline" in modal && <DeadlineModal d={modal.deadline} onClose={() => setModal(null)} />}
    {modal && "event" in modal && <EventModal event={modal.event} onClose={() => setModal(null)} />}
  </>;
}

function DeadlineModal({ d, onClose }: { d: Deadline; onClose: () => void }) {
  const { db, scn, can, mutate, notify, go, setFocus, setMonth } = useTorre();
  const [day, setDay] = useState(d.ind.deadlineDay);
  const name = (id: string) => db.users.find(u => u.id === id)?.name ?? "—";
  const segName = (s: string) => db.org.segments.find(x => x.code === s)?.name ?? s;
  return <Modal wide eyebrow={`DEADLINE · PERÍODO ${months[d.period - 1].toUpperCase()}/${scn.year}`} title={`${d.ind.code} · ${d.ind.name}`} subtitle={`Entrega até ${fmtDate(d.date)} · responsável ${name(d.ind.ownerId)} · apuradores ${d.ind.apuradorIds.map(name).join(", ") || "—"}`} onClose={onClose}
    actions={<><button onClick={onClose}>Fechar</button><button className="primary" onClick={() => { setMonth(d.period); setFocus({ search: d.ind.name }); go("apuracao"); onClose(); }}>Abrir na apuração</button></>}>
    <div className="table-scroll short"><table className="mini-table"><thead><tr><th>Unidade</th><th>Área</th><th>Status em {fmtDate(db.refDate)}</th></tr></thead><tbody>{d.statuses.map(s => <tr key={unitKey(d.ind.code, s.co, s.seg)}><td>{s.co}</td><td>{segName(s.seg)}</td><td><Status status={s.status} /></td></tr>)}</tbody></table></div>
    <div className="engine-form"><label>Regra de prazo deste indicador (dia do mês seguinte)<input type="number" min="1" max="28" value={day} disabled={!can.calendar} onChange={e => setDay(Math.min(28, Math.max(1, +e.target.value)))} /></label>
      {can.calendar && <button className="row-action align-end" disabled={day === d.ind.deadlineDay} onClick={() => { mutate(x => { x.scenarios.find(s => s.year === scn.year)!.indicators.find(i => i.code === d.ind.code)!.deadlineDay = day; }, { category: "CALENDARIO", action: "Alterou prazo do indicador", entity: `${d.ind.code} ${d.ind.name}`, before: `Dia ${d.ind.deadlineDay}`, after: `Dia ${day}` }); notify("Prazo atualizado; status recalculados."); onClose(); }}>Salvar prazo</button>}</div>
  </Modal>;
}

function EventModal({ event, onClose }: { event: CalEvent | null; onClose: () => void }) {
  const { db, scn, can, mutate, notify } = useTorre();
  const [draft, setDraft] = useState<CalEvent>(() => event ?? { id: `ev-${Date.now().toString(36)}`, date: db.refDate, type: "COMITE", title: "", month: Math.max(1, +db.refDate.slice(5, 7) - 1), ownerId: db.currentUserId });
  const save = () => { mutate(d => { const s = d.scenarios.find(x => x.year === scn.year)!; const i = s.events.findIndex(e => e.id === draft.id); if (i >= 0) s.events[i] = draft; else s.events.push(draft); }, { category: "CALENDARIO", action: event ? "Alterou evento" : "Criou evento", entity: draft.title, before: event ? fmtDate(event.date) : undefined, after: `${typeInfo[draft.type][0]} · ${fmtDate(draft.date)}` }); notify("Calendário atualizado."); onClose(); };
  const remove = () => { mutate(d => { const s = d.scenarios.find(x => x.year === scn.year)!; s.events = s.events.filter(e => e.id !== draft.id); }, { category: "CALENDARIO", action: "Removeu evento", entity: draft.title, before: fmtDate(draft.date) }); notify("Evento removido."); onClose(); };
  return <Modal eyebrow="CALENDÁRIO" title={event ? "Evento do calendário" : "Novo evento"} onClose={onClose}
    actions={<>{event && can.calendar && <button onClick={remove}>Remover</button>}<button onClick={onClose}>Cancelar</button>{can.calendar && <button className="primary" disabled={!draft.title.trim()} onClick={save}>Salvar</button>}</>}>
    <div className="engine-form"><label>Tipo<select value={draft.type} disabled={!can.calendar} onChange={e => setDraft({ ...draft, type: e.target.value as CalEventType })}>{Object.entries(typeInfo).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="span-2">Título<input value={draft.title} disabled={!can.calendar} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      <label>Data<input type="date" value={draft.date} disabled={!can.calendar} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
      <label>Período avaliado<select value={draft.month} disabled={!can.calendar} onChange={e => setDraft({ ...draft, month: +e.target.value })}>{months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
      <label>Responsável<select value={draft.ownerId} disabled={!can.calendar} onChange={e => setDraft({ ...draft, ownerId: e.target.value })}>{db.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label></div>
  </Modal>;
}
