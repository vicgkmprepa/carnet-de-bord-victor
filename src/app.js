import { useState } from "./lib/react.js";
import { html } from "./lib/htm.js";
import { DataProvider, useCarnet } from "./state/store.js";
import { Layout } from "./components/layout/Layout.js";
import { Dashboard } from "./components/dashboard/Dashboard.js";
import { Agenda } from "./components/agenda/Agenda.js";
import { TimeTracking } from "./components/timetracking/TimeTracking.js";
import { ObjectivesNotes } from "./components/objectives/ObjectivesNotes.js";
import { SubjectTab } from "./components/subject/SubjectTab.js";
import { SUBJECT_TABS } from "./lib/subjectMapping.js";

function Shell() {
  const [active, setActive] = useState("dashboard");
  const [agendaFocusDate, setAgendaFocusDate] = useState(null);
  const { status, loadError, saveStatus, conflictNotice, dismissConflictNotice, readOnly, snapshotAt } = useCarnet();

  // Ouvre l'Agenda directement sur une date précise (ex : clic sur une barre dans un
  // graphique de Temps de travail) — l'Agenda est démonté/remonté à chaque
  // changement d'onglet (rendu conditionnel ci-dessous), donc son état interne se
  // réinitialise sur initialDate à chaque ouverture, sans effet de bord persistant.
  const openAgendaAt = (dateStr) => {
    setAgendaFocusDate(dateStr);
    setActive("agenda");
    window.scrollTo(0, 0);
  };

  if (status === "loading") {
    return html`<div class="min-h-screen flex items-center justify-center text-slate-400">Chargement…</div>`;
  }

  if (status === "error") {
    return html`
      <div class="min-h-screen flex items-center justify-center text-center px-6">
        <div>
          <p class="text-red-600 font-medium mb-2">Impossible de charger data.json</p>
          <p class="text-sm text-slate-500">${loadError}</p>
          <p class="text-sm text-slate-500 mt-2">Vérifie que le serveur (python3 server.py) tourne bien.</p>
        </div>
      </div>
    `;
  }

  const subjectTab = SUBJECT_TABS.find((t) => t.key === active);

  return html`
    <${Layout}
      active=${active}
      onChangeTab=${setActive}
      saveStatus=${saveStatus}
      conflictNotice=${conflictNotice}
      onDismissConflict=${dismissConflictNotice}
      readOnly=${readOnly}
      snapshotAt=${snapshotAt}
    >
      ${active === "dashboard" && html`<${Dashboard} onChangeTab=${setActive} />`}
      ${active === "agenda" && html`<${Agenda} initialDate=${agendaFocusDate} />`}
      ${active === "temps" && html`<${TimeTracking} onChangeTab=${setActive} onOpenAgendaDay=${openAgendaAt} />`}
      ${active === "objectifs" && html`<${ObjectivesNotes} />`}
      ${subjectTab && html`<${SubjectTab} tab=${subjectTab} />`}
    <//>
  `;
}

export default function App() {
  return html`
    <${DataProvider}>
      <${Shell} />
    <//>
  `;
}
