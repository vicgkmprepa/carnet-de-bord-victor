import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";

// Affiche le texte compilé des exercices à revoir dans une zone copiable — pour
// relire ou imprimer une fiche avant un concours blanc sans naviguer annale par
// annale. Pas de dépendance au presse-papiers : la sélection manuelle marche
// toujours, même si l'API Clipboard est indisponible.
export function FicheRevisionModal({ texte, onClose }) {
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      setCopie(false);
    }
  };

  return html`
    <div class="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4" onClick=${onClose}>
      <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[85vh] flex flex-col" onClick=${(e) => e.stopPropagation()}>
        <div class="flex items-start justify-between gap-3 mb-3">
          <h3 class="text-base font-semibold text-slate-800">Fiche de révision</h3>
          <button class="text-slate-400 hover:text-slate-700 text-lg leading-none shrink-0" onClick=${onClose}>✕</button>
        </div>
        <textarea
          readOnly
          class="w-full flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 resize-none bg-slate-50"
          rows="16"
          value=${texte}
          onClick=${(e) => e.target.select()}
        ></textarea>
        <div class="flex items-center justify-between mt-3">
          <span class="text-xs text-slate-400">${copie ? "Copié ✓" : "Clique dans le texte pour tout sélectionner"}</span>
          <button class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-slate-900 hover:bg-slate-800" onClick=${copier}>
            Copier
          </button>
        </div>
      </div>
    </div>
  `;
}
