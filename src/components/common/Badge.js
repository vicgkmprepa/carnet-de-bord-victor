import { html } from "../../lib/htm.js";

export function Badge({ label, color = "#64748B", className = "" }) {
  return html`
    <span
      class=${`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}
      style=${{ borderColor: color, color, backgroundColor: `${color}18` }}
    >
      <span class="h-1.5 w-1.5 rounded-full shrink-0" style=${{ backgroundColor: color }}></span>
      ${label}
    </span>
  `;
}
