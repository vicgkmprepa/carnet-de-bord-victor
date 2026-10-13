import { useState, useEffect } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { formatDateFr } from "../../lib/dateUtils.js";
import { addDaysStr } from "../../lib/scheduleUtils.js";

const CATEGORIES = [
  { key: "aires", label: "Aires régionales et pays" },
  { key: "tt", label: "TT" },
  { key: "edc", label: "EDC" },
  { key: "schemas", label: "Schémas" },
];

// Catégories dont les lignes se classent par aire régionale (EDC et Schémas —
// listes longues où le repère géographique aide à s'y retrouver). "aires" et
// "tt" restent de simples listes plates.
const AVEC_AIRE_REGIONALE = new Set(["edc", "schemas"]);

// Grille de lecture régionale — l'ordre ci-dessous fixe aussi l'ordre
// d'affichage des groupes dans la liste (non classées en dernier).
const AIRE_REGIONALE_OPTIONS = [
  "Afrique",
  "PMO",
  "Asie",
  "Amérique du Nord",
  "Amérique Latine",
  "Europe",
  "Espaces maritimes",
  "Espace méditerranéen",
  "Arctique",
  "Monde",
];

function normaliseRecherche(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Suivi des éléments de cours de Géopolitique à réviser avant chaque CB, répartis
// en 4 catégories. Chaque ligne porte une date de dernière révision saisie à la
// main par Victor. À partir de J-4 avant la prochaine épreuve de Géopolitique,
// toute ligne jamais revue, ou revue seulement avant le CB précédent (pas depuis),
// passe en rouge — en dehors de cette fenêtre, rien ne s'allume, même si plus rien
// n'a été revu depuis longtemps. Ces lignes rouges remontent toujours en tête de
// liste, avant tout regroupement par aire.
export function GeopolitiqueRevisionTracker({ tab }) {
  const {
    data,
    today,
    addRevisionLigne,
    updateRevisionLigne,
    deleteRevisionLigne,
    resetRevisionsDates,
    setGeopolitiqueCbRef,
  } = useCarnet();
  const [active, setActive] = useState("aires");
  const [texte, setTexte] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [recherche, setRecherche] = useState("");

  const avecAire = AVEC_AIRE_REGIONALE.has(active);

  const cbsGeopo = data.epreuves_cb
    .filter((ep) => tab.cbMatieres.includes(ep.matiere))
    .sort((a, b) => a.date.localeCompare(b.date));
  const prochainCB = cbsGeopo.find((ep) => ep.date >= today) || null;
  const precedentCB = [...cbsGeopo].reverse().find((ep) => ep.date < today) || null;
  const fenetreDebut = prochainCB ? addDaysStr(prochainCB.date, -4) : null;
  const fenetreCritique = Boolean(fenetreDebut) && today >= fenetreDebut;
  const deadline = precedentCB?.date || null;

  // Un nouveau CB de Géopolitique remplace l'ancien comme échéance : ce qui a été
  // revu pour le précédent ne compte plus, toutes les dates repartent à zéro.
  const cbRef = prochainCB?.date || null;
  useEffect(() => {
    if (!cbRef) return;
    if (data.geopolitique_cb_ref && data.geopolitique_cb_ref !== cbRef) {
      resetRevisionsDates();
    }
    if (data.geopolitique_cb_ref !== cbRef) {
      setGeopolitiqueCbRef(cbRef);
    }
  }, [cbRef]);

  // Hors fenêtre (J-4), rien ne s'allume. Dans la fenêtre : jamais revue = en
  // retard, ou revue seulement avant le CB précédent (pas depuis) = en retard aussi.
  const enRetardDe = (l) => fenetreCritique && (!l.dernierRevu || (deadline && l.dernierRevu < deadline));

  // Les éléments jamais revus remontent en haut, triés par ordre alphabétique entre
  // eux. Dès qu'une date de révision est renseignée, l'élément descend et se classe
  // par date croissante — les plus récemment revus finissent tout en bas.
  const trierLignes = (arr) =>
    [...arr].sort((a, b) => {
      const da = a.dernierRevu || "";
      const db = b.dernierRevu || "";
      if (da !== db) return da.localeCompare(db);
      return a.texte.localeCompare(b.texte, "fr");
    });

  const rechercheNorm = normaliseRecherche(recherche);
  const lignesCategorie = data.geopolitique_revisions
    .filter((l) => l.categorie === active)
    .filter(
      (l) =>
        !rechercheNorm ||
        normaliseRecherche(l.texte).includes(rechercheNorm) ||
        normaliseRecherche(l.ping).includes(rechercheNorm)
    );

  // Les lignes en retard remontent toujours en tête, hors de tout regroupement
  // par aire — impossible de les manquer, même si leur région n'est pas la
  // première dans l'ordre habituel des groupes.
  const lignesUrgentes = trierLignes(lignesCategorie.filter(enRetardDe));
  const lignesRestantes = lignesCategorie.filter((l) => !enRetardDe(l));

  const groupes = avecAire
    ? [...AIRE_REGIONALE_OPTIONS, null]
        .map((aire) => ({ aire, lignes: trierLignes(lignesRestantes.filter((l) => (l.ping || null) === aire)) }))
        .filter((g) => g.lignes.length > 0)
    : [{ aire: null, lignes: trierLignes(lignesRestantes) }];

  const handleAdd = () => {
    if (!texte.trim()) return;
    addRevisionLigne(active, texte.trim());
    setTexte("");
  };

  const handleDelete = (l) => {
    if (confirm(`Supprimer "${l.texte}" du suivi ?`)) deleteRevisionLigne(l.id);
  };

  const actions = html`
    <div class="flex items-center gap-1 flex-wrap">
      ${CATEGORIES.map((c) => {
        // Lignes jamais marquées comme revues dans cette catégorie — ce qu'il
        // reste encore à valider, visible sur chaque onglet sans avoir à cliquer.
        const restant = data.geopolitique_revisions.filter((l) => l.categorie === c.key && !l.dernierRevu).length;
        const isActive = active === c.key;
        return html`
          <button
            class=${`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
              isActive ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
            onClick=${() => {
              setActive(c.key);
              setRecherche("");
            }}
          >
            ${c.label}
            ${restant > 0 &&
            html`
              <span
                class=${`inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[10px] font-semibold ${
                  isActive ? "bg-white/25 text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                ${restant}
              </span>
            `}
          </button>
        `;
      })}
    </div>
  `;

  const renderLigne = (l) => {
    const enRetard = enRetardDe(l);
    const isEditing = editingId === l.id;
    const saveEdit = () => {
      if (editDraft.trim()) updateRevisionLigne(l.id, { texte: editDraft.trim() });
      setEditingId(null);
    };
    const dansLesTemps = l.dernierRevu && !enRetard;
    return html`
      <li key=${l.id} class=${`flex items-center justify-between gap-3 py-2 px-2 -mx-2 rounded-lg ${enRetard ? "bg-red-50" : dansLesTemps ? "bg-emerald-50" : ""}`}>
        ${isEditing
          ? html`
              <input
                class="text-sm flex-1 min-w-0 border border-slate-300 rounded px-1.5 py-0.5"
                value=${editDraft}
                autoFocus
                onInput=${(e) => setEditDraft(e.target.value)}
                onKeyDown=${(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                onBlur=${saveEdit}
              />
            `
          : html`
              <span
                class=${`text-sm truncate flex-1 min-w-0 cursor-text ${enRetard ? "text-red-700 font-medium" : "text-slate-700"}`}
                title="Cliquer pour modifier"
                onClick=${() => {
                  setEditingId(l.id);
                  setEditDraft(l.texte);
                }}
              >
                ${enRetard && "🔴 "}${l.texte}
              </span>
            `}
        <span class="flex items-center gap-2 shrink-0">
          ${avecAire &&
          html`
            <select
              class="border border-slate-300 rounded-lg px-1.5 py-1 text-xs text-slate-600 max-w-[8.5rem]"
              value=${l.ping || ""}
              onChange=${(e) => updateRevisionLigne(l.id, { ping: e.target.value || null })}
            >
              <option value="" style=${{ fontStyle: "italic" }}>Aire régionale</option>
              ${AIRE_REGIONALE_OPTIONS.map((p) => html`<option value=${p}>${p}</option>`)}
            </select>
          `}
          <input
            type="date"
            class="border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-600"
            value=${l.dernierRevu || ""}
            onChange=${(e) => updateRevisionLigne(l.id, { dernierRevu: e.target.value || null })}
          />
          <button
            class="text-xs text-slate-400 hover:text-slate-700"
            onClick=${() => updateRevisionLigne(l.id, { dernierRevu: today })}
            title="Marquer revu aujourd'hui"
          >
            Aujourd'hui
          </button>
          <button class="text-slate-300 hover:text-red-500 text-sm leading-none" onClick=${() => handleDelete(l)} title="Supprimer">✕</button>
        </span>
      </li>
    `;
  };

  return html`
    <${Card} title="Suivi des révisions Géopolitique" actions=${actions}>
      ${(prochainCB || precedentCB) &&
      html`
        <p class=${`mb-3 px-2.5 py-1 rounded-md text-xs font-medium inline-block ${
          fenetreCritique ? "bg-red-50 border border-red-200 text-red-800" : "bg-slate-50 border border-slate-200 text-slate-500"
        }`}>
          ${fenetreCritique
            ? `🔴 Épreuve de Géopolitique le ${formatDateFr(prochainCB.date)} — les lignes en rouge ci-dessous n'ont pas été revues${precedentCB ? ` depuis le CB du ${formatDateFr(precedentCB.date)}` : ""}.`
            : prochainCB
            ? `Prochaine épreuve de Géopolitique : ${formatDateFr(prochainCB.date)} (les lignes non revues s'allumeront en rouge à partir du ${formatDateFr(fenetreDebut)}).`
            : `Dernière épreuve de Géopolitique : ${formatDateFr(precedentCB.date)}.`}
        </p>
      `}

      <div class="flex gap-2 mb-3">
        <input
          class="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          placeholder="Ajouter un élément à réviser…"
          value=${texte}
          onInput=${(e) => setTexte(e.target.value)}
          onKeyDown=${(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          class="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
          onClick=${handleAdd}
          disabled=${!texte.trim()}
        >
          Ajouter
        </button>
      </div>

      <div class="relative mb-3">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
        <input
          class="w-full border border-slate-200 bg-slate-50 focus:bg-white rounded-lg pl-9 pr-8 py-1.5 text-sm transition-colors"
          placeholder=${avecAire ? "Rechercher par mot-clé ou aire régionale…" : "Rechercher par mot-clé…"}
          value=${recherche}
          onInput=${(e) => setRecherche(e.target.value)}
        />
        ${recherche &&
        html`
          <button
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 text-sm"
            onClick=${() => setRecherche("")}
            title="Effacer la recherche"
          >
            ✕
          </button>
        `}
      </div>

      ${lignesCategorie.length === 0
        ? html`<${EmptyState}
            text=${recherche ? "Aucun résultat pour cette recherche." : "Aucun élément dans cette catégorie pour l'instant."}
          />`
        : html`
            <ul class="divide-y divide-slate-100 max-h-48 overflow-y-auto overflow-x-hidden pr-3">
              ${lignesUrgentes.length > 0 &&
              html`
                <li key="hdr-urgent" class="pt-0.5 pb-1">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-red-500">À rattraper en urgence</p>
                </li>
                ${lignesUrgentes.map(renderLigne)}
              `}
              ${groupes.map(
                (g) => html`
                  ${avecAire &&
                  html`<li key=${`hdr-${g.aire || "none"}`} class="pt-2.5 pb-1 first:pt-0.5">
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">${g.aire || "Non classées"}</p>
                  </li>`}
                  ${g.lignes.map(renderLigne)}
                `
              )}
            </ul>
          `}
    <//>
  `;
}
