import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { CB_MATIERES, CAUSES_ERREUR } from "../../lib/subjectMapping.js";

function emptyMatieres() {
  return CB_MATIERES.map((nom) => ({ nom, note_objectif: "", note_obtenue: "", commentaire: "", causes_erreur: [] }));
}

function toDraft(cb) {
  if (!cb) {
    return {
      nom: "",
      date: "",
      matieres: emptyMatieres(),
      classement_section: "",
      effectif_section: "",
      classement_promo: "",
      effectif_promo: "",
    };
  }
  const standard = CB_MATIERES.map((nom) => {
    const existing = cb.matieres.find((m) => m.nom === nom);
    return {
      nom,
      note_objectif:
        existing && existing.note_objectif !== null && existing.note_objectif !== undefined ? existing.note_objectif : "",
      note_obtenue:
        existing && existing.note_obtenue !== null && existing.note_obtenue !== undefined ? existing.note_obtenue : "",
      commentaire: (existing && existing.commentaire) || "",
      causes_erreur: (existing && existing.causes_erreur) || [],
    };
  });
  // Matières supplémentaires ajoutées à ce CB précis (ex : une matière testée deux
  // fois sur deux jours distincts) — non standard, absentes de CB_MATIERES.
  const extra = cb.matieres
    .filter((m) => !CB_MATIERES.includes(m.nom))
    .map((m) => ({
      nom: m.nom,
      note_objectif: m.note_objectif ?? "",
      note_obtenue: m.note_obtenue ?? "",
      commentaire: m.commentaire || "",
      causes_erreur: m.causes_erreur || [],
    }));
  return {
    nom: cb.nom || "",
    date: cb.date || "",
    matieres: [...standard, ...extra],
    classement_section: cb.classement_section ?? "",
    effectif_section: cb.effectif_section ?? "",
    classement_promo: cb.classement_promo ?? "",
    effectif_promo: cb.effectif_promo ?? "",
  };
}

function toNumberOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function CBForm({ initialCB, onSubmit, onCancel }) {
  const [draft, setDraft] = useState(() => toDraft(initialCB));

  const setMatiereField = (nom, field, value) => {
    setDraft((d) => ({
      ...d,
      matieres: d.matieres.map((m) => (m.nom === nom ? { ...m, [field]: value } : m)),
    }));
  };

  const toggleCause = (nom, cause) => {
    setDraft((d) => ({
      ...d,
      matieres: d.matieres.map((m) =>
        m.nom === nom
          ? { ...m, causes_erreur: m.causes_erreur.includes(cause) ? m.causes_erreur.filter((c) => c !== cause) : [...m.causes_erreur, cause] }
          : m
      ),
    }));
  };

  const canSubmit = draft.nom.trim() && draft.date;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      nom: draft.nom.trim(),
      date: draft.date,
      matieres: draft.matieres.map((m) => ({
        nom: m.nom,
        note_objectif: toNumberOrNull(m.note_objectif),
        note_obtenue: toNumberOrNull(m.note_obtenue),
        commentaire: m.commentaire || "",
        causes_erreur: m.causes_erreur,
      })),
      classement_section: toNumberOrNull(draft.classement_section),
      effectif_section: toNumberOrNull(draft.effectif_section),
      classement_promo: toNumberOrNull(draft.classement_promo),
      effectif_promo: toNumberOrNull(draft.effectif_promo),
    });
  };

  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
      <h3 class="text-base font-semibold text-slate-800 mb-4">${initialCB ? "Modifier le CB" : "Ajouter un CB"}</h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <label class="text-sm text-slate-600">
          Nom du CB
          <input
            class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value=${draft.nom}
            onInput=${(e) => setDraft((d) => ({ ...d, nom: e.target.value }))}
            placeholder="CB1"
          />
        </label>
        <label class="text-sm text-slate-600">
          Date
          <input
            type="date"
            class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value=${draft.date}
            onChange=${(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          />
        </label>
      </div>

      <div class="overflow-x-auto -mx-1">
        <table class="w-full text-sm min-w-[560px]">
          <thead>
            <tr class="text-left text-slate-500">
              <th class="px-1 py-1.5 font-medium">Matière</th>
              <th class="px-1 py-1.5 font-medium w-24">Objectif</th>
              <th class="px-1 py-1.5 font-medium w-24">Obtenue</th>
              <th class="px-1 py-1.5 font-medium">Commentaire</th>
            </tr>
          </thead>
          <tbody>
            ${draft.matieres.map(
              (m) => html`
                <tr key=${m.nom} class="border-t border-slate-100">
                  <td class="px-1 py-1.5 font-medium text-slate-700 whitespace-nowrap">${m.nom}</td>
                  <td class="px-1 py-1.5">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="20"
                      class="w-20 border border-slate-300 rounded-md px-2 py-1"
                      value=${m.note_objectif}
                      onInput=${(e) => setMatiereField(m.nom, "note_objectif", e.target.value)}
                    />
                  </td>
                  <td class="px-1 py-1.5">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="20"
                      class="w-20 border border-slate-300 rounded-md px-2 py-1"
                      value=${m.note_obtenue}
                      onInput=${(e) => setMatiereField(m.nom, "note_obtenue", e.target.value)}
                    />
                  </td>
                  <td class="px-1 py-1.5">
                    <input
                      class="w-full border border-slate-300 rounded-md px-2 py-1"
                      value=${m.commentaire}
                      onInput=${(e) => setMatiereField(m.nom, "commentaire", e.target.value)}
                      placeholder="Commentaire…"
                    />
                  </td>
                </tr>
                <tr key=${m.nom + "-causes"} class="border-t border-dashed border-slate-100">
                  <td colspan="4" class="px-1 py-1.5">
                    <div class="flex flex-wrap gap-1.5">
                      ${CAUSES_ERREUR.map((cause) => {
                        const active = m.causes_erreur.includes(cause);
                        return html`
                          <button
                            type="button"
                            class=${`text-xs px-2 py-0.5 rounded-full border ${
                              active ? "bg-slate-800 text-white border-slate-800" : "border-slate-300 text-slate-500 hover:bg-slate-50"
                            }`}
                            onClick=${() => toggleCause(m.nom, cause)}
                          >
                            ${cause}
                          </button>
                        `;
                      })}
                    </div>
                  </td>
                </tr>
              `
            )}
          </tbody>
        </table>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <label class="text-sm text-slate-600">
          Classement section
          <input
            type="number"
            min="1"
            class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value=${draft.classement_section}
            onInput=${(e) => setDraft((d) => ({ ...d, classement_section: e.target.value }))}
          />
        </label>
        <label class="text-sm text-slate-600">
          Effectif section
          <input
            type="number"
            min="1"
            class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value=${draft.effectif_section}
            onInput=${(e) => setDraft((d) => ({ ...d, effectif_section: e.target.value }))}
          />
        </label>
        <label class="text-sm text-slate-600">
          Classement promo
          <input
            type="number"
            min="1"
            class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value=${draft.classement_promo}
            onInput=${(e) => setDraft((d) => ({ ...d, classement_promo: e.target.value }))}
          />
        </label>
        <label class="text-sm text-slate-600">
          Effectif promo
          <input
            type="number"
            min="1"
            class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value=${draft.effectif_promo}
            onInput=${(e) => setDraft((d) => ({ ...d, effectif_promo: e.target.value }))}
          />
        </label>
      </div>

      <div class="flex justify-end gap-2 mt-5">
        <button class="px-4 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100" onClick=${onCancel}>
          Annuler
        </button>
        <button
          class=${`px-4 py-1.5 rounded-lg text-sm font-medium text-white ${
            canSubmit ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300 cursor-not-allowed"
          }`}
          onClick=${handleSubmit}
          disabled=${!canSubmit}
        >
          ${initialCB ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </div>
  `;
}
