import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { EmptyState } from "../common/EmptyState.js";
import { formatDateFr, todayStr } from "../../lib/dateUtils.js";

const STATUTS = [
  { key: "a_lire", label: "À lire", badge: "bg-slate-100 text-slate-600" },
  { key: "a_finir", label: "À finir", badge: "bg-amber-100 text-amber-700" },
  { key: "lu", label: "Lu", badge: "bg-emerald-100 text-emerald-700" },
];
const TOUT = "tout";
const statutInfo = (key) => STATUTS.find((s) => s.key === key) || STATUTS[0];

// Tags libres saisis en une chaîne séparée par des virgules (ex : "UK, Immigration").
function parseTags(s) {
  return [...new Set((s || "").split(",").map((t) => t.trim()).filter(Boolean))];
}

// Suggestions de tags par matière (sous-thèmes civi les plus fréquents) — de simples
// raccourcis cliquables qui complètent le champ, n'empêchent pas de taper autre chose.
const TAGS_SUGGERES = {
  Anglais: ["UK", "USA", "Immigration"],
  Espagnol: ["España", "América Latina", "Inmigración"],
};

function ajouteTagSuggere(input, tag) {
  const tags = parseTags(input);
  if (tags.includes(tag)) return input;
  return [...tags, tag].join(", ");
}

export function PressReviewTracker({ tab }) {
  const { data, addArticle, updateArticle, deleteArticle } = useCarnet();
  const [titre, setTitre] = useState("");
  const [source, setSource] = useState("");
  const [lien, setLien] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [statutNouveau, setStatutNouveau] = useState("a_lire");
  const [showDetails, setShowDetails] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState(TOUT);
  const [filtreTag, setFiltreTag] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitre, setEditTitre] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editLien, setEditLien] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTagsInput, setEditTagsInput] = useState("");
  const [editStatut, setEditStatut] = useState("a_lire");

  const articlesMatiere = data.veille_presse.filter((a) => a.matiere === tab.key);
  const allTags = [...new Set(articlesMatiere.flatMap((a) => a.tags || []))].sort((a, b) => a.localeCompare(b, "fr"));

  const articles = articlesMatiere
    .filter((a) => filtreStatut === TOUT || a.statut === filtreStatut)
    .filter((a) => !filtreTag || (a.tags || []).includes(filtreTag))
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleAdd = () => {
    if (!titre.trim()) return;
    addArticle({
      matiere: tab.key,
      date: todayStr(),
      titre: titre.trim(),
      source: source.trim(),
      lien: lien.trim(),
      notes: notes.trim(),
      statut: statutNouveau,
      tags: parseTags(tagsInput),
    });
    setTitre("");
    setSource("");
    setLien("");
    setNotes("");
    setTagsInput("");
    setShowDetails(false);
  };

  const openEdit = (a) => {
    setEditingId(a.id);
    setEditTitre(a.titre);
    setEditSource(a.source || "");
    setEditLien(a.lien || "");
    setEditNotes(a.notes || "");
    setEditTagsInput((a.tags || []).join(", "));
    setEditStatut(a.statut);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = () => {
    if (!editTitre.trim()) return;
    updateArticle(editingId, {
      titre: editTitre.trim(),
      source: editSource.trim(),
      lien: editLien.trim(),
      notes: editNotes.trim(),
      statut: editStatut,
      tags: parseTags(editTagsInput),
    });
    setEditingId(null);
  };

  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 class="text-base font-semibold text-slate-800 mb-4">Veille presse</h3>

      <div class="flex flex-col gap-2 mb-4">
        <div class="flex gap-2">
          <input
            class="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            placeholder="Titre de l'article…"
            value=${titre}
            onInput=${(e) => {
              setTitre(e.target.value);
              if (e.target.value.trim()) setShowDetails(true);
            }}
            onKeyDown=${(e) => e.key === "Enter" && handleAdd()}
          />
          <button
            class=${`px-2.5 rounded-lg text-xs font-medium border shrink-0 ${
              showDetails ? "bg-slate-100 text-slate-700 border-slate-300" : "text-slate-400 border-slate-200 hover:bg-slate-50"
            }`}
            onClick=${() => setShowDetails((v) => !v)}
            title="Source, lien, notes, tags, statut"
          >
            ⋯
          </button>
          <button
            class="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 shrink-0"
            style=${{ backgroundColor: tab.accent }}
            onClick=${handleAdd}
            disabled=${!titre.trim()}
          >
            Ajouter
          </button>
        </div>
        ${showDetails &&
        html`
          <div class="flex flex-col gap-2 pt-1">
            <div class="flex flex-col sm:flex-row gap-2">
              <input
                class="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                placeholder="Source (ex : The Economist)"
                value=${source}
                onInput=${(e) => setSource(e.target.value)}
              />
              <select
                class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm shrink-0"
                value=${statutNouveau}
                onChange=${(e) => setStatutNouveau(e.target.value)}
              >
                ${STATUTS.map((s) => html`<option value=${s.key}>${s.label}</option>`)}
              </select>
            </div>
            <input
              class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              placeholder="Lien de l'article (optionnel)…"
              value=${lien}
              onInput=${(e) => setLien(e.target.value)}
              onKeyDown=${(e) => e.key === "Enter" && handleAdd()}
            />
            <input
              class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              placeholder="Point clé à retenir (optionnel)…"
              value=${notes}
              onInput=${(e) => setNotes(e.target.value)}
              onKeyDown=${(e) => e.key === "Enter" && handleAdd()}
            />
            <input
              class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              placeholder="Tags, séparés par des virgules (ex : UK, Immigration)…"
              value=${tagsInput}
              onInput=${(e) => setTagsInput(e.target.value)}
              onKeyDown=${(e) => e.key === "Enter" && handleAdd()}
            />
            ${TAGS_SUGGERES[tab.key] &&
            html`
              <div class="flex items-center gap-1 flex-wrap">
                ${TAGS_SUGGERES[tab.key].map(
                  (t) => html`
                    <button
                      class="px-2 py-0.5 rounded-full text-[11px] font-medium border text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600"
                      onClick=${() => setTagsInput((v) => ajouteTagSuggere(v, t))}
                    >
                      + ${t}
                    </button>
                  `
                )}
              </div>
            `}
          </div>
        `}
      </div>

      <div class="flex items-center gap-1 flex-wrap mb-3">
        ${[{ key: TOUT, label: "Tous" }, ...STATUTS].map((s) => {
          const isActive = filtreStatut === s.key;
          return html`
            <button
              class=${`px-2.5 py-1 rounded-lg text-xs font-medium ${
                isActive ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
              onClick=${() => setFiltreStatut(s.key)}
            >
              ${s.label}
            </button>
          `;
        })}
        ${allTags.length > 0 && html`<span class="w-px self-stretch bg-slate-200 mx-1"></span>`}
        ${allTags.map(
          (t) => html`
            <button
              class=${`px-2.5 py-1 rounded-lg text-xs font-medium ${
                filtreTag === t ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
              onClick=${() => setFiltreTag(filtreTag === t ? null : t)}
            >
              ${t}
            </button>
          `
        )}
      </div>

      ${articles.length === 0
        ? html`<${EmptyState} text="Aucun article pour l'instant." />`
        : html`
            <ul class="divide-y divide-slate-100 max-h-96 overflow-y-auto overflow-x-hidden">
              ${articles.map((a) =>
                editingId === a.id
                  ? html`
                      <li key=${a.id} class="py-2.5">
                        <div class="flex flex-col gap-2">
                          <input
                            class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                            placeholder="Titre de l'article…"
                            value=${editTitre}
                            onInput=${(e) => setEditTitre(e.target.value)}
                            onKeyDown=${(e) => e.key === "Enter" && saveEdit()}
                          />
                          <input
                            class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                            placeholder="Source"
                            value=${editSource}
                            onInput=${(e) => setEditSource(e.target.value)}
                            onKeyDown=${(e) => e.key === "Enter" && saveEdit()}
                          />
                          <input
                            class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                            placeholder="Lien de l'article…"
                            value=${editLien}
                            onInput=${(e) => setEditLien(e.target.value)}
                            onKeyDown=${(e) => e.key === "Enter" && saveEdit()}
                          />
                          <input
                            class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                            placeholder="Point clé à retenir…"
                            value=${editNotes}
                            onInput=${(e) => setEditNotes(e.target.value)}
                            onKeyDown=${(e) => e.key === "Enter" && saveEdit()}
                          />
                          <select
                            class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
                            value=${editStatut}
                            onChange=${(e) => setEditStatut(e.target.value)}
                          >
                            ${STATUTS.map((s) => html`<option value=${s.key}>${s.label}</option>`)}
                          </select>
                          <input
                            class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                            placeholder="Tags, séparés par des virgules (ex : UK, Immigration)…"
                            value=${editTagsInput}
                            onInput=${(e) => setEditTagsInput(e.target.value)}
                            onKeyDown=${(e) => e.key === "Enter" && saveEdit()}
                          />
                          ${TAGS_SUGGERES[tab.key] &&
                          html`
                            <div class="flex items-center gap-1 flex-wrap">
                              ${TAGS_SUGGERES[tab.key].map(
                                (t) => html`
                                  <button
                                    class="px-2 py-0.5 rounded-full text-[11px] font-medium border text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600"
                                    onClick=${() => setEditTagsInput((v) => ajouteTagSuggere(v, t))}
                                  >
                                    + ${t}
                                  </button>
                                `
                              )}
                            </div>
                          `}
                          <div class="flex items-center justify-end gap-3 text-xs">
                            <button class="text-slate-500 hover:text-slate-700" onClick=${cancelEdit}>Annuler</button>
                            <button
                              class="px-3 py-1 rounded-lg text-white font-medium disabled:opacity-50"
                              style=${{ backgroundColor: tab.accent }}
                              onClick=${saveEdit}
                              disabled=${!editTitre.trim()}
                            >
                              Enregistrer
                            </button>
                          </div>
                        </div>
                      </li>
                    `
                  : html`
                      <li key=${a.id} class="py-2.5">
                        <div class="flex items-start justify-between gap-2">
                          <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                              ${a.lien
                                ? html`
                                    <a
                                      href=${a.lien}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      class="text-sm font-medium text-slate-700 hover:underline"
                                    >
                                      ${a.titre} 🔗
                                    </a>
                                  `
                                : html`<p class="text-sm font-medium text-slate-700">${a.titre}</p>`}
                              <span class=${`px-1.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${statutInfo(a.statut).badge}`}>
                                ${statutInfo(a.statut).label}
                              </span>
                              ${a.tags &&
                              a.tags.map(
                                (t) => html`
                                  <button
                                    class="px-1.5 py-0.5 rounded-full text-[11px] font-medium border text-slate-500 border-slate-200 hover:bg-slate-50 shrink-0"
                                    onClick=${() => setFiltreTag(filtreTag === t ? null : t)}
                                  >
                                    ${t}
                                  </button>
                                `
                              )}
                            </div>
                            <p class="text-xs text-slate-400">
                              ${formatDateFr(a.date)}${a.source ? ` · ${a.source}` : ""}
                            </p>
                            ${a.notes && html`<p class="text-sm text-slate-600 mt-1">${a.notes}</p>`}
                          </div>
                          <div class="flex items-center gap-2 text-xs shrink-0">
                            <button class="text-slate-400 hover:text-slate-700" onClick=${() => openEdit(a)}>Modifier</button>
                            <button
                              class="text-slate-300 hover:text-red-500 text-sm leading-none"
                              onClick=${() => confirm(`Supprimer "${a.titre}" ?`) && deleteArticle(a.id)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </li>
                    `
              )}
            </ul>
          `}
    </div>
  `;
}
