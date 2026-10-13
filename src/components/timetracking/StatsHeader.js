import { html } from "../../lib/htm.js";
import { formatDuration } from "../../lib/scheduleUtils.js";

function Tile({ label, value, sub, color, highlight }) {
  if (highlight) {
    return html`
      <div class="rounded-2xl shadow-sm p-4" style=${{ backgroundColor: "#4F46E5" }}>
        <p class="text-xs text-indigo-100">${label}</p>
        <p class="text-xl font-bold tabular-nums mt-1 text-white">${value}</p>
        ${sub && html`<p class="text-xs text-indigo-200 mt-0.5">${sub}</p>`}
      </div>
    `;
  }
  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <p class="text-xs text-slate-500">${label}</p>
      <p class=${`text-xl font-bold tabular-nums mt-1 ${color || "text-slate-800"}`}>${value}</p>
      ${sub && html`<p class="text-xs text-slate-400 mt-0.5">${sub}</p>`}
    </div>
  `;
}

export function StatsHeader({ currentWeek, previousWeek, weeks, isCurrentWeek, todayMinutes }) {
  const total = currentWeek.total;
  const prev = previousWeek.total;
  const delta = total - prev;
  const deltaPct = prev > 0 ? Math.round((delta / prev) * 100) : null;
  const deltaLabel = delta === 0 ? "=" : `${delta > 0 ? "+" : "−"}${formatDuration(Math.abs(delta))}`;
  const deltaColor = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-slate-500";

  const recentWeeks = weeks.slice(-4);
  const moyenne = recentWeeks.length > 0 ? recentWeeks.reduce((a, w) => a + w.total, 0) / recentWeeks.length : 0;

  return html`
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <${Tile} label=${isCurrentWeek ? "Cette semaine" : "Semaine sélectionnée"} value=${formatDuration(total)} highlight />
      <${Tile} label="Aujourd'hui" value=${formatDuration(todayMinutes || 0)} />
      <${Tile}
        label="Évolution"
        value=${deltaLabel}
        color=${deltaColor}
        sub=${deltaPct !== null ? `${deltaPct > 0 ? "+" : ""}${deltaPct}% vs semaine précédente` : null}
      />
      <${Tile} label="Moyenne (4 dern. sem.)" value=${formatDuration(Math.round(moyenne))} />
    </div>
  `;
}
