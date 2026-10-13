import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { JOURS, mondayOf, dayKeyOf, addDaysStr } from "../../lib/scheduleUtils.js";
import { subjectAccent, subjectLabel, itemLabel } from "../../lib/subjectMapping.js";

const COURS_COLOR = "#94A3B8";
const EVENEMENT_COLOR = "#7C3AED";
const CB_COLOR = "#DC2626";
const MAX_ITEMS = 3;

// Vue mensuelle de l'Agenda : un aperçu compact du mois (façon Google Calendar),
// avec au plus quelques éléments par jour + "+N autres" — le détail précis reste
// la vue Semaine. Clic sur un jour → bascule sur la semaine correspondante.
export function MonthGrid({ monthRef, onSelectDay }) {
  const { data, today } = useCarnet();

  const seanceMap = new Map(data.seances.map((s) => [`${s.creneauId}|${s.semaine}`, s]));

  const [y, m] = monthRef.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthEnd = `${monthRef.slice(0, 7)}-${String(daysInMonth).padStart(2, "0")}`;
  const gridStart = mondayOf(monthRef);
  const gridEnd = addDaysStr(mondayOf(monthEnd), 6);

  const dates = [];
  for (let d = gridStart; d <= gridEnd; d = addDaysStr(d, 1)) dates.push(d);
  const weeks = [];
  for (let i = 0; i < dates.length; i += 7) weeks.push(dates.slice(i, i + 7));

  const itemsForDate = (dateStr) => {
    const dk = dayKeyOf(dateStr);
    const monday = mondayOf(dateStr);
    const items = [];

    for (const ep of data.epreuves_cb) {
      if (ep.date !== dateStr) continue;
      items.push({ kind: "cb", id: ep.id, debut: ep.debut, label: `${ep.cbNom} · ${subjectLabel(ep.matiere)}`, color: CB_COLOR });
    }
    for (const k of data.colles) {
      if (k.date !== dateStr) continue;
      items.push({ kind: "colle", id: k.id, debut: k.heure, label: `Colle ${subjectLabel(k.matiere)}`, color: subjectAccent(k.matiere) });
    }
    for (const c of data.emploi_du_temps.creneaux) {
      if (c.jour !== dk) continue;
      const seance = seanceMap.get(`${c.id}|${monday}`);
      if (seance?.statut === "annule") continue;
      const isCours = c.type === "cours";
      const matiereEffective = !isCours && seance?.matiereReelle ? seance.matiereReelle : c.matiere;
      const color = isCours ? COURS_COLOR : subjectAccent(matiereEffective);
      items.push({
        kind: "creneau",
        id: c.id,
        debut: c.debut,
        label: isCours ? "Cours" : itemLabel(c.matiere, c.theme, c.titre),
        color,
      });
    }
    for (const s of data.sessions_ponctuelles) {
      if (s.date !== dateStr) continue;
      items.push({ kind: "session", id: s.id, debut: s.debut, label: itemLabel(s.matiere, s.theme, s.titre), color: subjectAccent(s.matiere) });
    }
    for (const e of data.evenements_uniques) {
      if (e.date !== dateStr) continue;
      items.push({ kind: "evenement", id: e.id, debut: e.debut, label: e.titre, color: EVENEMENT_COLOR });
    }

    const priorite = { cb: 0, colle: 1 };
    items.sort((a, b) => {
      const pa = priorite[a.kind] ?? 2;
      const pb = priorite[b.kind] ?? 2;
      if (pa !== pb) return pa - pb;
      return (a.debut || "").localeCompare(b.debut || "");
    });
    return items;
  };

  return html`
    <div>
      <div class="grid grid-cols-7 gap-px mb-1">
        ${JOURS.map((j) => html`<div key=${j.key} class="text-center text-xs font-medium text-slate-500 py-1">${j.label}</div>`)}
      </div>
      <div class="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
        ${weeks.map((week) =>
          week.map((dateStr) => {
            const inMonth = dateStr.slice(0, 7) === monthRef.slice(0, 7);
            const isToday = dateStr === today;
            const dayNum = Number(dateStr.slice(8, 10));
            const items = itemsForDate(dateStr);
            const hasCB = items.some((it) => it.kind === "cb");
            const visible = items.slice(0, MAX_ITEMS);
            const extra = items.length - visible.length;

            const cellClass = hasCB
              ? "bg-red-50"
              : inMonth
                ? "bg-white"
                : "bg-slate-50";
            const numClass = hasCB
              ? "text-red-600 font-semibold"
              : !inMonth
                ? "text-slate-300"
                : isToday
                  ? "text-slate-900 font-semibold"
                  : "text-slate-500";

            return html`
              <button
                key=${dateStr}
                class=${`min-h-[5.5rem] p-1 text-left align-top hover:bg-slate-50 transition-colors ${cellClass} ${
                  isToday ? "ring-2 ring-inset ring-slate-900" : ""
                }`}
                onClick=${() => onSelectDay(dateStr)}
              >
                <p class=${`text-[11px] mb-0.5 ${numClass}`}>${dayNum}</p>
                <div class="space-y-0.5">
                  ${visible.map(
                    (it) => html`
                      <p key=${it.id} class="flex items-center gap-1 text-[10px] leading-tight truncate">
                        <span class="h-1.5 w-1.5 rounded-full shrink-0" style=${{ backgroundColor: it.color }}></span>
                        <span class=${`truncate ${it.kind === "cb" ? "text-red-700 font-medium" : "text-slate-600"}`}>${it.label}</span>
                      </p>
                    `
                  )}
                  ${extra > 0 && html`<p class="text-[10px] text-slate-400">+${extra} autre${extra > 1 ? "s" : ""}</p>`}
                </div>
              </button>
            `;
          })
        )}
      </div>
    </div>
  `;
}
