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

// Formulaire d'une tentative en conditions d'examen : juste la date et, si la
// copie a été corrigée, la note et un commentaire. Le temps n'est PLUS saisi
// ici — il est calculé automatiquement en sommant le temps des exercices
// rattachés à cette tentative (cf. tempsGroupe dans le rendu des groupes).
function TentativeForm({ initial, onSubmit, onCancel, onDelete }) {
  const [date, setDate] = useState(initial?.date || todayStr());
  const [note, setNote] = useState(initial?.note != null ? String(initial.note) : "");
  const [commentaire, setCommentaire] = useState(initial?.commentaire || "");

  const handleSubmit = () => {
    const n = note.trim() === "" ? null : Number(note.replace(",", "."));
    onSubmit({ date: date || null, note: Number.isFinite(n) ? n : null, commentaire: commentaire.trim() });
  };

  return html`
    <div class="border border-indigo-200 rounded-xl p-3 bg-white">
      <div class="grid grid-cols-2 gap-2 mb-2">
        <input
          type="date"
          class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
          value=${date}
          autoFocus
          onChange=${(e) => setDate(e.target.value)}
        />
        <input
          type="number"
          min="0"
          max="20"
          step="0.5"
          class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
          placeholder="Note /20 (si corrigée)"
          value=${note}
          onInput=${(e) => setNote(e.target.value)}
        />
      </div>
      <textarea
        class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm resize-none"
        rows="2"
        placeholder="Commentaire discret sur cette tentative (optionnel)…"
        value=${commentaire}
        onInput=${(e) => setCommentaire(e.target.value)}
      ></textarea>
      <div class="flex items-center justify-between mt-2">
        ${onDelete ? html`<button class="text-xs text-red-500 hover:text-red-700" onClick=${onDelete}>Supprimer la tentative</button>` : html`<span></span>`}
        <div class="flex gap-2">
          <button class="px-3 py-1 rounded-lg text-xs text-slate-600 hover:bg-slate-100" onClick=${onCancel}>Annuler</button>
          <button class="px-3 py-1 rounded-lg text-xs font-medium text-white bg-slate-900 hover:bg-slate-800" onClick=${handleSubmit}>
            Enregistrer
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

// Un groupe par tentative enregistrée (même une tentative sans exercice encore
// logué dessus — elle apparaît alors vide, prête à recevoir des exercices de
// cette date). Les exercices dont la date ne correspond à aucune tentative
// vont dans "horsSeance" : faits isolément, hors mise en conditions.
function groupBySeance(tentativesBlanches, exercices) {
  const parDate = new Map();
  const sansDate = [];
  for (const t of tentativesBlanches) {
    const groupe = { tentative: t, items: [] };
    if (t.date) parDate.set(t.date, groupe);
    else sansDate.push(groupe);
  }
  const horsSeance = [];
  for (const ex of exercices) {
    const g = parDate.get(ex.date);
    if (g) g.items.push(ex);
    else horsSeance.push(ex);
  }
  const seances = [...parDate.values(), ...sansDate].sort((a, b) => (b.tentative.date || "").localeCompare(a.tentative.date || ""));
  return { seances, horsSeance };
}

// Page de détail d'une annale, organisée autour d'une seule idée : un bloc =
// une tentative en conditions d'examen (date, note si corrigée, temps total
// calculé automatiquement, commentaire), avec ses exercices à l'intérieur. Les
// exercices faits isolément (hors mise en conditions) sont listés à part, en
// bas. Un même exercice peut être retravaillé à des dates différentes —
// volontairement pas de déduplication, chaque tentative garde sa ligne.
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
  const [showNewTentative, setShowNewTentative] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingNom, setEditingNom] = useState(false);
  const [nomDraft, setNomDraft] = useState(annale.nom);
  const [grouped, setGrouped] = useState(false);
  const [filtreTheme, setFiltreTheme] = useState("");
  const [attachOpenId, setAttachOpenId] = useState(null);
  const [attachChoice, setAttachChoice] = useState("");
  const [attachSeanceOpenId, setAttachSeanceOpenId] = useState(null);
  const [attachSeanceChoice, setAttachSeanceChoice] = useState("");
  const [tentativeOpenId, setTentativeOpenId] = useState(null);

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
  // Calculé automatiquement par somme des temps saisis exercice par exercice —
  // jamais ressaisi à la main, ni au niveau annale ni au niveau tentative.
  const tempsTotal = annale.exercices.reduce((acc, ex) => acc + (ex.tempsMinutes || 0), 0);

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

  const toggleAttachSeance = (tentativeId) => {
    if (attachSeanceOpenId === tentativeId) {
      setAttachSeanceOpenId(null);
    } else {
      setAttachSeanceOpenId(tentativeId);
      setAttachSeanceChoice("");
    }
  };

  // Rattache en un seul geste TOUS les exercices d'une tentative (l'annale
  // entière faite en conditions d'examen) à la séance choisie, plutôt que de
  // devoir rattacher chaque exercice un par un.
  const confirmAttachSeance = (groupe, seances) => {
    const cible = seances.find((s) => s.key === attachSeanceChoice);
    if (cible) {
      const liste = groupe.items.map((ex) => ex.nom).join(", ");
      cible.attach(`Annale : ${annale.nom} (complète) — ${liste}`);
    }
    setAttachSeanceOpenId(null);
  };

  // Ligne compacte (une seule ligne, commentaire replié en dessous seulement
  // s'il y en a un). Le bouton de rattachement individuel ne s'affiche que
  // pour les exercices faits hors d'une tentative groupée : dans un groupe, le
  // rattachement se fait en un coup pour toute l'annale (confirmAttachSeance).
  const renderRow = (ex, tentativePrecedente, individualAttach = true) => {
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
    return html`
      <li key=${ex.id} class="border-l-2 pl-2 py-1" style=${{ borderColor: MATHS_THEME_COLORS[ex.theme] || "#e2e8f0" }}>
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex items-center gap-1.5 flex-wrap">
            <span class="text-sm text-slate-800 font-medium">${ex.nom}</span>
            ${idsARevoirEffectif.has(ex.id) && html`<span class="text-amber-500 text-xs" title="À revoir">🔖</span>`}
            <span class=${`px-1.5 py-0 rounded-full text-[11px] font-medium ${DIFFICULTE_COLORS[ex.difficulte] || "bg-slate-100 text-slate-600"}`}>
              ${ex.difficulte}
            </span>
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
            <span class="text-xs text-slate-400">${formatDateFr(ex.date)}${ex.tempsMinutes ? ` · ${formatDuration(ex.tempsMinutes)}` : ""}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            ${individualAttach &&
            seancesDuJour.length > 0 &&
            html`<button class="text-slate-400 hover:text-slate-700 text-xs" title="Rattacher à une séance" onClick=${() => toggleAttach(ex)}>🔗</button>`}
            <button class="text-slate-400 hover:text-slate-700 text-xs" onClick=${() => setEditingId(ex.id)}>✎</button>
            <button class="text-slate-300 hover:text-red-500 text-sm leading-none" onClick=${() => onDeleteExercice(ex.id)}>✕</button>
          </div>
        </div>
        ${ex.commentaire && html`<p class="text-xs text-slate-500 mt-0.5">${ex.commentaire}</p>`}
        ${individualAttach &&
        attachOpenId === ex.id &&
        html`
          <div class="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-100">
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

  const { seances, horsSeance } = groupBySeance(annale.tentativesBlanches, exercices);

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
        <p class="text-xs text-slate-500 mb-3">
          ${annale.categorie}${tempsTotal > 0 ? ` · ⏳ ${formatDuration(tempsTotal)} au total` : ""}${nbARevoir > 0 ? ` · ${nbARevoir} à revoir` : ""}
        </p>

        ${exosARevoir.length > 0 &&
        html`
          <div class="mb-3 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            🔖 À revoir : ${exosARevoir.map((ex) => ex.nom).join(", ")}
          </div>
        `}

        <div class="flex gap-2 mb-3">
          ${showForm
            ? html`<div class="flex-1"><${ExerciceForm} annaleNom=${annale.nom} getSeancesForDate=${getSeancesForDate} onSubmit=${(ex) => { onAddExercice(ex); setShowForm(false); }} onCancel=${() => setShowForm(false)} /></div>`
            : html`
                <button
                  class="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50"
                  onClick=${() => setShowForm(true)}
                >
                  + Exercice
                </button>
              `}
          ${!showForm &&
          (showNewTentative
            ? null
            : html`
                <button
                  class="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-dashed border-indigo-200 text-indigo-500 hover:bg-indigo-50"
                  onClick=${() => setShowNewTentative(true)}
                >
                  + Tentative (annale blanche)
                </button>
              `)}
        </div>
        ${showNewTentative &&
        !showForm &&
        html`
          <div class="mb-3">
            <${TentativeForm}
              onSubmit=${(t) => {
                onAddTentativeBlanche(t);
                setShowNewTentative(false);
              }}
              onCancel=${() => setShowNewTentative(false)}
            />
          </div>
        `}

        ${(exercices.length > 1 || themesPresents.length > 0) &&
        html`
          <div class="flex items-center gap-1 mb-2 flex-wrap">
            ${exercices.length > 1 &&
            html`
              <button
                class=${`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  grouped ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
                onClick=${() => setGrouped((v) => !v)}
              >
                Vue par exercice
              </button>
            `}
            ${themesPresents.length > 0 &&
            html`
              <button
                class=${`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  !filtreTheme ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
                onClick=${() => setFiltreTheme("")}
              >
                Tous
              </button>
            `}
            ${themesPresents.map(
              (t) => html`
                <button
                  class=${`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                    filtreTheme === t ? "text-white border-transparent" : "text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                  style=${filtreTheme === t ? { backgroundColor: MATHS_THEME_COLORS[t] } : {}}
                  onClick=${() => setFiltreTheme(t)}
                >
                  <span class="inline-block h-1.5 w-1.5 rounded-full shrink-0" style=${{ backgroundColor: filtreTheme === t ? "white" : MATHS_THEME_COLORS[t] }}></span>
                  ${t}
                </button>
              `
            )}
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
                      <p class="text-xs font-medium text-slate-500 mb-1">
                        ${g.nom} · ${g.attempts.length} tentative${g.attempts.length > 1 ? "s" : ""}
                      </p>
                      <ul class="space-y-0.5">${g.attempts.map((ex, i) => renderRow(ex, g.attempts[i + 1]))}</ul>
                    </div>
                  `
                )}
              </div>
            `
          : html`
              <div class="space-y-3">
                ${seances.length > 0 &&
                html`<p class="text-[11px] text-slate-400">⏱️ Chaque bloc = une tentative en conditions d'examen (note et temps calculés automatiquement).</p>`}
                ${seances.map((g) => {
                  const isEditing = tentativeOpenId === g.tentative.id;
                  const tempsGroupe = g.items.reduce((acc, ex) => acc + (ex.tempsMinutes || 0), 0);
                  const seancesDuJour = getSeancesForDate && g.tentative.date ? getSeancesForDate(g.tentative.date) : [];
                  return html`
                    <div key=${g.tentative.id} class="border border-indigo-100 bg-indigo-50/30 rounded-xl p-2.5">
                      ${isEditing
                        ? html`
                            <${TentativeForm}
                              initial=${g.tentative}
                              onSubmit=${(patch) => {
                                onUpdateTentativeBlanche(g.tentative.id, patch);
                                setTentativeOpenId(null);
                              }}
                              onCancel=${() => setTentativeOpenId(null)}
                              onDelete=${() => {
                                onDeleteTentativeBlanche(g.tentative.id);
                                setTentativeOpenId(null);
                              }}
                            />
                          `
                        : html`
                            <div class="flex items-start justify-between gap-2 mb-1.5">
                              <button class="min-w-0 text-left flex-1" onClick=${() => setTentativeOpenId(g.tentative.id)} title="Modifier la date, la note ou le commentaire">
                                <p class="text-[11px] font-medium text-indigo-700 flex items-center gap-1.5 flex-wrap">
                                  ⏱️ ${g.tentative.date ? formatDateFr(g.tentative.date) : "Date à préciser"}
                                  ${g.tentative.note != null &&
                                  html`<span class="px-1.5 py-0 rounded-full bg-indigo-600 text-white font-semibold">${g.tentative.note}/20</span>`}
                                  ${tempsGroupe > 0 && html`<span class="text-indigo-400 font-normal">${formatDuration(tempsGroupe)}</span>`}
                                </p>
                                ${g.tentative.commentaire && html`<p class="text-[11px] text-indigo-600 italic mt-0.5">${g.tentative.commentaire}</p>`}
                              </button>
                              ${seancesDuJour.length > 0 &&
                              html`
                                <button
                                  class="shrink-0 text-indigo-400 hover:text-indigo-700 text-xs"
                                  title="Rattacher tous les exercices de cette tentative à une séance"
                                  onClick=${() => toggleAttachSeance(g.tentative.id)}
                                >
                                  🔗
                                </button>
                              `}
                            </div>
                          `}
                      ${attachSeanceOpenId === g.tentative.id &&
                      !isEditing &&
                      html`
                        <div class="flex items-center gap-2 mb-1.5">
                          <select
                            class="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-600"
                            value=${attachSeanceChoice}
                            onChange=${(e) => setAttachSeanceChoice(e.target.value)}
                          >
                            <option value="">Choisir une séance de ce jour…</option>
                            ${seancesDuJour.map((s) => html`<option value=${s.key}>${s.debut}–${s.fin} · ${s.label}</option>`)}
                          </select>
                          <button
                            class=${`px-2.5 py-1 rounded-lg text-xs font-medium text-white ${attachSeanceChoice ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300 cursor-not-allowed"}`}
                            disabled=${!attachSeanceChoice}
                            onClick=${() => confirmAttachSeance(g, seancesDuJour)}
                          >
                            Rattacher toute l'annale
                          </button>
                        </div>
                      `}
                      ${!isEditing &&
                      (g.items.length === 0
                        ? html`<p class="text-[11px] text-indigo-400 italic">Aucun exercice encore ajouté pour cette date.</p>`
                        : html`<ul class="space-y-0.5">${g.items.map((ex) => renderRow(ex, null, false))}</ul>`)}
                    </div>
                  `;
                })}
                ${horsSeance.length > 0 &&
                html`
                  <div key="hors-seance">
                    ${seances.length > 0 && html`<p class="text-[11px] font-medium text-slate-400 mb-1">Travaillés isolément (hors mise en conditions)</p>`}
                    <ul class="space-y-0.5">${horsSeance.map((ex) => renderRow(ex))}</ul>
                  </div>
                `}
              </div>
            `}

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
