import { html } from "../../lib/htm.js";
import { TabNav } from "./TabNav.js";
import { SaveIndicator } from "../common/SaveIndicator.js";
import { formatDateTimeFr } from "../../lib/dateUtils.js";

export function Layout({ active, onChangeTab, saveStatus, conflictNotice, onDismissConflict, readOnly, snapshotAt, children }) {
  return html`
    <div class="min-h-screen flex flex-col">
      ${readOnly &&
      html`
        <div class="bg-slate-800 text-slate-100 text-xs sm:text-sm text-center py-1.5 px-3 sticky top-0 z-30">
          🔒 Aperçu en lecture seule — instantané du ${formatDateTimeFr(snapshotAt)}, pas de modification possible ici
        </div>
      `}
      <header class="bg-white border-b border-slate-200 sticky z-20" style=${{ top: readOnly ? "28px" : 0 }}>
        <div class="max-w-6xl mx-auto px-4 sm:px-6 pt-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl leading-none">📘</span>
            <h1 class="font-semibold text-slate-800">Carnet de bord — Prépa HEC</h1>
          </div>
          <${SaveIndicator} status=${saveStatus} />
        </div>
        <${TabNav} active=${active} onChange=${onChangeTab} />
      </header>
      <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">${children}</main>
      ${conflictNotice &&
      html`
        <div class="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-2xl shadow-2xl border-4 border-orange-400 p-8 w-full max-w-xl text-center">
            <p class="text-6xl mb-4">⚠️</p>
            <h2 class="text-2xl font-bold text-orange-700 mb-4">Sauvegarde refusée</h2>
            <p class="text-base text-slate-700 leading-relaxed mb-6">${conflictNotice}</p>
            <button
              class="px-6 py-3 rounded-xl text-base font-semibold text-white bg-orange-600 hover:bg-orange-700"
              onClick=${onDismissConflict}
            >
              J'ai compris
            </button>
          </div>
        </div>
      `}
    </div>
  `;
}
