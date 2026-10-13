import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { latestCBWithNotes } from "../../lib/weightedAverage.js";

export function ProgressIndicator() {
  const { data } = useCarnet();
  const cbs = [...data.concours_blancs].sort((a, b) => a.date.localeCompare(b.date));
  const dernierCB = latestCBWithNotes(cbs);

  if (!dernierCB) {
    return html`
      <${Card} title="Progression" subtitle="Dernier CB">
        <${EmptyState} text="Pas encore de CB avec des notes renseignées." />
      <//>
    `;
  }

  const deltas = dernierCB.matieres
    .filter(
      (m) =>
        m.note_objectif !== null &&
        m.note_objectif !== undefined &&
        m.note_objectif !== "" &&
        m.note_obtenue !== null &&
        m.note_obtenue !== undefined &&
        m.note_obtenue !== ""
    )
    .map((m) => Number(m.note_obtenue) - Number(m.note_objectif));

  const moyenneDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
  const color = moyenneDelta === null ? "text-slate-400" : moyenneDelta >= 0 ? "text-emerald-600" : "text-red-600";

  return html`
    <${Card} title="Progression" subtitle=${`Écart obtenu − objectif, ${dernierCB.nom}`}>
      ${moyenneDelta === null
        ? html`<${EmptyState} text="Renseigne objectif et note obtenue pour ce CB." />`
        : html`
            <div class=${`text-4xl font-bold tabular-nums ${color}`}>
              ${moyenneDelta >= 0 ? "+" : ""}${moyenneDelta.toFixed(2)}
            </div>
            <p class="text-sm text-slate-500 mt-1">
              Moyenne sur ${deltas.length} matière${deltas.length > 1 ? "s" : ""} renseignée${deltas.length > 1
                ? "s"
                : ""}.
            </p>
          `}
    <//>
  `;
}
