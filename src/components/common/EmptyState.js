import { html } from "../../lib/htm.js";

export function EmptyState({ text }) {
  return html`<p class="text-sm text-slate-400 italic py-4 text-center">${text}</p>`;
}
