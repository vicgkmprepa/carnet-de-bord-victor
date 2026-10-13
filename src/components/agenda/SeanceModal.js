import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { SUBJECT_TABS, subjectLabel, itemLabel } from "../../lib/subjectMapping.js";
import { formatWeekRangeFr } from "../../lib/scheduleUtils.js";

const ANNULE = "__annule__";
const MATIERE_OPTIONS = [...SUBJECT_TABS.map((t) => t.key)];

// Popup de confirmation pour toute modification de l'agenda sur une semaine donnée :
// marquer une session de travail comme faite (avec matière réellement travaillée si
// différente du prévu — le créneau change alors de couleur pour cette semaine
// uniquement), la marquer annulée cette semaine (barrée, comme un cours annulé), ou
// annuler un cours cette semaine-là sans toucher au créneau récurrent. Pour un
// créneau de travail, permet aussi de noter le contenu prévu/fait de LA séance de
// CETTE semaine précise (unique par occurrence, jamais partagé entre semaines).
export function SeanceModal({
  creneau,
  semaine,
  seance,
  onClose,
  onSetTravailRealise,
  onUpdateContenu,
  onToggleCoursAnnule,
  onClearSeance,
}) {
  const [matiereReelle, setMatiereReelle] = useState(
    seance?.statut === "annule" ? ANNULE : seance?.matiereReelle || creneau.matiere
  );
  const [contenu, setContenu] = useState(seance?.contenu || "");

  const titre = itemLabel(creneau.matiere, creneau.theme, creneau.titre);
  const quand = `${creneau.jour.charAt(0).toUpperCase()}${creneau.jour.slice(1)} ${creneau.debut}–${creneau.fin} · semaine du ${formatWeekRangeFr(semaine).split("–")[0].trim()}`;
  const estAnnulee = matiereReelle === ANNULE;
  const matiereChangee = !estAnnulee && matiereReelle !== creneau.matiere;

  return html`
    <div class="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4" onClick=${onClose}>
      <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick=${(e) => e.stopPropagation()}>
        <h3 class="text-base font-semibold text-slate-800">${titre}</h3>
        <p class="text-xs text-slate-500 mb-4">${quand}</p>

        ${creneau.type === "cours" &&
        html`
          ${seance?.statut === "annule"
            ? html`
                <p class="text-sm text-slate-600 mb-4">Ce cours est marqué <strong>annulé</strong> cette semaine.</p>
                <div class="flex justify-end gap-2">
                  <button class="px-4 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100" onClick=${onClose}>Fermer</button>
                  <button
                    class="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800"
                    onClick=${() => {
                      onToggleCoursAnnule();
                      onClose();
                    }}
                  >
                    Rétablir le cours
                  </button>
                </div>
              `
            : html`
                <p class="text-sm text-slate-600 mb-4">Ce cours a-t-il été annulé cette semaine ?</p>
                <div class="flex justify-end gap-2">
                  <button class="px-4 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100" onClick=${onClose}>Non, fermer</button>
                  <button
                    class="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                    onClick=${() => {
                      onToggleCoursAnnule();
                      onClose();
                    }}
                  >
                    Oui, l'annuler
                  </button>
                </div>
              `}
        `}

        ${creneau.type === "travail" &&
        html`
          <label class="text-sm text-slate-600 block mb-1">
            Contenu de la séance (optionnel)
            <textarea
              class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
              rows="3"
              placeholder="Ex : fichage du manuel, chapitre 3, exercices de colle…"
              value=${contenu}
              onInput=${(e) => setContenu(e.target.value)}
            ></textarea>
          </label>
          <p class="text-xs text-slate-400 mb-2 mt-2">
            Propre à la séance du ${formatWeekRangeFr(semaine).split("–")[0].trim()} — n'affecte pas les autres semaines de ce créneau.
          </p>
          <button
            class="w-full px-4 py-1.5 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 mb-4"
            onClick=${() => {
              onUpdateContenu(contenu);
              onClose();
            }}
          >
            Enregistrer le contenu
          </button>

          <label class="text-sm text-slate-600 block mb-1">
            Matière réellement travaillée cette semaine
            <select
              class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              value=${matiereReelle}
              onChange=${(e) => setMatiereReelle(e.target.value)}
            >
              ${MATIERE_OPTIONS.map((m) => html`<option value=${m}>${m}</option>`)}
              <option value=${ANNULE}>Séance annulée</option>
            </select>
          </label>
          <p class="text-xs text-slate-400 mb-4">
            ${estAnnulee
              ? "La case apparaîtra barrée cette semaine seulement, comme un cours annulé."
              : matiereChangee
                ? `Différent du prévu (${subjectLabel(creneau.matiere)}) : la case prendra la couleur ${subjectLabel(matiereReelle)} pour cette semaine seulement.`
                : "Identique au prévu."}
          </p>
          <div class="flex flex-col gap-2">
            <button
              class=${`w-full px-4 py-1.5 rounded-lg text-sm font-medium text-white ${
                estAnnulee ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"
              }`}
              onClick=${() => {
                if (estAnnulee) onToggleCoursAnnule();
                else onSetTravailRealise(matiereChangee ? matiereReelle : null, contenu);
                onClose();
              }}
            >
              ${estAnnulee ? "Marquer annulée" : seance?.statut === "realise" ? "Mettre à jour" : "Marquer réalisée"}
            </button>
            <div class="flex items-center justify-between gap-2">
              <button class="text-xs text-slate-500 hover:text-slate-700" onClick=${() => { onClearSeance(); onClose(); }}>
                Réinitialiser (aucun état)
              </button>
              <button class="text-xs text-slate-500 hover:text-slate-700" onClick=${onClose}>Fermer sans changer</button>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}
