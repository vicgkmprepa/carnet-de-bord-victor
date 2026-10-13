import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { AnnaleDetailModal } from "./AnnaleDetailModal.js";
import { FicheRevisionModal } from "./FicheRevisionModal.js";
import { mondayOf, dayKeyOf } from "../../lib/scheduleUtils.js";
import { itemLabel, MATHS_THEMES } from "../../lib/subjectMapping.js";
import { formatDateFr } from "../../lib/dateUtils.js";
import { exercicesARevoir } from "../../lib/annalesMaths.js";

const CATEGORIES = ["Maths I", "Maths II", "EDHEC", "EM", "Écricome"];
const TOUT = "tout";

// Avancement global d'une annale — repère discret, à marquer à la main (l'appli
// n'a aucun moyen de connaître le nombre réel d'exercices du sujet, seulement
// ceux effectivement logués) : rien fait -> quelques exos faits -> tous les
// exos faits au moins une fois, en boucle sur clic.
const AVANCEMENT_SUIVANT = { "": "partiel", partiel: "complet", complet: "" };
const AVANCEMENT_STYLE = {
  "": "border-slate-300 hover:border-slate-400",
  partiel: "bg-amber-400 border-amber-400",
  complet: "bg-emerald-500 border-emerald-500",
};
const AVANCEMENT_TITRE = {
  "": "Aucun exercice marqué comme fait — cliquer pour indiquer que quelques exos sont faits",
  partiel: "Quelques exercices faits — cliquer pour indiquer que tous les exos sont faits au moins une fois",
  complet: "Tous les exercices faits au moins une fois — cliquer pour réinitialiser",
};

// Seuils (en jours) au-delà desquels on considère un exercice "à revoir" comme
// en attente trop longtemps (rappel de tâche), ou une catégorie comme délaissée
// (signal d'inactivité) — deux seuils distincts car ce sont deux échelles
// différentes : un exercice précis vs le rythme global d'une catégorie.
const SEUIL_JOURS_AREVOIR = 10;
const SEUIL_JOURS_INACTIVITE = 14;

function normaliseRecherche(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function joursDepuis(dateStr, todayStr) {
  const a = new Date(dateStr + "T00:00:00");
  const b = new Date(todayStr + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

// Distance d'édition (nombre minimal d'ajouts/suppressions/substitutions pour
// passer de a à b) — sert à repérer les fautes de frappe ("EDCEC" / "EDHEC").
// Coupe court si les longueurs divergent trop : au-delà, ça ne peut de toute
// façon pas être une simple faute de frappe.
function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function motsSignificatifs(s) {
  return normaliseRecherche(s).match(/[a-z0-9]+/g) || [];
}

// Détecte automatiquement la catégorie à partir de mots-clés dans le nom tapé,
// pour éviter à Victor de sélectionner la catégorie à la main à chaque ajout.
// Ordre volontaire : ECRICOME et M1/M2 sont des tags explicites et sans
// ambiguïté, testés avant EDHEC/EM — "EM"/"EML" est le signal le plus
// court/générique, donc vérifié en dernier pour ne pas l'emporter sur un tag
// plus spécifique. EDHEC et EM/EML sont deux catégories distinctes.
function detecteCategorie(texte) {
  const tokens = motsSignificatifs(texte);
  if (tokens.includes("ecricome")) return "Écricome";
  if (tokens.includes("m1")) return "Maths I";
  if (tokens.includes("m2")) return "Maths II";
  if (tokens.includes("edhec")) return "EDHEC";
  if (tokens.includes("em") || tokens.includes("eml")) return "EM";
  return null;
}

// Année d'un sujet, déduite de son nom (ex. "EDHEC 2023" -> 2023) — pour trier
// la banque du plus récent au plus ancien. "0" (donc en dernier, trié desc) si
// aucune année n'est repérable dans le nom.
function extraitAnnee(nom) {
  const m4 = nom.match(/\b(19|20)\d{2}\b/);
  if (m4) return parseInt(m4[0], 10);
  const m2 = nom.match(/\b\d{2}\b/);
  if (m2) return 2000 + parseInt(m2[0], 10);
  return 0;
}

// "2023" et "23" comptent comme la même année (typo/raccourci courant), mais
// pas "1" et "10" — seule une vraie relation année longue/courte (4 vs 2
// chiffres, même suffixe) est acceptée pour éviter les faux positifs sur des
// numéros d'exercice ou de sujet.
function anneesEquivalentes(chiffresA, chiffresB) {
  return chiffresA.some((na) =>
    chiffresB.some((nb) => {
      if (na === nb) return true;
      const [courte, longue] = na.length < nb.length ? [na, nb] : [nb, na];
      return courte.length === 2 && longue.length === 4 && longue.endsWith(courte);
    })
  );
}

// Avertit d'un doublon probable via plusieurs signaux combinés (chacun suffit) :
// 1. nom strictement identique une fois normalisé (accents/casse/ponctuation) ;
// 2. faute de frappe probable (distance d'édition courte sur des noms assez longs) ;
// 3. même base textuelle + années équivalentes ("EDHEC 2023" vs "EDHEC 23") ;
// 4. forte intersection de mots, même dans un ordre différent ou avec un mot en
//    plus ("EDHEC 2023" vs "2023 EDHEC ECE"). Reste un simple avertissement, pas
//    un blocage — mieux vaut un faux positif occasionnel qu'un vrai doublon raté.
function trouveDoublonProbable(nomNouveau, annalesExistantes) {
  const normPlein = (s) => normaliseRecherche(s).replace(/[^a-z0-9]/g, "");
  const normA = normPlein(nomNouveau);
  if (!normA) return null;
  const motsA = motsSignificatifs(nomNouveau);
  const chiffresA = motsA.filter((m) => /^\d+$/.test(m));
  const setA = new Set(motsA);

  const lettresA = motsA.filter((m) => /[a-z]/.test(m)).join("");

  return (
    annalesExistantes.find((existante) => {
      const normB = normPlein(existante.nom);
      if (!normB) return false;
      if (normA === normB) return true;

      const motsB = motsSignificatifs(existante.nom);
      const chiffresB = motsB.filter((m) => /^\d+$/.test(m));
      const lettresB = motsB.filter((m) => /[a-z]/.test(m)).join("");

      // Faute de frappe probable sur la partie non-numérique (ex. "EDCEC" /
      // "EDHEC"), à condition que les nombres soient identiques ou équivalents
      // des deux côtés — sinon "2019" vs "2023" se ferait passer pour une simple
      // faute de frappe alors que ce sont deux années bien distinctes. Seuil de 1
      // caractère volontairement strict : les noms d'école sont courts (4-6
      // lettres), une distance de 2 confondrait déjà des écoles différentes
      // (ex. "ESSEC" / "EDHEC").
      const chiffresCompatibles =
        (chiffresA.length === 0 && chiffresB.length === 0) ||
        chiffresA.join(",") === chiffresB.join(",") ||
        anneesEquivalentes(chiffresA, chiffresB);
      if (lettresA && lettresB && chiffresCompatibles && levenshtein(lettresA, lettresB) <= 1) return true;

      // Forte intersection de mots, ordre indifférent (ex. "EDHEC 2023" vs
      // "2023 EDHEC ECE") — les chiffres comptent comme des mots ici, donc deux
      // années différentes réduisent naturellement le recouvrement.
      const setB = new Set(motsB);
      const intersection = [...setA].filter((m) => setB.has(m)).length;
      const union = new Set([...setA, ...setB]).size;
      return union > 0 && Math.min(setA.size, setB.size) >= 2 && intersection / union >= 0.6;
    }) || null
  );
}

// Pour chaque exercice (identifié par son nom au sein d'une annale), ne garde que
// la tentative la plus récente — une relance plus récente "efface" la pertinence
// d'un ancien statut "à revoir" sur la même ligne.
function dernieresTentatives(annales) {
  const map = new Map();
  for (const a of annales) {
    for (const ex of a.exercices) {
      const key = `${a.id}::${ex.nom.trim().toLowerCase()}`;
      const cur = map.get(key);
      if (!cur || ex.date > cur.ex.date) map.set(key, { annale: a, ex });
    }
  }
  return Array.from(map.values());
}

// Grand répertoire des annales de Maths, organisé par catégorie (type d'épreuve /
// banque de concours) — même principe que le suivi des révisions Géopolitique :
// une ligne = une annale (ex. "EDHEC 2023"), ajoutée à la main ; cliquer dessus
// ouvre son journal d'exercices travaillés (page de détail en modale). Le badge
// sur chaque onglet compte les exercices marqués "à revoir", tous statuts
// confondus, pour repérer d'un coup d'œil où il reste du travail de reprise.
export function AnnalesMathsTracker() {
  const {
    data,
    today,
    addAnnale,
    updateAnnale,
    deleteAnnale,
    addExercice,
    updateExercice,
    deleteExercice,
    addTentativeBlanche,
    updateTentativeBlanche,
    deleteTentativeBlanche,
    updateSeanceContenu,
    updateSessionPonctuelle,
    addTask,
  } = useCarnet();
  const [active, setActive] = useState(TOUT);
  const [nom, setNom] = useState("");
  const [categorieNouvelle, setCategorieNouvelle] = useState(CATEGORIES[0]);
  const [recherche, setRecherche] = useState("");
  const [openId, setOpenId] = useState(null);
  const [filtreARevoir, setFiltreARevoir] = useState(false);
  const [filtreTheme, setFiltreTheme] = useState("");
  const [filtreThemeExclu, setFiltreThemeExclu] = useState(false);
  const [tri, setTri] = useState("annee"); // "annee" | "nom" | "recent"
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [ficheOpen, setFicheOpen] = useState(false);

  const dernierDate = (a) => a.exercices.reduce((max, ex) => (ex.date > max ? ex.date : max), "");
  const doublonProbable = nom.trim() ? trouveDoublonProbable(nom.trim(), data.annales_maths) : null;

  const rechercheNorm = normaliseRecherche(recherche);
  const annales = data.annales_maths
    .filter((a) => active === TOUT || a.categorie === active)
    .filter((a) => !rechercheNorm || normaliseRecherche(a.nom).includes(rechercheNorm))
    .filter((a) => {
      if (filtreARevoir && filtreTheme && !filtreThemeExclu) {
        // Combinaison "à revoir" + thème inclusif : les deux critères doivent
        // porter sur LE MÊME exercice, pas sur l'annale prise dans son
        // ensemble — sinon une annale avec un exo à revoir en Algèbre et un
        // autre exo en Analyse ressortirait à tort pour "Analyse à revoir".
        return exercicesARevoir(a.exercices).some((ex) => ex.theme === filtreTheme);
      }
      if (filtreARevoir && exercicesARevoir(a.exercices).length === 0) return false;
      if (filtreTheme) {
        const contient = a.exercices.some((ex) => ex.theme === filtreTheme);
        return filtreThemeExclu ? !contient : contient;
      }
      return true;
    })
    .sort((a, b) => {
      if (tri === "recent") return dernierDate(b).localeCompare(dernierDate(a)) || a.nom.localeCompare(b.nom, "fr");
      if (tri === "annee") return extraitAnnee(b.nom) - extraitAnnee(a.nom) || a.nom.localeCompare(b.nom, "fr");
      return a.nom.localeCompare(b.nom, "fr");
    });

  // Pour le rattachement d'un exercice à une séance : retrouve toutes les séances de
  // Maths (créneaux récurrents + sessions ponctuelles, hors cours annulés) ayant lieu
  // à une date donnée, pour laisser Victor choisir la bonne quand il y en a plusieurs
  // le même jour (ex. deux blocs de travail dans la journée).
  const getSeancesForDate = (dateStr) => {
    if (!dateStr) return [];
    const semaine = mondayOf(dateStr);
    const jour = dayKeyOf(dateStr);
    const depuisCreneaux = data.emploi_du_temps.creneaux
      .filter((c) => c.matiere === "Maths" && c.jour === jour)
      .map((c) => {
        const seance = data.seances.find((s) => s.creneauId === c.id && s.semaine === semaine);
        if (seance && seance.statut === "annule") return null;
        return {
          key: `s-${c.id}`,
          debut: c.debut,
          fin: c.fin,
          label: itemLabel(c.matiere, c.theme, c.titre),
          attach: (texte) => {
            const contenuActuel = seance?.contenu || "";
            updateSeanceContenu(c.id, semaine, contenuActuel ? `${contenuActuel}\n${texte}` : texte);
          },
        };
      })
      .filter(Boolean);
    const depuisSessions = data.sessions_ponctuelles
      .filter((s) => s.matiere === "Maths" && s.date === dateStr)
      .map((s) => ({
        key: `p-${s.id}`,
        debut: s.debut,
        fin: s.fin,
        label: itemLabel(s.matiere, s.theme, s.titre),
        attach: (texte) => {
          const contenuActuel = s.contenu || "";
          updateSessionPonctuelle(s.id, { contenu: contenuActuel ? `${contenuActuel}\n${texte}` : texte });
        },
      }));
    return [...depuisCreneaux, ...depuisSessions].sort((a, b) => a.debut.localeCompare(b.debut));
  };

  const handleAdd = () => {
    if (!nom.trim()) return;
    addAnnale(active === TOUT ? categorieNouvelle : active, nom.trim());
    setNom("");
  };

  const annaleOuverte = openId ? data.annales_maths.find((a) => a.id === openId) : null;

  // Exercices "à revoir" dont la tentative la plus récente traîne depuis trop
  // longtemps — proposés en bloc comme tâches, plutôt que de rester un badge
  // qu'on oublie de consulter.
  const staleCandidates = dernieresTentatives(data.annales_maths).filter(
    ({ ex }) => ex.aRevoir && joursDepuis(ex.date, today) >= SEUIL_JOURS_AREVOIR
  );

  const creerTachesRappel = () => {
    const titresExistants = new Set(data.taches_globales.map((t) => t.titre));
    for (const { annale, ex } of staleCandidates) {
      const titre = `Revoir : ${annale.nom} — ${ex.nom}`;
      if (!titresExistants.has(titre)) addTask({ matiere: "Maths", titre, deadline: null });
    }
    setBannerDismissed(true);
  };

  // Signal d'inactivité, uniquement pertinent sur une catégorie précise (pas sur
  // "Tout", trop hétérogène) : dernière tentative toutes annales confondues de
  // la catégorie active, comparée au seuil.
  const inactiviteCategorie = (() => {
    if (active === TOUT) return null;
    const annalesCategorie = data.annales_maths.filter((a) => a.categorie === active);
    if (annalesCategorie.length === 0) return null;
    const derniere = dernieresTentatives(annalesCategorie).reduce((max, t) => (t.ex.date > max ? t.ex.date : max), "");
    if (!derniere) return null;
    const jours = joursDepuis(derniere, today);
    return jours >= SEUIL_JOURS_INACTIVITE ? jours : null;
  })();

  // Fiche de révision (idée 7) : compile les exercices actuellement à revoir
  // parmi les annales affichées (catégorie + recherche en cours), groupés par
  // annale — pratique à relire ou imprimer avant un concours blanc.
  const buildFiche = () => {
    const lignes = [
      `Fiche de révision — ${active === TOUT ? "toutes catégories" : active}`,
      `Générée le ${formatDateFr(today)}`,
      "",
    ];
    const tentatives = dernieresTentatives(annales).filter((t) => t.ex.aRevoir);
    if (tentatives.length === 0) {
      lignes.push("Aucun exercice à revoir.");
      return lignes.join("\n");
    }
    const parAnnale = new Map();
    for (const t of tentatives) {
      if (!parAnnale.has(t.annale.id)) parAnnale.set(t.annale.id, { nom: t.annale.nom, items: [] });
      parAnnale.get(t.annale.id).items.push(t.ex);
    }
    for (const { nom: nomAnnale, items } of parAnnale.values()) {
      lignes.push(nomAnnale);
      for (const ex of items) {
        lignes.push(`- ${ex.nom} (${ex.difficulte})${ex.commentaire ? " — " + ex.commentaire : ""}`);
      }
      lignes.push("");
    }
    return lignes.join("\n").trim();
  };

  const actions = html`
    <div class="flex items-center gap-1 flex-wrap">
      ${[{ key: TOUT, label: "Tout" }, ...CATEGORIES.map((c) => ({ key: c, label: c }))].map((c) => {
        const nbARevoir = data.annales_maths
          .filter((a) => c.key === TOUT || a.categorie === c.key)
          .reduce((acc, a) => acc + exercicesARevoir(a.exercices).length, 0);
        const isActive = active === c.key;
        return html`
          <button
            class=${`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
              isActive ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
            onClick=${() => setActive(c.key)}
          >
            ${c.label}
            ${nbARevoir > 0 &&
            html`
              <span
                class=${`inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[10px] font-semibold ${
                  isActive ? "bg-white/25 text-white" : "bg-amber-100 text-amber-700"
                }`}
              >
                ${nbARevoir}
              </span>
            `}
          </button>
        `;
      })}
    </div>
  `;

  return html`
    <${Card} title="Grand répertoire des annales de Maths" actions=${actions}>
      ${staleCandidates.length > 0 &&
      !bannerDismissed &&
      html`
        <div class="flex items-center justify-between gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <span>🔔 ${staleCandidates.length} exercice${staleCandidates.length > 1 ? "s" : ""} à revoir depuis plus de ${SEUIL_JOURS_AREVOIR} jours.</span>
          <span class="flex items-center gap-2 shrink-0">
            <button class="font-medium underline hover:no-underline" onClick=${creerTachesRappel}>Créer les tâches</button>
            <button class="text-amber-400 hover:text-amber-700" onClick=${() => setBannerDismissed(true)} title="Masquer">✕</button>
          </span>
        </div>
      `}
      ${inactiviteCategorie &&
      html`<p class="mb-3 text-xs text-slate-400">Pas de nouvel exercice dans ${active} depuis ${inactiviteCategorie} jours.</p>`}

      <div class="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          class="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          placeholder="Ex : EDHEC 2023"
          value=${nom}
          onInput=${(e) => {
            const val = e.target.value;
            setNom(val);
            const detectee = detecteCategorie(val);
            if (detectee) setCategorieNouvelle(detectee);
          }}
          onKeyDown=${(e) => e.key === "Enter" && handleAdd()}
        />
        ${active === TOUT &&
        html`
          <select
            class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
            value=${categorieNouvelle}
            onChange=${(e) => setCategorieNouvelle(e.target.value)}
          >
            ${CATEGORIES.map((c) => html`<option value=${c}>${c}</option>`)}
          </select>
        `}
        <button
          class="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
          onClick=${handleAdd}
          disabled=${!nom.trim()}
        >
          Ajouter
        </button>
      </div>

      ${doublonProbable && html`<p class="mb-3 text-xs text-amber-600">⚠️ Proche de « ${doublonProbable.nom} » déjà existante — un doublon ?</p>`}

      <div class="flex items-center gap-2 mb-3">
        <div class="relative flex-1">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
          <input
            class="w-full border border-slate-200 bg-slate-50 focus:bg-white rounded-lg pl-9 pr-8 py-1.5 text-sm transition-colors"
            placeholder="Rechercher une annale…"
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
        <select
          class="border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-500 bg-white shrink-0"
          value=${tri}
          onChange=${(e) => setTri(e.target.value)}
          title="Trier la liste"
        >
          <option value="annee">Année (récent d'abord)</option>
          <option value="nom">Nom</option>
          <option value="recent">Activité récente</option>
        </select>
        <button
          class=${`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
            filtreARevoir ? "bg-amber-100 text-amber-700 border-amber-200" : "text-slate-500 border-slate-200 hover:bg-slate-50"
          }`}
          onClick=${() => setFiltreARevoir((v) => !v)}
          title="N'afficher que les annales avec au moins un exercice à revoir"
        >
          🔖 À revoir
        </button>
        <select
          class=${`shrink-0 border rounded-lg px-2 py-1.5 text-xs ${
            filtreTheme ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 bg-white"
          }`}
          value=${filtreTheme}
          onChange=${(e) => setFiltreTheme(e.target.value)}
          title="N'afficher que les annales où ce thème a été traité"
        >
          <option value="">Tous les thèmes</option>
          ${MATHS_THEMES.filter((t) => t !== "Annale").map((t) => html`<option value=${t}>${t}</option>`)}
        </select>
        ${filtreTheme &&
        html`
          <button
            class=${`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
              filtreThemeExclu ? "bg-red-100 text-red-700 border-red-200" : "text-slate-500 border-slate-200 hover:bg-slate-50"
            }`}
            onClick=${() => setFiltreThemeExclu((v) => !v)}
            title=${filtreThemeExclu
              ? `N'affiche que les annales SANS ${filtreTheme} — cliquer pour inverser`
              : `N'affiche que les annales AVEC ${filtreTheme} — cliquer pour inverser`}
          >
            ${filtreThemeExclu ? "Sans" : "Avec"}
          </button>
        `}
        <button
          class="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border text-slate-500 border-slate-200 hover:bg-slate-50"
          onClick=${() => setFicheOpen(true)}
          title="Générer une fiche de révision des exercices à revoir affichés"
        >
          📋 Fiche
        </button>
      </div>

      ${annales.length === 0
        ? html`<${EmptyState}
            text=${recherche
              ? "Aucun résultat pour cette recherche."
              : filtreARevoir
              ? "Aucun exercice à revoir dans cette catégorie."
              : filtreTheme
              ? filtreThemeExclu
                ? `Toutes les annales ont déjà un exercice en ${filtreTheme}.`
                : `Aucune annale avec un exercice en ${filtreTheme}.`
              : "Aucune annale dans cette catégorie pour l'instant."}
          />`
        : html`
            <ul class="divide-y divide-slate-100 max-h-64 overflow-y-auto overflow-x-hidden">
              ${annales.map((a) => {
                const nbARevoir = exercicesARevoir(a.exercices).length;
                const avancement = a.avancement || "";
                return html`
                  <li key=${a.id}>
                    <div class="w-full flex items-center gap-2 py-2 px-2 -mx-2 rounded-lg hover:bg-slate-50">
                      <button
                        class=${`shrink-0 h-2.5 w-2.5 rounded-full border transition-colors ${AVANCEMENT_STYLE[avancement]}`}
                        onClick=${(e) => {
                          e.stopPropagation();
                          updateAnnale(a.id, { avancement: AVANCEMENT_SUIVANT[avancement] });
                        }}
                        title=${AVANCEMENT_TITRE[avancement]}
                      ></button>
                      <button
                        class="flex-1 min-w-0 flex items-center justify-between gap-3 text-left"
                        onClick=${() => setOpenId(a.id)}
                      >
                        <span class="text-sm text-slate-700 truncate flex items-center gap-1.5">
                          ${a.tentativesBlanches.length > 0 &&
                          html`<span title=${`Faite en blanche ${a.tentativesBlanches.length} fois`}>⏱️</span>`}
                          ${a.nom}
                        </span>
                        <span class="flex items-center gap-2 shrink-0 text-xs text-slate-400">
                          ${active === TOUT && html`<span class="text-slate-400">${a.categorie}</span>`}
                          <span>${a.exercices.length} exo${a.exercices.length > 1 ? "s" : ""}</span>
                          ${nbARevoir > 0 && html`<span class="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">${nbARevoir} à revoir</span>`}
                        </span>
                      </button>
                    </div>
                  </li>
                `;
              })}
            </ul>
          `}
    <//>

    ${annaleOuverte &&
    html`
      <${AnnaleDetailModal}
        annale=${annaleOuverte}
        getSeancesForDate=${getSeancesForDate}
        onClose=${() => setOpenId(null)}
        onRename=${(nouveauNom) => updateAnnale(annaleOuverte.id, { nom: nouveauNom })}
        onDeleteAnnale=${() => {
          deleteAnnale(annaleOuverte.id);
          setOpenId(null);
        }}
        onAddExercice=${(ex) => addExercice(annaleOuverte.id, ex)}
        onUpdateExercice=${(exId, patch) => updateExercice(annaleOuverte.id, exId, patch)}
        onDeleteExercice=${(exId) => deleteExercice(annaleOuverte.id, exId)}
        onAddTentativeBlanche=${(t) => addTentativeBlanche(annaleOuverte.id, t)}
        onUpdateTentativeBlanche=${(tId, patch) => updateTentativeBlanche(annaleOuverte.id, tId, patch)}
        onDeleteTentativeBlanche=${(tId) => deleteTentativeBlanche(annaleOuverte.id, tId)}
      />
    `}

    ${ficheOpen && html`<${FicheRevisionModal} texte=${buildFiche()} onClose=${() => setFicheOpen(false)} />`}
  `;
}
