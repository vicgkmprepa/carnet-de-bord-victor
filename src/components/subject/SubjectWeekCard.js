import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import {
  JOURS,
  mondayOf,
  addDaysStr,
  dayKeyOf,
  durationMinutes,
  formatDuration,
  formatWeekRangeFr,
} from "../../lib/scheduleUtils.js";
import { itemLabel } from "../../lib/subjectMapping.js";
import { colleHoraires, collesRealisees } from "../../lib/colleUtils.js";

const COURS_COLOR = "#94A3B8";

// Bandeau compact en haut de l'onglet matière : cours suivis + travail perso
// (créneaux récurrents réalisés + sessions ponctuelles) filtrés sur cette seule
// matière. En jours glissants (pas calé lundi-dimanche) : 7 jours à partir d'un
// point de départ quelconque (aujourd'hui par défaut), qui avance jour par jour.
export function SubjectWeekCard({ tab }) {
  const { data, today } = useCarnet();
  const [startDate, setStartDate] = useState(() => today);
  const [statsMonday, setStatsMonday] = useState(() => mondayOf(today));
  const isCurrentWindow = startDate === today;
  const isCurrentStatsWeek = statsMonday === mondayOf(today);
  const days = Array.from({ length: 7 }, (_, i) => addDaysStr(startDate, i));
  const joursSuivants = Array.from({ length: 7 }, (_, i) => addDaysStr(startDate, 7 + i));
  const todayKey = days.includes(today) ? dayKeyOf(today) : null;

  const creneauxMatiere = data.emploi_du_temps.creneaux.filter((c) => c.matiere === tab.key);
  // Une fenêtre de 7 jours consécutifs contient chaque jour de la semaine une
  // seule fois, même à cheval sur deux semaines calendaires — donc chaque
  // créneau récurrent n'a besoin que de la séance de SA propre semaine.
  const seancesByCreneauId = new Map();
  for (const d of days) {
    const semaine = mondayOf(d);
    const jour = dayKeyOf(d);
    for (const s of data.seances) {
      if (s.semaine !== semaine) continue;
      const c = creneauxMatiere.find((cc) => cc.id === s.creneauId);
      if (c && c.jour === jour) seancesByCreneauId.set(s.creneauId, s);
    }
  }
  const sessionsSemaine = data.sessions_ponctuelles.filter((s) => s.matiere === tab.key && days.includes(s.date));
  const collesSemaine = data.colles
    .filter((k) => k.matiere === tab.key && days.includes(k.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));

  // Les colles sont déjà mises en évidence directement dans les cases du
  // mini-agenda (fond ambre) — inutile de dupliquer l'info dans un bandeau texte.

  // Épreuves de CB de cette matière — alerte une semaine à l'avance (dans les 7
  // jours suivant la fenêtre affichée) et pendant la fenêtre elle-même, sur le
  // même principe que l'alerte colle mais en rouge (plus lourd, révisions à
  // caler en amont).
  const epreuvesSemaine = data.epreuves_cb
    .filter((ep) => tab.cbMatieres.includes(ep.matiere) && days.includes(ep.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.debut.localeCompare(b.debut));
  const epreuvesSemaineSuivante = data.epreuves_cb
    .filter((ep) => tab.cbMatieres.includes(ep.matiere) && joursSuivants.includes(ep.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.debut.localeCompare(b.debut));

  const formatEpreuves = (eps) =>
    eps.map((ep) => `${ep.cbNom} · ${JOURS.find((j) => j.key === dayKeyOf(ep.date))?.full || ""} ${ep.debut}`).join(", ");

  const cbAlertTexte = epreuvesSemaine.length
    ? `🔴 Attention, épreuve de CB ${tab.label} ${isCurrentWindow ? "cette semaine" : "sur cette période"} — ${formatEpreuves(epreuvesSemaine)}`
    : epreuvesSemaineSuivante.length
      ? `🔴 Attention, épreuve de CB ${tab.label} bientôt — ${formatEpreuves(epreuvesSemaineSuivante)}`
      : null;
  const cbAlert =
    cbAlertTexte &&
    html`<div class="mb-2 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs font-medium inline-block">${cbAlertTexte}</div>`;

  // Comptage du temps — sur une semaine calendaire fixe (lundi à dimanche),
  // naviguable indépendamment de la fenêtre glissante affichée dans la grille
  // de jours ci-dessous (semaine courante par défaut).
  const weekMonday = statsMonday;
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysStr(weekMonday, i));
  const seancesByCreneauIdWeek = new Map();
  for (const d of weekDays) {
    const semaine = mondayOf(d);
    const jour = dayKeyOf(d);
    for (const s of data.seances) {
      if (s.semaine !== semaine) continue;
      const c = creneauxMatiere.find((cc) => cc.id === s.creneauId);
      if (c && c.jour === jour) seancesByCreneauIdWeek.set(s.creneauId, s);
    }
  }
  const sessionsSemaineFixe = data.sessions_ponctuelles.filter((s) => s.matiere === tab.key && weekDays.includes(s.date));

  let minutesCours = 0;
  let minutesTravailPlanifie = 0;
  let minutesTravailRealise = 0;
  for (const d of weekDays) {
    const jourKey = dayKeyOf(d);
    for (const c of creneauxMatiere) {
      if (c.jour !== jourKey) continue;
      const seance = seancesByCreneauIdWeek.get(c.id);
      const mins = durationMinutes(c.debut, c.fin);
      if (c.type === "cours") {
        if (seance?.statut !== "annule") minutesCours += mins;
      } else {
        minutesTravailPlanifie += mins;
        const effective = seance?.matiereReelle || c.matiere;
        if (seance?.statut === "realise" && effective === tab.key) minutesTravailRealise += mins;
      }
    }
  }
  for (const s of sessionsSemaineFixe) {
    const mins = durationMinutes(s.debut, s.fin);
    if (s.estCours) {
      minutesCours += mins;
    } else {
      minutesTravailPlanifie += mins;
      if (s.statut === "realise") minutesTravailRealise += mins;
    }
  }
  // Colles : réalisé uniquement, le planifié ne bouge pas.
  for (const k of collesRealisees(data)) {
    if (k.matiere === tab.key && weekDays.includes(k.date)) minutesTravailRealise += k.minutes;
  }
  const minutesTotal = minutesCours + minutesTravailRealise;

  const actions = html`
    <div class="flex items-center gap-2">
      ${!isCurrentWindow &&
      html`<button
        class="px-2.5 py-1 rounded-lg border border-slate-300 text-xs text-slate-600 hover:bg-slate-100"
        onClick=${() => setStartDate(today)}
      >
        Aujourd'hui
      </button>`}
      <button
        class="h-7 w-7 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center text-sm"
        onClick=${() => setStartDate(addDaysStr(startDate, -1))}
        title="Jour précédent"
      >
        ←
      </button>
      <span class="text-xs font-medium text-slate-600 min-w-[110px] text-center">${formatWeekRangeFr(startDate)}</span>
      <button
        class="h-7 w-7 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center text-sm"
        onClick=${() => setStartDate(addDaysStr(startDate, 1))}
        title="Jour suivant"
      >
        →
      </button>
    </div>
  `;

  if (creneauxMatiere.length === 0 && sessionsSemaine.length === 0 && epreuvesSemaine.length === 0) {
    return html`
      <${Card} title="Cette semaine" subtitle=${tab.label} actions=${actions}>
        ${cbAlert}
        <${EmptyState}
          text="Ajoute des créneaux de cours ou de travail perso pour cette matière dans l'Agenda pour voir apparaître un résumé ici."
        />
      <//>
    `;
  }

  const jours = days.map((dateStr) => {
    const j = JOURS.find((jj) => jj.key === dayKeyOf(dateStr));
    const dayNum = new Date(dateStr + "T00:00:00").getDate();
    const items = [];
    for (const c of creneauxMatiere) {
      if (c.jour !== j.key) continue;
      const seance = seancesByCreneauId.get(c.id);
      if (c.type === "cours") {
        const skipped = seance?.statut === "annule";
        items.push({ id: c.id, debut: c.debut, fin: c.fin, label: "Cours", color: COURS_COLOR, skipped, done: false });
      } else {
        const effective = seance?.matiereReelle || c.matiere;
        const done = seance?.statut === "realise" && effective === tab.key;
        const skipped = seance?.statut === "annule" || (seance?.statut === "realise" && effective !== tab.key);
        if (!skipped)
          items.push({
            id: c.id,
            debut: c.debut,
            fin: c.fin,
            label: itemLabel(c.matiere, c.theme, c.titre),
            color: tab.accent,
            skipped: false,
            done,
          });
      }
    }
    for (const s of sessionsSemaine) {
      if (s.date !== dateStr) continue;
      const done = s.statut === "realise";
      items.push({
        id: s.id,
        debut: s.debut,
        fin: s.fin,
        label: s.estCours ? "Cours" : itemLabel(s.matiere, s.theme, s.titre),
        color: s.estCours ? COURS_COLOR : tab.accent,
        skipped: false,
        done: s.estCours ? false : done,
      });
    }
    for (const k of collesSemaine) {
      if (k.date !== dateStr) continue;
      const { prepa, debutPrepa, debutColle, finColle } = colleHoraires(k);
      items.push({
        id: k.id,
        debut: debutColle,
        fin: finColle,
        debutPrepa: prepa > 0 ? debutPrepa : null,
        label: "Colle",
        color: "#D97706",
        skipped: false,
        done: false,
        colle: true,
      });
    }
    // Épreuve de CB — pour Maths, on précise Maths I / Maths II puisque les deux
    // partagent l'onglet mais correspondent à des épreuves bien distinctes.
    for (const ep of epreuvesSemaine) {
      if (ep.date !== dateStr) continue;
      const precision = tab.cbMatieres.length > 1 ? ` (${ep.matiere})` : "";
      items.push({
        id: ep.id,
        debut: ep.debut,
        fin: ep.fin,
        label: `${ep.cbNom}${precision}`,
        color: "#DC2626",
        skipped: false,
        done: false,
        cb: true,
      });
    }
    items.sort((a, b) => a.debut.localeCompare(b.debut));
    return { ...j, items, dayNum };
  });

  const hasItems = jours.some((j) => j.items.length > 0);

  return html`
    <${Card} title="Cette semaine" subtitle=${tab.label} actions=${actions}>
      ${cbAlert}
      <div class="flex items-center gap-1.5 mb-1">
        <button
          class="h-5 w-5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 flex items-center justify-center text-[10px] shrink-0"
          onClick=${() => setStatsMonday(addDaysStr(weekMonday, -7))}
          title="Semaine précédente"
        >
          ←
        </button>
        <p class="text-[11px] text-slate-400">Temps de la semaine du ${formatWeekRangeFr(weekMonday)}</p>
        <button
          class="h-5 w-5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 flex items-center justify-center text-[10px] shrink-0"
          onClick=${() => setStatsMonday(addDaysStr(weekMonday, 7))}
          title="Semaine suivante"
        >
          →
        </button>
        ${!isCurrentStatsWeek &&
        html`<button
          class="text-[10px] text-slate-400 hover:text-slate-600 underline shrink-0"
          onClick=${() => setStatsMonday(mondayOf(today))}
        >
          Aujourd'hui
        </button>`}
      </div>
      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="rounded-lg bg-slate-50 px-2 py-2 text-center">
          <p class="text-[11px] text-slate-500">Cours suivis</p>
          <p class="text-sm font-semibold text-slate-800">${formatDuration(minutesCours)}</p>
        </div>
        <div class="rounded-lg bg-slate-50 px-2 py-2 text-center">
          <p class="text-[11px] text-slate-500">Travail perso</p>
          <p class="text-sm font-semibold text-slate-800">
            ${formatDuration(minutesTravailRealise)}<span class="text-slate-400 font-normal"> / ${formatDuration(minutesTravailPlanifie)}</span>
          </p>
        </div>
        <div class="rounded-lg bg-slate-50 px-2 py-2 text-center">
          <p class="text-[11px] text-slate-500">Total accordé</p>
          <p class="text-sm font-semibold text-slate-800">${formatDuration(minutesTotal)}</p>
        </div>
      </div>

      ${!hasItems
        ? html`<${EmptyState} text="Rien de prévu cette semaine pour cette matière." />`
        : html`
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              ${jours.map((j) => {
                const hasCB = j.items.some((it) => it.cb);
                const hasColle = j.items.some((it) => it.colle);
                const isToday = j.key === todayKey;
                const boxClass = hasCB
                  ? "bg-red-50 border-2 border-red-400"
                  : hasColle
                    ? "bg-amber-50 border border-amber-200"
                    : isToday
                      ? "bg-slate-50 border-2 border-slate-900"
                      : "bg-slate-50";
                return html`
                  <div key=${j.key} class=${`rounded-lg p-2 min-h-[3.5rem] ${boxClass}`}>
                    <p
                      class=${`text-[11px] font-semibold mb-1 ${hasCB ? "text-red-600" : hasColle ? "text-amber-700" : isToday ? "text-slate-900" : "text-slate-400"}`}
                    >
                      ${j.label} <span class="font-normal opacity-70">${j.dayNum}</span>
                    </p>
                    ${j.items.length === 0
                      ? html`<p class="text-[11px] text-slate-300">—</p>`
                      : html`
                          <div class="space-y-1">
                            ${j.items.map((it) =>
                              it.cb
                                ? html`
                                    <div key=${it.id} class="rounded bg-red-600 text-white px-1 py-0.5">
                                      <span class="text-[11px] font-semibold leading-tight block">📝 ${it.label}</span>
                                      <span class="text-[10px] leading-tight opacity-90 block">${it.debut}–${it.fin}</span>
                                    </div>
                                  `
                                : it.colle
                                  ? html`
                                      <div key=${it.id} class="rounded bg-amber-100 border border-amber-300 px-1 py-0.5">
                                        <span class="text-[11px] font-semibold leading-tight block text-amber-800">🎤 ${it.label}</span>
                                        <span class="text-[10px] leading-tight text-amber-700 block"
                                          >${it.debut}–${it.fin}${it.debutPrepa ? ` (${it.debutPrepa})` : ""}</span
                                        >
                                      </div>
                                    `
                                  : html`
                                      <div key=${it.id} class="flex items-start gap-1">
                                        <span class="h-1.5 w-1.5 rounded-full shrink-0 mt-1" style=${{ backgroundColor: it.color }}></span>
                                        <span
                                          class=${`text-[11px] leading-tight text-slate-600 ${it.skipped ? "line-through text-slate-400" : ""}`}
                                          >${it.debut}–${it.fin} · ${it.label}${it.done ? " ✓" : ""}</span
                                        >
                                      </div>
                                    `
                            )}
                          </div>
                        `}
                  </div>
                `;
              })}
            </div>
          `}
    <//>
  `;
}
