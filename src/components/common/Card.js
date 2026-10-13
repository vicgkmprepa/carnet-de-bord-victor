import { html } from "../../lib/htm.js";

export function Card({ title, subtitle, actions, children, className = "" }) {
  const hasHeader = Boolean(title || subtitle || actions);
  return html`
    <div class=${`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 ${className}`}>
      ${hasHeader &&
      html`
        <div class="flex items-start justify-between mb-4 gap-3">
          <div>
            ${title && html`<h3 class="text-base font-semibold text-slate-800">${title}</h3>`}
            ${subtitle && html`<p class="text-sm text-slate-500 mt-0.5">${subtitle}</p>`}
          </div>
          ${actions && html`<div class="flex items-center gap-2 shrink-0">${actions}</div>`}
        </div>
      `}
      ${children}
    </div>
  `;
}
