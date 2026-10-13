import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { SUBJECT_TABS, subjectAccent } from "../../lib/subjectMapping.js";
import { daysUntil } from "../../lib/dateUtils.js";
import { colleHoraires } from "../../lib/colleUtils.js";

const MAIN_TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "agenda", label: "Agenda" },
  { key: "temps", label: "Temps de travail" },
  { key: "objectifs", label: "Objectifs & Notes" },
];

export function TabNav({ active, onChange }) {
  const { data } = useCarnet();
  const now = new Date().toTimeString().slice(0, 5);
  const couleursColleAujourdhui = [
    ...new Set(
      data.colles
        .filter((c) => daysUntil(c.date) === 0 && colleHoraires(c).finColle > now)
        .map((c) => subjectAccent(c.matiere))
    ),
  ];

  return html`
    <nav class="no-scrollbar flex flex-nowrap items-center gap-1.5 max-w-6xl mx-auto px-4 sm:px-6 py-2.5 overflow-x-auto">
      ${MAIN_TABS.map(
        (t) => html`
          <${TabButton} key=${t.key} active=${active === t.key} onClick=${() => onChange(t.key)} badge=${t.key === "agenda" ? couleursColleAujourdhui : []}>
            ${t.label}
          <//>
        `
      )}
      <span class="w-px self-stretch shrink-0 bg-slate-200 mx-1.5 my-1"></span>
      ${SUBJECT_TABS.map(
        (t) => html`
          <${TabButton} key=${t.key} active=${active === t.key} onClick=${() => onChange(t.key)} accent=${t.accent}>
            ${t.label}
          <//>
        `
      )}
    </nav>
  `;
}

function TabButton({ active, onClick, accent, badge, children }) {
  const activeStyle = accent
    ? { backgroundColor: accent, color: "#fff", borderColor: accent }
    : { backgroundColor: "#0F172A", color: "#fff", borderColor: "#0F172A" };
  const classes = `relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap shrink-0 ${
    active ? "" : "border-transparent text-slate-600 hover:bg-slate-100"
  }`;
  return html`
    <button class=${classes} style=${active ? activeStyle : {}} onClick=${onClick} title=${badge?.length ? "Colle aujourd'hui" : undefined}>
      ${accent &&
      html`<span
        class="inline-block h-2 w-2 rounded-full mr-1.5 align-middle"
        style=${{ backgroundColor: active ? "#fff" : accent }}
      ></span>`}
      ${children}
      ${badge?.length > 0 &&
      html`<span class="absolute -top-1 -right-1 flex gap-0.5">
        ${badge.map((c) => html`<span key=${c} class="h-2.5 w-2.5 rounded-full border-2 border-white" style=${{ backgroundColor: c }}></span>`)}
      </span>`}
    </button>
  `;
}
