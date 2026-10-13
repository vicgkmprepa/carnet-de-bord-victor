import { html } from "../../lib/htm.js";
import { CountdownBanner } from "./CountdownBanner.js";
import { TodayWidget } from "./TodayWidget.js";
import { TasksSummary } from "./TasksSummary.js";
import { GradesEvolutionChart } from "./GradesEvolutionChart.js";
import { SchoolAverageChart } from "./SchoolAverageChart.js";
import { ProgressIndicator } from "./ProgressIndicator.js";
import { TimeTrackingCard } from "./TimeTrackingCard.js";
import { NeglectedSubjectCard } from "./NeglectedSubjectCard.js";

export function Dashboard({ onChangeTab }) {
  return html`
    <div>
      <${CountdownBanner} />
      <div class="mb-5"><${TodayWidget} onChangeTab=${onChangeTab} /></div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div class="lg:col-span-2"><${TasksSummary} /></div>
        <${ProgressIndicator} />
      </div>
      <div class="mb-5"><${TimeTrackingCard} /></div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <${GradesEvolutionChart} />
        <${SchoolAverageChart} />
      </div>
      <${NeglectedSubjectCard} onChangeTab=${onChangeTab} />
    </div>
  `;
}
