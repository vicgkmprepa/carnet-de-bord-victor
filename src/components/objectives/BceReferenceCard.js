import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { SUBJECT_TABS, subjectAccent } from "../../lib/subjectMapping.js";
import { notesCiblesParEcole, ciblesEffectives, ECOLE_CIBLE_DEFAUT as ECOLE_CIBLE } from "../../lib/notesCibles.js";

// Notes réelles obtenues à la BCE 2026 (admissibilité) — pas un concours blanc,
// un résultat déjà passé qui a permis l'accès à l'EM. Archive fixe, non
// modifiable, et surtout jamais une cible en soi : sert uniquement de point de
// départ au calcul automatique des notes cibles, elles-mêmes personnalisables
// matière par matière (une matière maîtrisable comme les Maths tolère une cible
// bien plus ambitieuse que le décalage uniforme, une matière aléatoire comme la
// Synthèse mérite une cible plus prudente). Rétractable et replié par défaut.
export function BceReferenceCard() {
  const { data, updateNoteCiblePersonnalisee } = useCarnet();
  const [open, setOpen] = useState(false);
  const notes = data.notes_bce_reference;
  const cibles = notesCiblesParEcole(data, ECOLE_CIBLE);
  const effectives = ciblesEffectives(data, ECOLE_CIBLE);

  if (notes.length === 0) return null;

  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <button class="w-full flex items-center justify-between gap-3 text-left" onClick=${() => setOpen((v) => !v)}>
        <div>
          <h3 class="font-semibold text-slate-800">Référence BCE 2026</h3>
          <p class="text-sm text-slate-500">Résultat d'admissibilité réel qui a permis l'accès à l'EM</p>
        </div>
        <span class="text-slate-400 text-sm shrink-0">${open ? "▲ Réduire" : "▼ Voir le détail"}</span>
      </button>

      ${open &&
      html`
        <div class="overflow-x-auto mt-4">
          <table class="w-full text-sm min-w-[420px]">
            <thead>
              <tr class="text-left text-slate-500">
                <th class="py-1.5 font-medium">Épreuve</th>
                <th class="py-1.5 font-medium text-right">Note</th>
              </tr>
            </thead>
            <tbody>
              ${notes.map(
                (n) => html`
                  <tr key=${n.id} class="border-t border-slate-100">
                    <td class="py-1.5 text-slate-700">${n.nom}</td>
                    <td class="py-1.5 text-right tabular-nums text-slate-600 font-medium">${n.note !== null ? n.note : "—"}</td>
                  </tr>
                `
              )}
            </tbody>
          </table>
        </div>

        ${cibles &&
        effectives &&
        html`
          <div class="mt-5 pt-4 border-t border-slate-100">
            <p class="text-sm font-medium text-slate-700">Notes cibles ${ECOLE_CIBLE}</p>
            <p class="text-xs text-slate-400 mt-0.5">
              ${`Barre d'admissibilité ${ECOLE_CIBLE} 2026 : ${cibles.barre}/20. Décalage uniforme depuis ta BCE (${cibles.moyenneBcePonderee.toFixed(1)}/20 pondérée) : +${cibles.ecartUniforme.toFixed(1)} pt par matière. Modifiable ci-dessous — c'est toi qui sais où viser haut et où rester prudent.`}
            </p>
            <table class="w-full text-sm min-w-[420px] mt-3">
              <thead>
                <tr class="text-left text-slate-500">
                  <th class="py-1.5 font-medium">Matière</th>
                  <th class="py-1.5 font-medium text-right">Note cible</th>
                </tr>
              </thead>
              <tbody>
                ${SUBJECT_TABS.map((tab) => {
                  const info = effectives.valeurs[tab.key];
                  if (!info) return null;
                  const personnalisee = info.source === "personnalisee";
                  return html`
                    <tr key=${tab.key} class="border-t border-slate-100">
                      <td class="py-1.5">
                        <span class="inline-block h-2 w-2 rounded-full mr-2" style=${{ backgroundColor: subjectAccent(tab.key) }}></span>
                        <span class="text-slate-700">${tab.label}</span>
                      </td>
                      <td class="py-1.5 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          ${personnalisee &&
                          html`
                            <button
                              class="text-slate-300 hover:text-slate-600 text-xs leading-none"
                              title="Revenir au calcul automatique"
                              onClick=${() => updateNoteCiblePersonnalisee(tab.key, null)}
                            >
                              ↺
                            </button>
                          `}
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="20"
                            class=${`w-16 text-right tabular-nums font-semibold text-slate-800 rounded px-1.5 py-0.5 text-sm border ${
                              personnalisee ? "border-slate-300 bg-white" : "border-transparent bg-slate-50"
                            }`}
                            value=${info.valeur}
                            onChange=${(e) => {
                              const v = e.target.value === "" ? null : Number(e.target.value);
                              updateNoteCiblePersonnalisee(tab.key, v);
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
            <p class=${`text-xs mt-3 pt-3 border-t border-slate-100 ${
              effectives.moyennePonderee >= effectives.barre ? "text-emerald-600" : "text-amber-600"
            }`}>
              ${effectives.moyennePonderee >= effectives.barre
                ? `Avec ces cibles, ta moyenne pondérée ${ECOLE_CIBLE} serait de ${effectives.moyennePonderee.toFixed(1)}/20 — au-dessus de la barre (${effectives.barre}/20).`
                : `Avec ces cibles, ta moyenne pondérée ${ECOLE_CIBLE} serait de ${effectives.moyennePonderee.toFixed(1)}/20 — encore en dessous de la barre (${effectives.barre}/20).`}
            </p>
          </div>
        `}
      `}
    </div>
  `;
}
