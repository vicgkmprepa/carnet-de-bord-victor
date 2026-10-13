import { html } from "../../lib/htm.js";
import { TaskList } from "./TaskList.js";
import { ObjectiveList } from "./ObjectiveList.js";
import { CommentJournal } from "./CommentJournal.js";
import { GradeTrendChart } from "./GradeTrendChart.js";
import { CollesTracker } from "./CollesTracker.js";
import { PressReviewTracker } from "./PressReviewTracker.js";
import { DissertationBank } from "./DissertationBank.js";
import { ChronoWidget } from "./ChronoWidget.js";
import { SubjectWeekCard } from "./SubjectWeekCard.js";
import { MathsThemeBreakdown } from "./MathsThemeBreakdown.js";
import { SessionContentsCard } from "./SessionContentsCard.js";
import { GeopolitiqueRevisionTracker } from "./GeopolitiqueRevisionTracker.js";
import { AnnalesMathsTracker } from "./AnnalesMathsTracker.js";

// Ordre d'affichage des blocs par matière, tel que demandé — un grid 2 colonnes
// rempli dans cet ordre (gauche puis droite, ligne par ligne). "contenus" et
// "taches" sont toujours en première ligne (gauche/droite), juste sous le
// mini-agenda, dans tous les onglets.
const LAYOUTS = {
  Maths: ["contenus", "taches", "annales", "chrono", "themes", "colles", "notes", "objectifs"],
  HGG: ["contenus", "taches", "geopo", "colles", "notes", "objectifs"],
  Anglais: ["contenus", "taches", "chrono", "presse", "colles", "notes", "objectifs"],
  Espagnol: ["contenus", "taches", "chrono", "presse", "colles", "notes", "objectifs"],
  CG: ["contenus", "taches", "sujets", "colles", "notes", "objectifs"],
  Synthèse: ["contenus", "taches", "objectifs", "journal", "notes"],
};

const BLOCKS = {
  taches: (tab) => html`<${TaskList} key="taches" tab=${tab} />`,
  objectifs: (tab) => html`<${ObjectiveList} key="objectifs" tab=${tab} />`,
  journal: (tab) => html`<${CommentJournal} key="journal" tab=${tab} />`,
  notes: (tab) => html`<${GradeTrendChart} key="notes" tab=${tab} />`,
  chrono: (tab) => html`<${ChronoWidget} key="chrono" tab=${tab} />`,
  semaine: (tab) => html`<${SubjectWeekCard} key="semaine" tab=${tab} />`,
  themes: () => html`<${MathsThemeBreakdown} key="themes" />`,
  contenus: (tab) => html`<${SessionContentsCard} key="contenus" tab=${tab} />`,
  presse: (tab) => html`<${PressReviewTracker} key="presse" tab=${tab} />`,
  sujets: () => html`<${DissertationBank} key="sujets" />`,
  colles: (tab) => html`<${CollesTracker} key="colles" tab=${tab} />`,
  geopo: (tab) => html`<${GeopolitiqueRevisionTracker} key="geopo" tab=${tab} />`,
  annales: () => html`<${AnnalesMathsTracker} key="annales" />`,
};

// Blocs affichés pleine largeur (au-dessus de la grille 2 colonnes) plutôt que
// dans une colonne — pour les widgets qui ont besoin de place (mini-agenda,
// suivi de révision avec sous-onglets).
const FULL_WIDTH = new Set(["geopo", "annales"]);

// Découpe la liste ordonnée en rangées : les blocs consécutifs "grid" sont
// regroupés par 2 (gauche/droite) ; un bloc "pleine largeur" ferme la rangée en
// cours et s'affiche seul sur sa propre ligne, à sa position réelle dans l'ordre
// (pas forcément tout en haut) — pour respecter l'ordre exact demandé.
function buildRows(layout, tab) {
  const rows = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length) {
      rows.push(html`<div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">${buffer.map((key) => BLOCKS[key](tab))}</div>`);
      buffer = [];
    }
  };
  for (const key of layout) {
    if (FULL_WIDTH.has(key)) {
      flush();
      rows.push(html`<div class="mb-5">${BLOCKS[key](tab)}</div>`);
    } else {
      buffer.push(key);
    }
  }
  flush();
  return rows;
}

export function SubjectTab({ tab }) {
  const layout = LAYOUTS[tab.key] || ["taches", "objectifs", "notes"];
  const rows = buildRows(layout, tab);

  return html`
    <div>
      <div class="flex items-center gap-2 mb-5">
        <span class="h-3 w-3 rounded-full" style=${{ backgroundColor: tab.accent }}></span>
        <h2 class="text-lg font-semibold text-slate-800">${tab.label}</h2>
      </div>
      <div class="mb-5">${BLOCKS.semaine(tab)}</div>
      ${rows}
    </div>
  `;
}
