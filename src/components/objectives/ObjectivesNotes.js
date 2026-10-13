import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { CBForm } from "./CBForm.js";
import { CBList } from "./CBList.js";
import { RankingChart } from "./RankingChart.js";
import { SchoolTrendChart } from "./SchoolTrendChart.js";
import { BceReferenceCard } from "./BceReferenceCard.js";
import { CoefficientsTable } from "./CoefficientsTable.js";

export function ObjectivesNotes() {
  const { addCB } = useCarnet();
  const [showForm, setShowForm] = useState(false);

  return html`
    <div>
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-lg font-semibold text-slate-800">Objectifs & Notes</h2>
        ${!showForm &&
        html`
          <button
            class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800"
            onClick=${() => setShowForm(true)}
          >
            + Ajouter un CB
          </button>
        `}
      </div>

      ${showForm &&
      html`
        <${CBForm}
          onSubmit=${(cb) => {
            addCB(cb);
            setShowForm(false);
          }}
          onCancel=${() => setShowForm(false)}
        />
      `}

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <${RankingChart} />
        <${SchoolTrendChart} />
      </div>

      <${CBList} />

      <div class="mt-5">
        <${BceReferenceCard} />
      </div>

      <div class="mt-5">
        <${CoefficientsTable} />
      </div>
    </div>
  `;
}
