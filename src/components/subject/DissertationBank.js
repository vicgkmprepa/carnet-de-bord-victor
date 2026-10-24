import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { EmptyState } from "../common/EmptyState.js";
import { formatDateFr, todayStr } from "../../lib/dateUtils.js";

const STATUTS = [
  { key: "a_faire", label: "À faire", badge: "bg-slate-100 text-slate-600" },
  { key: "traite", label: "Traité", badge: "bg-emerald-100 text-emerald-700" },
  { key: "vu_cb", label: "Vu en CB", badge: "bg-blue-100 text-blue-700" },
  { key: "vu_dst", label: "Vu en DST du week-end", badge: "bg-purple-100 text-purple-700" },
];
const TOUT = "tout";
const statutInfo = (key) => STATUTS.find((s) => s.key === key) || STATUTS[1];

const TYPES_CORRECTION = ["Introduction uniquement", "Plan uniquement", "Introduction + Plan", "Correction complète"];

// Types de révision rapide : un clic suffit à tracer qu'on est retourné sur un
// sujet déjà traité (sans toucher à sa correction d'origine) et à le faire
// remonter en tête de liste (triée sur la révision la plus récente).
const TYPES_REVISION = ["Introduction", "Plan", "Rédaction complète"];

// Date de la révision la plus récente d'un sujet, ou sa date de traitement
// initiale s'il n'a jamais été revu — c'est sur cette date que la liste trie.
function derniereActivite(s) {
  const dates = [s.date, ...(s.revisions || []).map((r) => r.date)].filter(Boolean);
  return dates.length ? dates.reduce((max, d) => (d > max ? d : max)) : "";
}

function normaliseRecherche(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function motsSignificatifs(s) {
  return (normaliseRecherche(s).match(/[a-z0-9]+/g) || []).filter((m) => m.length > 2);
}

// Distance d'édition, coupée court si les longueurs divergent trop.
function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 6) return 99;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Détection de doublon volontairement souple — un sujet reformulé ou mal
// orthographié doit quand même déclencher l'avertissement : nom quasi
// identique, faute de frappe, ou forte intersection de mots-clés significatifs
// (l'ordre des mots n'a pas d'importance). Reste un simple avertissement, pas
// un blocage — mieux vaut un faux positif qu'un vrai doublon raté.
function trouveDoublonProbable(nomNouveau, sujetsExistants) {
  const normPlein = (s) => normaliseRecherche(s).replace(/[^a-z0-9]/g, "");
  const normA = normPlein(nomNouveau);
  if (!normA) return null;
  const motsA = motsSignificatifs(nomNouveau);
  const setA = new Set(motsA);

  return (
    sujetsExistants.find((existant) => {
      const normB = normPlein(existant.sujet);
      if (!normB) return false;
      if (normA === normB) return true;
      if (levenshtein(normA, normB) <= 3) return true;

      const motsB = motsSignificatifs(existant.sujet);
      const setB = new Set(motsB);
      const intersection = [...setA].filter((m) => setB.has(m)).length;
      const union = new Set([...setA, ...setB]).size;
      return union > 0 && Math.min(setA.size, setB.size) >= 2 && intersection / union >= 0.5;
    }) || null
  );
}

export function DissertationBank() {
  const { data, addSujet, updateSujet, deleteSujet, addRevisionSujet, deleteRevisionSujet } = useCarnet();
  const [sujet, setSujet] = useState("");
  const [remarque, setRemarque] = useState("");
  const [statutNouveau, setStatutNouveau] = useState("traite");
  const [filtreStatut, setFiltreStatut] = useState(TOUT);
  const [editingId, setEditingId] = useState(null);
  const [editSujet, setEditSujet] = useState("");
  const [editRemarque, setEditRemarque] = useState("");
  const [editStatut, setEditStatut] = useState("traite");
  const [correctionOpenId, setCorrectionOpenId] = useState(null);
  const [correctionDraft, setCorrectionDraft] = useState("");
  const [typeCorrectionDraft, setTypeCorrectionDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [historiqueOpenId, setHistoriqueOpenId] = useState(null);
  const [revisionModal, setRevisionModal] = useState(null); // { sujetId, type } | null
  const [revisionNoteDraft, setRevisionNoteDraft] = useState("");

  const ouvrirRevisionModal = (sujetId, type) => {
    setRevisionModal({ sujetId, type });
    setRevisionNoteDraft("");
  };

  const validerRevision = () => {
    addRevisionSujet(revisionModal.sujetId, revisionModal.type, revisionNoteDraft);
    setRevisionModal(null);
  };

  const sujets = [...data.sujets_dissertation]
    .filter((s) => filtreStatut === TOUT || s.statut === filtreStatut)
    .sort((a, b) => derniereActivite(b).localeCompare(derniereActivite(a)));

  const doublonProbable = sujet.trim() ? trouveDoublonProbable(sujet.trim(), data.sujets_dissertation) : null;

  const handleAdd = () => {
    if (!sujet.trim()) return;
    addSujet({ sujet: sujet.trim(), date: todayStr(), remarque: remarque.trim(), statut: statutNouveau });
    setSujet("");
    setRemarque("");
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setEditSujet(s.sujet);
    setEditRemarque(s.remarque || "");
    setEditStatut(s.statut);
    setCorrectionOpenId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = () => {
    if (!editSujet.trim()) return;
    updateSujet(editingId, { sujet: editSujet.trim(), remarque: editRemarque.trim(), statut: editStatut });
    setEditingId(null);
  };

  const toggleCorrection = (s) => {
    if (correctionOpenId === s.id) {
      setCorrectionOpenId(null);
      return;
    }
    setCorrectionOpenId(s.id);
    setCorrectionDraft(s.correction || "");
    setTypeCorrectionDraft(s.typeCorrection || "");
    setNoteDraft(s.note ?? "");
  };

  const saveCorrection = (id) => {
    updateSujet(id, {
      correction: correctionDraft.trim(),
      typeCorrection: typeCorrectionDraft,
      note: noteDraft === "" ? null : Number(noteDraft),
    });
    setCorrectionOpenId(null);
  };

  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 class="text-base font-semibold text-slate-800 mb-4">Banque de sujets de dissertation</h3>

      <div class="flex flex-col gap-2 mb-4">
        <input
          class="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          placeholder="Intitulé du sujet…"
          value=${sujet}
          onInput=${(e) => setSujet(e.target.value)}
          onKeyDown=${(e) => e.key === "Enter" && handleAdd()}
        />
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            class="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            placeholder="Remarque, angle choisi… (optionnel)"
            value=${remarque}
            onInput=${(e) => setRemarque(e.target.value)}
            onKeyDown=${(e) => e.key === "Enter" && handleAdd()}
          />
          <select
            class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm shrink-0"
            value=${statutNouveau}
            onChange=${(e) => setStatutNouveau(e.target.value)}
          >
            ${STATUTS.map((s) => html`<option value=${s.key}>${s.label}</option>`)}
          </select>
          <button
            class="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 shrink-0"
            style=${{ backgroundColor: "#64748B" }}
            onClick=${handleAdd}
            disabled=${!sujet.trim()}
          >
            Ajouter
          </button>
        </div>
      </div>

      ${doublonProbable && html`<p class="mb-3 text-xs text-amber-600">⚠️ Proche de « ${doublonProbable.sujet} » déjà existant — un doublon ?</p>`}

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
      </div>

      ${sujets.length === 0
        ? html`<${EmptyState} text="Aucun sujet pour l'instant." />`
        : html`
            <ul class="divide-y divide-slate-100 max-h-96 overflow-y-auto overflow-x-hidden">
              ${sujets.map((s) =>
                editingId === s.id
                  ? html`
                      <li key=${s.id} class="py-2.5">
                        <div class="flex flex-col gap-2">
                          <input
                            class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                            value=${editSujet}
                            onInput=${(e) => setEditSujet(e.target.value)}
                            onKeyDown=${(e) => e.key === "Enter" && saveEdit()}
                          />
                          <input
                            class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                            placeholder="Remarque, angle choisi… (optionnel)"
                            value=${editRemarque}
                            onInput=${(e) => setEditRemarque(e.target.value)}
                            onKeyDown=${(e) => e.key === "Enter" && saveEdit()}
                          />
                          <select
                            class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
                            value=${editStatut}
                            onChange=${(e) => setEditStatut(e.target.value)}
                          >
                            ${STATUTS.map((st) => html`<option value=${st.key}>${st.label}</option>`)}
                          </select>
                          <div class="flex items-center justify-end gap-3 text-xs">
                            <button class="text-slate-500 hover:text-slate-700" onClick=${cancelEdit}>Annuler</button>
                            <button
                              class="px-3 py-1 rounded-lg text-white font-medium disabled:opacity-50"
                              style=${{ backgroundColor: "#64748B" }}
                              onClick=${saveEdit}
                              disabled=${!editSujet.trim()}
                            >
                              Enregistrer
                            </button>
                          </div>
                        </div>
                      </li>
                    `
                  : html`
                      <li key=${s.id} class="py-2.5">
                        <div class="flex items-start justify-between gap-2">
                          <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                              <p class="text-sm font-medium text-slate-700">${s.sujet}</p>
                              <span class=${`px-1.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${statutInfo(s.statut).badge}`}>
                                ${statutInfo(s.statut).label}
                              </span>
                              ${s.note != null && html`<span class="text-[11px] text-slate-400">${s.note}/20</span>`}
                            </div>
                            <p class="text-xs text-slate-400">
                              ${formatDateFr(s.date)}
                              ${s.revisions && s.revisions.length > 0 &&
                              html`<span class="text-indigo-500"> · revu le ${formatDateFr(s.revisions[s.revisions.length - 1].date)} (${s.revisions[s.revisions.length - 1].type})</span>`}
                            </p>
                            ${s.remarque && html`<p class="text-sm text-slate-600 mt-1">${s.remarque}</p>`}
                            <div class="flex items-center gap-1.5 flex-wrap mt-1.5">
                              ${TYPES_REVISION.map(
                                (t) => html`
                                  <button
                                    class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                    onClick=${() => ouvrirRevisionModal(s.id, t)}
                                  >
                                    ↻ ${t} faite
                                  </button>
                                `
                              )}
                            </div>
                            <button
                              class="text-xs text-slate-400 hover:text-slate-700 mt-1.5 underline decoration-dotted"
                              onClick=${() => toggleCorrection(s)}
                            >
                              ${s.correction ? "📝 Voir la correction" : "+ Ajouter une correction"}
                            </button>
                            ${s.typeCorrection && html`<span class="ml-2 text-[11px] text-slate-400">(${s.typeCorrection})</span>`}
                            ${s.revisions && s.revisions.length > 0 &&
                            html`
                              <button
                                class="text-xs text-slate-400 hover:text-slate-700 mt-1.5 ml-2 underline decoration-dotted"
                                onClick=${() => setHistoriqueOpenId(historiqueOpenId === s.id ? null : s.id)}
                              >
                                🕓 Historique (${s.revisions.length})
                              </button>
                            `}
                          </div>
                          <div class="flex items-center gap-2 text-xs shrink-0">
                            <button class="text-slate-400 hover:text-slate-700" onClick=${() => openEdit(s)}>Modifier</button>
                            <button
                              class="text-slate-300 hover:text-red-500 text-sm leading-none"
                              onClick=${() => confirm(`Supprimer "${s.sujet}" ?`) && deleteSujet(s.id)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        ${historiqueOpenId === s.id &&
                        html`
                          <ul class="mt-2 pl-3 border-l-2 border-indigo-100 space-y-1.5">
                            ${[...s.revisions].reverse().map(
                              (r) => html`
                                <li key=${r.id} class="text-xs text-slate-500">
                                  <div class="flex items-center justify-between gap-2">
                                    <span>${formatDateFr(r.date)} — ${r.type}</span>
                                    <button
                                      class="text-slate-300 hover:text-red-500 leading-none"
                                      onClick=${() => confirm(`Supprimer la révision "${r.type}" du ${formatDateFr(r.date)} ?`) && deleteRevisionSujet(s.id, r.id)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  ${r.note && html`<p class="text-slate-600 mt-0.5 whitespace-pre-wrap">${r.note}</p>`}
                                </li>
                              `
                            )}
                          </ul>
                        `}
                        ${correctionOpenId === s.id &&
                        html`
                          <div class="mt-2 pt-2">
                            <div class="flex items-center gap-2 mb-2">
                              <select
                                class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
                                value=${typeCorrectionDraft}
                                onChange=${(e) => setTypeCorrectionDraft(e.target.value)}
                              >
                                <option value="">Type de correction…</option>
                                ${TYPES_CORRECTION.map((t) => html`<option value=${t}>${t}</option>`)}
                              </select>
                              <label class="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                                Note
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="20"
                                  class="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                                  placeholder="—/20"
                                  value=${noteDraft}
                                  onInput=${(e) => setNoteDraft(e.target.value)}
                                />
                              </label>
                            </div>
                            <textarea
                              class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
                              rows="4"
                              placeholder="Plan, idées, correction..."
                              value=${correctionDraft}
                              onInput=${(e) => setCorrectionDraft(e.target.value)}
                            ></textarea>
                            <div class="flex items-center justify-end gap-2 mt-2">
                              <button class="text-xs text-slate-500 hover:text-slate-700" onClick=${() => setCorrectionOpenId(null)}>
                                Annuler
                              </button>
                              <button
                                class="px-3 py-1 rounded-lg text-xs font-medium text-white bg-slate-900 hover:bg-slate-800"
                                onClick=${() => saveCorrection(s.id)}
                              >
                                Enregistrer
                              </button>
                            </div>
                          </div>
                        `}
                      </li>
                    `
              )}
            </ul>
          `}
    </div>
    ${revisionModal &&
    html`
      <div class="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4" onClick=${() => setRevisionModal(null)}>
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick=${(e) => e.stopPropagation()}>
          <p class="text-xs font-medium text-indigo-500 uppercase tracking-wide">${revisionModal.type} faite</p>
          <h3 class="text-base font-semibold text-slate-800 mb-3">
            ${data.sujets_dissertation.find((s) => s.id === revisionModal.sujetId)?.sujet}
          </h3>
          <textarea
            autofocus
            class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
            rows="4"
            placeholder="Ce que tu as changé, trouvé, à retravailler… (optionnel)"
            value=${revisionNoteDraft}
            onInput=${(e) => setRevisionNoteDraft(e.target.value)}
          ></textarea>
          <div class="flex items-center justify-end gap-2 mt-3">
            <button class="text-xs text-slate-500 hover:text-slate-700" onClick=${() => setRevisionModal(null)}>Annuler</button>
            <button
              class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              onClick=${validerRevision}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    `}
  `;
}
