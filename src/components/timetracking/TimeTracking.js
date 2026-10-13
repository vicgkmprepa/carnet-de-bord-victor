import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { EmptyState } from "../common/EmptyState.js";
import { mondayOf, addDaysStr, formatWeekRangeFr, JOURS, dayKeyOf } from "../../lib/scheduleUtils.js";
import { weeklySeries, monthlySeries, dailySeriesForWeek, dailySeriesRolling, partialWeekTotals } from "../../lib/workTimeStats.js";
import { AlertsCard } from "./AlertsCard.js";
import { CoefficientBalanceCard } from "./CoefficientBalanceCard.js";
import { StatsHeader } from "./StatsHeader.js";
import { WeeklyPieCard } from "./WeeklyPieCard.js";
import { WeekComparisonCard } from "./WeekComparisonCard.js";
import { DailyBreakdownCard } from "./DailyBreakdownCard.js";
import { WeeksEvolutionCard, NB_SEMAINES } from "./WeeksEvolutionCard.js";
import { SubjectWeeksTableCard } from "./SubjectWeeksTableCard.js";
import { MonthlyComparisonCard } from "./MonthlyComparisonCard.js";

export function TimeTracking({ onChangeTab, onOpenAgendaDay }) {
  const { data, today } = useCarnet();
  const [monday, setMonday] = useState(() => mondayOf(today));
  const isCurrentWeek = monday === mondayOf(today);
  const [finFenetreJour, setFinFenetreJour] = useState(today);
  const [offsetSemaines, setOffsetSemaines] = useState(0);
  const weeks = weeklySeries(data);
  const months = monthlySeries(data);

  const finSemaines = weeks.length - offsetSemaines;
  const semainesWindow = weeks.slice(Math.max(0, finSemaines - NB_SEMAINES), finSemaines);
  // Le tableau matière × semaine est moins lisible avec autant de colonnes que le
  // graphique d'évolution — on ne garde que les 4 semaines les plus récentes de
  // la même fenêtre (donc toujours synchronisé avec les flèches ← → ci-dessus).
  const tableWeeks = semainesWindow.slice(-4);

  const previousMonday = addDaysStr(monday, -7);
  const currentWeek = weeks.find((w) => w.semaine === monday) || { semaine: monday, byMatiere: {}, total: 0 };
  // Semaine en cours : la semaine affichée n'a par nature de données que jusqu'à
  // aujourd'hui, donc la comparer à une semaine précédente COMPLÈTE la
  // désavantagerait toujours artificiellement — on tronque la précédente à la
  // même portion (ex. lundi-mercredi si on est mercredi).
  const nbJoursEcoules = JOURS.findIndex((j) => j.key === dayKeyOf(today)) + 1;
  const previousWeek = isCurrentWeek
    ? partialWeekTotals(data, previousMonday, nbJoursEcoules)
    : weeks.find((w) => w.semaine === previousMonday) || { semaine: previousMonday, byMatiere: {}, total: 0 };
  const daysRolling = dailySeriesRolling(data, finFenetreJour);
  const daysOfToday = dailySeriesForWeek(data, mondayOf(today));
  const todayMinutes = daysOfToday.find((d) => d.date === today)?.total || 0;

  return html`
    <div>
      <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-800">Temps de travail</h2>
          <p class="text-sm text-slate-500">Vue d'ensemble de ton temps de travail perso, semaine par semaine et mois par mois.</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="h-8 w-8 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center"
            onClick=${() => setMonday(addDaysStr(monday, -7))}
            title="Semaine précédente"
          >
            ←
          </button>
          <div class="text-sm font-medium text-slate-700 text-center min-w-[150px]">${formatWeekRangeFr(monday)}</div>
          <button
            class="h-8 w-8 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center"
            onClick=${() => setMonday(addDaysStr(monday, 7))}
            title="Semaine suivante"
          >
            →
          </button>
          ${!isCurrentWeek &&
          html`<button
            class="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-100"
            onClick=${() => setMonday(mondayOf(today))}
          >
            Aujourd'hui
          </button>`}
        </div>
      </div>

      ${weeks.length === 0
        ? html`<${EmptyState} text="Coche des séances de travail réalisées ou ajoute des sessions ponctuelles dans l'Agenda pour voir apparaître tes statistiques ici." />`
        : html`
            <${StatsHeader}
              currentWeek=${currentWeek}
              previousWeek=${previousWeek}
              weeks=${weeks}
              isCurrentWeek=${isCurrentWeek}
              todayMinutes=${todayMinutes}
            />

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
              <${WeeklyPieCard} week=${currentWeek} isCurrentWeek=${isCurrentWeek} />
              <${WeekComparisonCard} currentWeek=${currentWeek} previousWeek=${previousWeek} isCurrentWeek=${isCurrentWeek} />
              <${CoefficientBalanceCard} />
            </div>

            <div class="grid grid-cols-1 gap-5 mt-5">
              <${SubjectWeeksTableCard} weeks=${tableWeeks} currentWeekMonday=${mondayOf(today)} />
              <${DailyBreakdownCard}
                days=${daysRolling}
                onPrev=${() => setFinFenetreJour(addDaysStr(finFenetreJour, -7))}
                onNext=${() => {
                  const next = addDaysStr(finFenetreJour, 7);
                  setFinFenetreJour(next < today ? next : today);
                }}
                canNext=${finFenetreJour !== today}
                onReset=${() => setFinFenetreJour(today)}
                canReset=${finFenetreJour !== today}
                onSelectDay=${onOpenAgendaDay}
              />
              <${WeeksEvolutionCard}
                weeks=${semainesWindow}
                onPrev=${() => setOffsetSemaines(Math.min(offsetSemaines + NB_SEMAINES, Math.max(0, weeks.length - NB_SEMAINES)))}
                onNext=${() => setOffsetSemaines(Math.max(0, offsetSemaines - NB_SEMAINES))}
                canPrev=${offsetSemaines < Math.max(0, weeks.length - NB_SEMAINES)}
                canNext=${offsetSemaines > 0}
                onReset=${() => setOffsetSemaines(0)}
                canReset=${offsetSemaines > 0}
                onSelectWeek=${onOpenAgendaDay}
              />
              <${MonthlyComparisonCard} months=${months} />
            </div>
          `}

      <div class="mt-5">
        <${AlertsCard} onChangeTab=${onChangeTab} />
      </div>
    </div>
  `;
}
