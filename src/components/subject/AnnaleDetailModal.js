import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { formatDateFr, todayStr } from "../../lib/dateUtils.js";
import { formatDuration } from "../../lib/scheduleUtils.js";
import { MATHS_THEMES, MATHS_THEME_COLORS } from "../../lib/subjectMapping.js";
import { exercicesARevoir } from "../../lib/annalesMaths.js";

export const DIFFICULTES = ["Facile", "Moyen", "Difficile", "Très difficile"];

const DIFFICULTE_COLORS = {
  Facile: "bg-emerald-100 text-emerald-700",
  Moyen: "bg-amber-100 text-amber-700",
  Difficile: "bg-orange-100 text-orange-700",
  "Très difficile": "bg-red-100 text-red-700",
};

function ExerciceForm({ initial, annaleNom, getSeancesForDate, onSubmit, onCancel }) {
  const [nom, setNom] = useState(initial?.nom || "");
  const [date, setDate] = useState(initial?.date || todayStr());
  const [difficulte, setDifficulte] = useState(initial?.difficulte || "Moyen");
  const [theme, setTheme] = useState(initial?.theme || "");
  const [tempsMinutes, setTempsMinutes] = useState(initial?.tempsMinutes != null ? String(initial.tempsMinutes) : "");
  const [aRevoir, setARevoir] = useState(initial?.aRevoir || false);
  const [commentaire, setCommentaire] = useState(initial?.commentaire || "");
  const [attachKey, setAttachKey] = useState("");

  const canSubmit = Boolean(nom.trim() && date && theme);
  const seancesDuJour = getSeancesForDate ? getSeancesForDate(date) : [];

  const handleSubmit = () => {
    if (!canSubmit) return;
    const nomFinal = nom.trim();
    const cible = seancesDuJour.find((s) => s.key === attachKey);
    if (cible) cible.attach(`Annale : ${annaleNom} — ${nomFinal}`);
    const temps = tempsMinutes.trim() === "" ? null : Math.max(0, Math.round(Number(tempsMinutes)));
    onSubmit({
      nom: nomFinal,
      date,
      difficulte,
      theme,
      tempsMinutes: Number.isFinite(temps) ? temps : null,
      aRevoir,
      commentaire: commentaire.trim(),
    });
  };

  return html`
    <div class="border border-slate-200 rounded-xl p-3 bg-slate-50">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <input
          class="col-span-2 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
          placeholder="Ex : Exercice 2"
          value=${nom}
          autoFocus
          onInput=${(e) => setNom(e.target.value)}
        />
        <input
          type="date"
          class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
          value=${date}
          onChange=${(e) => {
            setDate(e.target.value);
            setAttachKey("");
          }}
        />
        <select
          class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
          value=${difficulte}
          onChange=${(e) => setDifficulte(e.target.value)}
        >
          ${DIFFICULTES.map((d) => html`<option value=${d}>${d}</option>`)}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <select
          class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm text-slate-600"
          value=${theme}
          onChange=${(e) => setTheme(e.target.value)}
        >
          <option value="">Thème (obligatoire)</option>
          ${MATHS_THEMES.filter((t) => t !== "Annale").map((t) => html`<option value=${t}>${t}</option>`)}
        </select>
        <input
          type="number"
          min="0"
          class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
          placeholder="Temps passé (min)"
          value=${tempsMinutes}
          onInput=${(e) => setTempsMinutes(e.target.value)}
        />
      </div>
      ${seancesDuJour.length > 0 &&
      html`
        <select
          class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm mb-2 text-slate-600"
          value=${attachKey}
          onChange=${(e) => setAttachKey(e.target.value)}
        >
          <option value="">Ne pas rattacher à une séance</option>
          ${seancesDuJour.map((s) => html`<option value=${s.key}>Rattacher à ${s.debut}–${s.fin} · ${s.label}</option>`)}
        </select>
      `}
      <textarea
        class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm resize-none mb-2"
        rows="2"
        placeholder="Commentaire (optionnel)…"
        value=${commentaire}
        onInput=${(e) => setCommentaire(e.target.value)}
      ></textarea>
      <div class="flex items-center justify-between">
        <label class="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked=${aRevoir} onChange=${(e) => setARevoir(e.target.checked)} />
          À revoir
        </label>
        <div class="flex gap-2">
          <button class="px-3 py-1 rounded-lg text-xs text-slate-600 hover:bg-slate-100" onClick=${onCancel}>Annuler</button>
          <button
            class=${`px-3 py-1 rounded-lg text-xs font-medium text-white ${canSubmit ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300 cursor-not-allowed"}`}
            onClick=${handleSubmit}
            disabled=${!canSubmit}
          >
            ${initial ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  `;
}

// Regroupe le journal par nom d'exercice (insensible à la casse/espaces) — permet
// de lire toutes les tentatives d'un même exercice les unes à la suite pour voir
// l'évolution, plutôt que la liste chronologique unique où elles peuvent être
// séparées par d'autres exercices.
function groupByNom(exercices) {
  const groups = new Map();
  for (const ex of exercices) {
    const key = ex.nom.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ex);
  }
  return Array.from(groups.values())
    .map((attempts) => ({
      nom: attempts[0].nom,
      attempts: attempts.slice().sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.attempts[0].date.localeCompare(a.attempts[0].date));
}

// Page de détail d'une annale : journal des exercices travaillés dedans. Un même
// exercice peut être retravaillé et logué plusieurs fois à des dates différentes
// — volontairement pas de déduplication, chaque tentative garde sa propre ligne
// (date, difficulté ressentie ce jour-là, commentaire), pour voir l'évolution.
export function AnnaleDetailModal({
  annale,
  getSeancesForDate,
  onClose,
  onDeleteAnnale,
  onRename,
  onAddExercice,
  onUpdateExercice,
  onDeleteExercice,
  onAddTentativeBlanche,
  onUpdateTentativeBlanche,
  onDeleteTentativeBlanche,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingNom, setEditingNom] = useState(false);
  const [nomDraft, setNomDraft] = useState(annale.nom);
  const [grouped, setGrouped] = useState(false);
  const [filtreTheme, setFiltreTheme] = useState("");
  const [attachOpenId, setAttachOpenId] = useState(null);
  const [attachChoice, setAttachChoice] = useState("");
  const [showBlancheForm, setShowBlancheForm] = useState(false);
  const [blancheDate, setBlancheDate] = useState(todayStr());
  const [blancheCommentaire, setBlancheCommentaire] = useState("");
  const [tentativeOpenId, setTentativeOpenId] = useState(null);
  const [tentativeEditDate, setTentativeEditDate] = useState("");
  const [tentativeEditCommentaire, setTentativeEditCommentaire] = useState("");

  const exercices = [...annale.exercices]
    .filter((ex) => !filtreTheme || ex.theme === filtreTheme)
    .sort((a, b) => b.date.localeCompare(a.date));
  const themesPresents = MATHS_THEMES.filter((t) => t !== "Annale" && annale.exercices.some((ex) => ex.theme === t));
  // "À revoir" reflète uniquement la dernière tentative de chaque exercice — le
  // retravailler efface donc automatiquement le repère, même si une ancienne
  // ligne du journal garde encore le drapeau à true.
  const exosARevoir = exercicesARevoir(annale.exercices);
  const idsARevoirEffectif = new Set(exosARevoir.map((ex) => ex.id));
  const nbARevoir = exosARevoir.length;
  const tentatives = [...annale.tentativesBlanches].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const toggleTentative = (t) => {
    if (tentativeOpenId === t.id) {
      setTentativeOpenId(null);
      return;
    }
    setTentativeOpenId(t.id);
    setTentativeEditDate(t.date || "");
    setTentativeEditCommentaire(t.commentaire || "");
  };

  const saveTentative = () => {
    onUpdateTentativeBlanche(tentativeOpenId, { date: tentativeEditDate || null, commentaire: tentativeEditCommentaire.trim() });
    setTentativeOpenId(null);
  };

  const saveNom = () => {
    if (nomDraft.trim()) onRename(nomDraft.trim());
    setEditingNom(false);
  };

  const toggleAttach = (ex) => {
    if (attachOpenId === ex.id) {
      setAttachOpenId(null);
    } else {
      setAttachOpenId(ex.id);
      setAttachChoice("");
    }
  };

  const confirmAttach = (ex, seances) => {
    const cible = seances.find((s) => s.key === attachChoice);
    if (cible) cible.attach(`Annale : ${annale.nom} — ${ex.nom}`);
    setAttachOpenId(null);
  };

  const renderRow = (ex, tentativePrecedente) => {
    if (editingId === ex.id) {
      return html`
        <li key=${ex.id}>
          <${ExerciceForm}
            initial=${ex}
            annaleNom=${annale.nom}
            getSeancesForDate=${getSeancesForDate}
            onSubmit=${(patch) => {
              onUpdateExercice(ex.id, patch);
              setEditingId(null);
            }}
            onCancel=${() => setEditingId(null)}
          />
        </li>
      `;
    }
    const seancesDuJour = getSeancesForDate ? getSeancesForDate(ex.date) : [];
    // Badge automatique : aucun marquage manuel — si la date de l'exercice
    // correspond à une tentative en blanche enregistrée pour cette annale, on le
    // signale directement (l'exercice a forcément été fait dans ce cadre-là).
    const tentativeMatch = annale.tentativesBlanches.find((t) => t.date && t.date === ex.date);
    return html`
      <li key=${ex.id} class="border border-slate-100 rounded-xl p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
              ${ex.nom}
              ${idsARevoirEffectif.has(ex.id) && html`<span class="text-amber-500" title="À revoir">🔖</span>`}
              ${ex.theme &&
              html`
                <span class="inline-flex items-center gap-1 text-xs font-normal text-slate-500 shrink-0">
                  <span class="inline-block h-2 w-2 rounded-full shrink-0" style=${{ backgroundColor: MATHS_THEME_COLORS[ex.theme] }}></span>
                  ${ex.theme}
                </span>
              `}
              ${tentativeMatch &&
              html`
                <span
                  class="inline-flex items-center gap-1 text-[11px] font-normal text-indigo-600 shrink-0"
                  title=${tentativeMatch.commentaire || ""}
                >
                  ⏱️ Annale blanche du ${formatDateFr(tentativeMatch.date)}
                </span>
              `}
            </p>
            <p class="text-xs text-slate-400">
              ${formatDateFr(ex.date)}${ex.tempsMinutes ? ` · ${formatDuration(ex.tempsMinutes)}` : ""}
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${tentativePrecedente &&
            (() => {
              const curIdx = DIFFICULTES.indexOf(ex.difficulte);
              const prevIdx = DIFFICULTES.indexOf(tentativePrecedente.difficulte);
              if (curIdx === prevIdx || curIdx === -1 || prevIdx === -1) return null;
              const progres = curIdx < prevIdx;
              return html`
                <span class=${progres ? "text-emerald-500" : "text-red-500"} title=${progres ? "Plus facile que la tentative précédente" : "Plus difficile que la tentative précédente"}>
                  ${progres ? "↗" : "↘"}
                </span>
              `;
            })()}
            <span class=${`px-2 py-0.5 rounded-full text-xs font-medium ${DIFFICULTE_COLORS[ex.difficulte] || "bg-slate-100 text-slate-600"}`}>
              ${ex.difficulte}
            </span>
            ${seancesDuJour.length > 0 &&
            html`<button class="text-slate-400 hover:text-slate-700 text-xs" title="Rattacher à une séance" onClick=${() => toggleAttach(ex)}>🔗</button>`}
            <button class="text-slate-400 hover:text-slate-700 text-xs" onClick=${() => setEditingId(ex.id)}>Modifier</button>
            <button class="text-slate-300 hover:text-red-500 text-sm leading-none" onClick=${() => onDeleteExercice(ex.id)}>✕</button>
          </div>
        </div>
        ${ex.commentaire && html`<p class="text-sm text-slate-600 mt-2">${ex.commentaire}</p>`}
        ${attachOpenId === ex.id &&
        html`
          <div class="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
            <select
              class="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-600"
              value=${attachChoice}
              onChange=${(e) => setAttachChoice(e.target.value)}
            >
              <option value="">Choisir une séance de ce jour…</option>
              ${seancesDuJour.map((s) => html`<option value=${s.key}>${s.debut}–${s.fin} · ${s.label}</option>`)}
            </select>
            <button
              class=${`px-2.5 py-1 rounded-lg text-xs font-medium text-white ${attachChoice ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300 cursor-not-allowed"}`}
              disabled=${!attachChoice}
              onClick=${() => confirmAttach(ex, seancesDuJour)}
            >
              Rattacher
            </button>
          </div>
        `}
      </li>
    `;
  };

  return html`
    <div class="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4" onClick=${onClose}>
      <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick=${(e) => e.stopPropagation()}>
        <div class="flex items-start justify-between gap-3 mb-1">
          ${editingNom
            ? html`
                <input
                  class="text-base font-semibold text-slate-800 border border-slate-300 rounded-lg px-2 py-1 flex-1 min-w-0"
                  value=${nomDraft}
                  autoFocus
                  onInput=${(e) => setNomDraft(e.target.value)}
                  onKeyDown=${(e) => e.key === "Enter" && saveNom()}
                  onBlur=${saveNom}
                />
              `
            : html`
                <h3
                  class="text-base font-semibold text-slate-800 cursor-text"
                  title="Cliquer pour renommer"
                  onClick=${() => setEditingNom(true)}
                >
                  ${annale.nom}
                </h3>
              `}
          <button class="text-slate-400 hover:text-slate-700 text-lg leading-none shrink-0" onClick=${onClose}>✕</button>
        </div>
        <div class="flex items-center justify-between gap-2 mb-2">
          <p class="text-xs text-slate-500">
            ${annale.categorie} · ${annale.exercices.length} exercice${annale.exercices.length > 1 ? "s" : ""}${nbARevoir > 0 ? ` · ${nbARevoir} à revoir` : ""}
          </p>
          <button
            class="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border text-slate-400 border-slate-200 hover:bg-slate-50"
            onClick=${() => {
              setShowBlancheForm((v) => !v);
              setBlancheDate(todayStr());
              setBlancheCommentaire("");
            }}
            title="Enregistrer une fois où l'annale a été faite en conditions d'examen (temps limité, en une fois)"
          >
            ⏱️ + Annale blanche
          </button>
        </div>

        ${exosARevoir.length > 0 &&
        html`
          <div class="mb-3 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            🔖 À revoir : ${exosARevoir.map((ex) => ex.nom).join(", ")}
          </div>
        `}

        ${tentatives.length > 0 &&
        html`
          <div class="flex items-center gap-1.5 flex-wrap mb-2">
            ${tentatives.map(
              (t) => html`
                <button
                  key=${t.id}
                  class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  onClick=${() => toggleTentative(t)}
                >
                  ⏱️ ${t.date ? formatDateFr(t.date) : "date inconnue"}
                </button>
              `
            )}
          </div>
        `}

        ${tentativeOpenId &&
        html`
          <div class="border border-slate-200 rounded-xl p-3 bg-slate-50 mb-3">
            <div class="flex items-center justify-between gap-2 mb-2">
              <input
                type="date"
                class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
                value=${tentativeEditDate}
                onChange=${(e) => setTentativeEditDate(e.target.value)}
              />
              <button
                class="text-xs text-red-500 hover:text-red-700"
                onClick=${() => {
                  onDeleteTentativeBlanche(tentativeOpenId);
                  setTentativeOpenId(null);
                }}
              >
                Supprimer
              </button>
            </div>
            <textarea
              class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm resize-none"
              rows="2"
              placeholder="Commentaire discret sur cette tentative (optionnel)…"
              value=${tentativeEditCommentaire}
              onInput=${(e) => setTentativeEditCommentaire(e.target.value)}
            ></textarea>
            <div class="flex justify-end gap-2 mt-2">
              <button class="px-3 py-1 rounded-lg text-xs text-slate-600 hover:bg-slate-100" onClick=${() => setTentativeOpenId(null)}>Annuler</button>
              <button class="px-3 py-1 rounded-lg text-xs font-medium text-white bg-slate-900 hover:bg-slate-800" onClick=${saveTentative}>
                Enregistrer
              </button>
            </div>
          </div>
        `}

        ${showBlancheForm &&
        html`
          <div class="border border-dashed border-slate-300 rounded-xl p-3 mb-3">
            <input
              type="date"
              class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm mb-2"
              value=${blancheDate}
              onChange=${(e) => setBlancheDate(e.target.value)}
            />
            <textarea
              class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm resize-none"
              rows="2"
              placeholder="Commentaire discret (optionnel)…"
              value=${blancheCommentaire}
              onInput=${(e) => setBlancheCommentaire(e.target.value)}
            ></textarea>
            <div class="flex justify-end gap-2 mt-2">
              <button class="px-3 py-1 rounded-lg text-xs text-slate-600 hover:bg-slate-100" onClick=${() => setShowBlancheForm(false)}>Annuler</button>
              <button
                class="px-3 py-1 rounded-lg text-xs font-medium text-white bg-slate-900 hover:bg-slate-800"
                onClick=${() => {
                  onAddTentativeBlanche({ date: blancheDate || null, commentaire: blancheCommentaire.trim() });
                  setShowBlancheForm(false);
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        `}

        ${showForm
          ? html`<div class="mb-4"><${ExerciceForm} annaleNom=${annale.nom} getSeancesForDate=${getSeancesForDate} onSubmit=${(ex) => { onAddExercice(ex); setShowForm(false); }} onCancel=${() => setShowForm(false)} /></div>`
          : html`
              <button
                class="w-full mb-4 px-3 py-2 rounded-lg text-sm font-medium border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50"
                onClick=${() => setShowForm(true)}
              >
                + Ajouter un exercice travaillé
              </button>
            `}

        ${(exercices.length > 1 || themesPresents.length > 0) &&
        html`
          <div class="flex items-center gap-2 mb-2 flex-wrap">
            ${exercices.length > 1 &&
            html`
              <button
                class=${`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                  grouped ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
                onClick=${() => setGrouped((v) => !v)}
              >
                Regrouper par exercice
              </button>
            `}
            ${themesPresents.length > 0 &&
            html`
              <select
                class="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-500 bg-white"
                value=${filtreTheme}
                onChange=${(e) => setFiltreTheme(e.target.value)}
                title="Filtrer les exercices par thème"
              >
                <option value="">Tous les thèmes</option>
                ${themesPresents.map((t) => html`<option value=${t}>${t}</option>`)}
              </select>
            `}
          </div>
        `}

        ${exercices.length === 0
          ? html`<p class="text-sm text-slate-400 italic">${filtreTheme ? "Aucun exercice pour ce thème." : "Aucun exercice noté pour l'instant."}</p>`
          : grouped
          ? html`
              <div class="space-y-3">
                ${groupByNom(exercices).map(
                  (g) => html`
                    <div key=${g.nom}>
                      <p class="text-xs font-medium text-slate-500 mb-1.5">
                        ${g.nom} · ${g.attempts.length} tentative${g.attempts.length > 1 ? "s" : ""}
                      </p>
                      <ul class="space-y-2">${g.attempts.map((ex, i) => renderRow(ex, g.attempts[i + 1]))}</ul>
                    </div>
                  `
                )}
              </div>
            `
          : html`<ul class="space-y-2">${exercices.map((ex) => renderRow(ex))}</ul>`}

        <div class="mt-5 pt-3 border-t border-slate-100">
          <button
            class="text-xs text-red-500 hover:text-red-700"
            onClick=${() => {
              if (confirm(`Supprimer l'annale "${annale.nom}" et tout son journal d'exercices ?`)) onDeleteAnnale();
            }}
          >
            Supprimer cette annale
          </button>
        </div>
      </div>
    </div>
  `;
}
