import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { Badge } from "../common/Badge.js";
import { EmptyState } from "../common/EmptyState.js";
import { subjectAccent, subjectLabel, SUBJECT_TABS } from "../../lib/subjectMapping.js";

const SUBJECT_TAB_KEYS = new Set(SUBJECT_TABS.map((t) => t.key));
import { dayKeyOf, mondayOf, addDaysStr, durationMinutes, formatDuration } from "../../lib/scheduleUtils.js";
import { formatDateFr, daysUntil, isPast } from "../../lib/dateUtils.js";
import { colleHoraires, collesRealisees } from "../../lib/colleUtils.js";

const COURS_COLOR = "#94A3B8";

function nowHHMM() {
  return new Date().toTimeString().slice(0, 5);
}

export function TodayWidget({ onChangeTab }) {
  const { data, today, updateTaskStatut } = useCarnet();
  const [offset, setOffset] = useState(0); // 0 = aujourd'hui, 1 = demain

  const isToday = offset === 0;
  const displayedDate = isToday ? today : addDaysStr(today, offset);
  const displayedKey = dayKeyOf(displayedDate);
  const monday = mondayOf(displayedDate);
  const now = nowHHMM();

  const seancesJour = new Map(data.seances.filter((s) => s.semaine === monday).map((s) => [s.creneauId, s]));

  const creneauxJour = data.emploi_du_temps.creneaux
    .filter((c) => c.jour === displayedKey)
    .filter((c) => seancesJour.get(c.id)?.statut !== "annule")
    .filter((c) => !isToday || c.fin > now)
    .sort((a, b) => a.debut.localeCompare(b.debut));

  const sessionsJour = data.sessions_ponctuelles
    .filter((s) => s.date === displayedDate)
    .filter((s) => !isToday || s.fin > now)
    .sort((a, b) => a.debut.localeCompare(b.debut));

  const collesJour = data.colles
    .filter((c) => c.date === displayedDate)
    .filter((c) => !isToday || colleHoraires(c).finColle > now)
    .sort((a, b) => a.heure.localeCompare(b.heure));

  // Un devoir (pin) s'affiche dès la veille de son échéance — un simple rappel
  // le jour J arrive trop tard pour un vrai devoir à rendre/préparer.
  const demain = addDaysStr(today, 1);
  const tachesUrgentes = isToday
    ? data.taches_globales
        .filter(
          (t) => t.statut !== "fait" && (t.deadline === today || isPast(t.deadline) || (t.devoir && t.deadline === demain))
        )
        .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""))
    : data.taches_globales
        .filter((t) => t.statut !== "fait" && t.deadline === displayedDate)
        .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""));

  const prochainCB = [...data.concours_blancs]
    .filter((cb) => cb.date && daysUntil(cb.date) !== null && daysUntil(cb.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const rien = creneauxJour.length === 0 && sessionsJour.length === 0 && collesJour.length === 0 && tachesUrgentes.length === 0;

  // Comparatif temps travaillé vs prévu — toujours calculé sur AUJOURD'HUI (jamais
  // "demain", qui n'a par nature encore rien de réalisé), indépendamment du toggle
  // ← → qui ne change que l'affichage du planning/tâches ci-dessous.
  const mondayToday = mondayOf(today);
  const jourKeyToday = dayKeyOf(today);
  const seancesAujourdhui = new Map(data.seances.filter((s) => s.semaine === mondayToday).map((s) => [s.creneauId, s]));
  const creneauxTravailAujourdhui = data.emploi_du_temps.creneaux.filter(
    (c) => c.type === "travail" && c.jour === jourKeyToday && seancesAujourdhui.get(c.id)?.statut !== "annule"
  );
  const sessionsAujourdhui = data.sessions_ponctuelles.filter((s) => s.date === today && !s.estCours);
  const minutesPlanifiees =
    creneauxTravailAujourdhui.reduce((acc, c) => acc + durationMinutes(c.debut, c.fin), 0) +
    sessionsAujourdhui.reduce((acc, s) => acc + durationMinutes(s.debut, s.fin), 0);
  const minutesRealisees =
    creneauxTravailAujourdhui
      .filter((c) => seancesAujourdhui.get(c.id)?.statut === "realise")
      .reduce((acc, c) => acc + durationMinutes(c.debut, c.fin), 0) +
    sessionsAujourdhui
      .filter((s) => s.statut === "realise")
      .reduce((acc, s) => acc + durationMinutes(s.debut, s.fin), 0) +
    // Colles terminées (préparation + passage) : réalisé seulement, jamais planifié.
    collesRealisees(data)
      .filter((k) => k.date === today)
      .reduce((acc, k) => acc + k.minutes, 0);
  const comparatifJour =
    isToday && minutesPlanifiees > 0 ? ` · ${formatDuration(minutesRealisees)} / ${formatDuration(minutesPlanifiees)} travaillées` : "";

  return html`
    <${Card}
      title=${html`
        <span class="inline-flex items-center gap-2">
          ${isToday ? "Aujourd'hui" : "Demain"}
          ${!isToday &&
          html`<button
            class="h-6 w-6 rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100 flex items-center justify-center text-xs"
            onClick=${() => setOffset(0)}
            title="Revenir à aujourd'hui"
          >
            ←
          </button>`}
          ${isToday &&
          html`<button
            class="h-6 w-6 rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100 flex items-center justify-center text-xs"
            onClick=${() => setOffset(1)}
            title="Voir demain"
          >
            →
          </button>`}
        </span>
      `}
      subtitle=${`${formatDateFr(displayedDate)}${comparatifJour}`}
    >
      ${rien
        ? html`<${EmptyState} text=${isToday ? "Rien de programmé pour le reste de la journée." : "Rien de programmé pour demain."} />`
        : html`
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p class="text-xs font-semibold text-slate-500 mb-2">Planning</p>
                ${collesJour.map((colleDuJour) => {
                  const accent = subjectAccent(colleDuJour.matiere);
                  const { prepa, debutPrepa } = colleHoraires(colleDuJour);
                  return html`
                    <div
                      key=${colleDuJour.id}
                      class="rounded-lg border px-3 py-2 mb-2"
                      style=${{ backgroundColor: `${accent}1A`, borderColor: `${accent}66` }}
                    >
                      <p class="text-sm font-semibold" style=${{ color: accent }}>
                        Colle ${subjectLabel(colleDuJour.matiere)} · ${colleDuJour.heure}${prepa > 0 ? ` (prépa ${debutPrepa})` : ""}
                      </p>
                      <p class="text-xs" style=${{ color: accent }}>
                        ${[colleDuJour.salle, colleDuJour.colleur].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                  `;
                })}
                ${creneauxJour.length === 0 && sessionsJour.length === 0
                  ? html`<p class="text-sm text-slate-400 italic">${isToday ? "Plus de créneau aujourd'hui." : "Aucun créneau."}</p>`
                  : html`
                      <ul class="space-y-1.5">
                        ${[...creneauxJour, ...sessionsJour]
                          .sort((a, b) => a.debut.localeCompare(b.debut))
                          .map((c) => {
                            const isSession = !c.jour;
                            const seance = !isSession ? seancesJour.get(c.id) : null;
                            const matiereEffective =
                              isSession
                                ? c.matiere
                                : c.type !== "cours" && seance?.matiereReelle
                                  ? seance.matiereReelle
                                  : c.matiere;
                            const isCours = isSession ? Boolean(c.estCours) : c.type === "cours";
                            const color = isCours ? COURS_COLOR : subjectAccent(matiereEffective);
                            const clickable = onChangeTab && SUBJECT_TAB_KEYS.has(matiereEffective);
                            return html`
                              <li key=${c.id}>
                                <button
                                  class=${`w-full flex items-center gap-2 text-sm text-left rounded ${clickable ? "hover:bg-slate-50" : ""}`}
                                  disabled=${!clickable}
                                  onClick=${() => clickable && onChangeTab(matiereEffective)}
                                >
                                  <span
                                    class=${`h-2 w-2 rounded-full shrink-0 ${isCours ? "ring-2 ring-offset-1 ring-slate-300" : ""}`}
                                    style=${{ backgroundColor: color }}
                                  ></span>
                                  <span class="text-slate-500 shrink-0">${c.debut}</span>
                                  <span
                                    class=${`truncate ${isCours ? "text-slate-500" : clickable ? "text-slate-700 hover:underline" : "text-slate-700"}`}
                                  >
                                    ${c.titre || subjectLabel(c.matiere)}${(isSession ? c.contenu : seance?.contenu)?.trim() ? " ✏️" : ""}
                                  </span>
                                  ${isCours && html`<span class="text-[10px] text-slate-400 shrink-0">cours</span>`}
                                </button>
                              </li>
                            `;
                          })}
                      </ul>
                    `}
              </div>

              <div>
                <p class="text-xs font-semibold text-slate-500 mb-2">
                  ${isToday ? "Tâches du jour / en retard" : "Tâches pour demain"}
                </p>
                ${tachesUrgentes.length === 0
                  ? html`<p class="text-sm text-slate-400 italic">Rien d'urgent.</p>`
                  : html`
                      <ul class="space-y-1.5">
                        ${tachesUrgentes.map(
                          (t) => html`
                            <li key=${t.id} class=${`flex items-center gap-2 text-sm ${t.devoir ? "bg-red-50 -mx-1.5 px-1.5 py-0.5 rounded-lg shadow-[inset_4px_0_0_0_#ef4444]" : ""}`}>
                              <input
                                type="checkbox"
                                class="h-4 w-4 rounded border-slate-300 shrink-0"
                                onChange=${() => updateTaskStatut(t.id, "fait")}
                              />
                              <${Badge} label=${subjectLabel(t.matiere)} color=${subjectAccent(t.matiere)} />
                              ${t.devoir &&
                              html`<span class="shrink-0 px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold"
                                >DEVOIR${isToday && t.deadline === demain ? " · demain" : ""}</span
                              >`}
                              <span class=${`flex-1 min-w-0 truncate ${
                                t.devoir ? "font-bold text-red-700" : isToday && isPast(t.deadline) ? "text-red-600 font-medium" : "text-slate-700"
                              }`}>
                                ${t.titre}
                              </span>
                            </li>
                          `
                        )}
                      </ul>
                    `}
              </div>
            </div>
          `}
      ${prochainCB &&
      html`
        <p class="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
          Prochain CB : <span class="font-medium text-slate-600">${prochainCB.nom}</span> dans <span class="font-medium text-slate-600">${daysUntil(prochainCB.date)} j</span> (${formatDateFr(prochainCB.date)})
        </p>
      `}
    <//>
  `;
}
