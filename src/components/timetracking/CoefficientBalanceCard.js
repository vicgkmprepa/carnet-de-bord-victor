import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { subjectAccent } from "../../lib/subjectMapping.js";
import { coefficientBalanceRows, SEUIL_ECART_COEF } from "../../lib/coefficientBalance.js";

// Compare, pour chaque matière, le % du temps de travail perso réalisé sur les 2
// dernières semaines glissantes (semaine en cours + semaine précédente — jamais
// plus loin, pour rester représentatif du rythme actuel) au % que représente son
// coefficient dans le total des coefficients des premières écoles — pour repérer un
// temps investi disproportionné (trop ou trop peu) par rapport au poids réel de la
// matière au concours. Avertissement doux, pas une alarme : un écart peut être
// volontaire (rattrapage sur un point faible, matière déjà solide).
export function CoefficientBalanceCard() {
  const { data, today } = useCarnet();
  const { rows: unsorted, topEcoles } = coefficientBalanceRows(data, today);

  if (unsorted.length === 0) {
    return html`
      <${Card} title="Temps vs poids au concours" subtitle=${`Coefficients de ${topEcoles.map((e) => e.nom).join(", ") || "premières écoles"}`}>
        <${EmptyState}
          text="Pas encore assez de données (temps de travail réalisé ces 2 dernières semaines et/ou coefficients d'écoles renseignés) pour comparer."
        />
      <//>
    `;
  }

  const rows = [...unsorted].sort((a, b) => b.pctCoef - a.pctCoef);

  return html`
    <${Card}
      title="Temps vs poids au concours"
      subtitle=${`% du temps de travail réalisé sur les 2 dernières semaines, comparé au poids du coefficient chez ${topEcoles.map((e) => e.nom).join(", ")}`}
    >
      <ul class="space-y-3">
        ${rows.map(({ tab, pctTemps, pctCoef, surInvesti, sousInvesti }) => {
          const alerte = surInvesti || sousInvesti;
          return html`
            <li key=${tab.key}>
              <div class="flex items-center justify-between text-sm mb-1 gap-2">
                <span class="flex items-center gap-1.5 font-medium text-slate-700 truncate">
                  <span class="h-2 w-2 rounded-full shrink-0" style=${{ backgroundColor: subjectAccent(tab.key) }}></span>
                  ${tab.label}
                </span>
                ${alerte &&
                html`<span
                  class=${`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    surInvesti ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  ${surInvesti ? "Sur-investi" : "Sous-investi"}
                </span>`}
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-slate-400 w-14 shrink-0">Temps</span>
                  <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      class="h-full rounded-full"
                      style=${{ width: `${Math.min(100, pctTemps)}%`, backgroundColor: subjectAccent(tab.key) }}
                    ></div>
                  </div>
                  <span class="text-xs text-slate-600 w-10 text-right tabular-nums">${pctTemps.toFixed(0)}%</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-slate-400 w-14 shrink-0">Coef.</span>
                  <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div class="h-full rounded-full bg-slate-400" style=${{ width: `${Math.min(100, pctCoef)}%` }}></div>
                  </div>
                  <span class="text-xs text-slate-600 w-10 text-right tabular-nums">${pctCoef.toFixed(0)}%</span>
                </div>
              </div>
            </li>
          `;
        })}
      </ul>
      <p class="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
        Écart ≥ ${SEUIL_ECART_COEF} points entre temps investi et poids du coefficient → signalé.
      </p>
    <//>
  `;
}
