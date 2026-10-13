import { html } from "../../lib/htm.js";

const MAP = {
  idle: null,
  saving: { text: "Enregistrement…", dot: "bg-amber-400 animate-pulse" },
  saved: { text: "Enregistré", dot: "bg-emerald-500" },
  error: { text: "Erreur d'enregistrement", dot: "bg-red-500" },
  conflict: { text: "Conflit — page actualisée", dot: "bg-orange-500" },
  readonly: { text: "Lecture seule", dot: "bg-slate-400" },
};

export function SaveIndicator({ status }) {
  const s = MAP[status];
  if (!s) return null;
  return html`
    <div class="flex items-center gap-1.5 text-xs text-slate-500">
      <span class=${`h-1.5 w-1.5 rounded-full ${s.dot}`}></span>
      ${s.text}
    </div>
  `;
}
