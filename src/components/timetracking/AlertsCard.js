import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { SUBJECT_TABS, subjectAccent, subjectLabel } from "../../lib/subjectMapping.js";
import { daysUntil, formatDateFr } from "../../lib/dateUtils.js";
import { mondayOf, addDaysStr, durationMinutes, formatDuration } from "../../lib/scheduleUtils.js";
import { cbsWithNotes } from "../../lib/weightedAverage.js";
import { workEntries } from "../../lib/workTimeStats.js";
import { collesRealisees } from "../../lib/colleUtils.js";
import { coefficientBalanceRows } from "../../lib/coefficientBalance.js";
import { diagnosticParMatiere, ECOLE_CIBLE_DEFAUT } from "../../lib/notesCibles.js";
import { signauxParMatiere, dissertationBankStale } from "../../lib/crossTabSignals.js";

const SEUIL_JOURS = 10;
const SEUIL_RATIO = 0.6;
const MIN_MINUTES_DUES = 60;
const SEUIL_JOURS_GEOPO = 7;
const SEUIL_RATIO_NON_REVU_GEOPO = 0.5;
const SEUIL_JOURS_CB = 10; // fenêtre "CB qui approche", toutes matières

function moyenneObtenue(cb, cbMatieres) {
  const valeurs = cb.matieres
    .filter((m) => cbMatieres.includes(m.nom))
    .filter((m) => m.note_obtenue !== null && m.note_obtenue !== undefined)
    .map((m) => Number(m.note_obtenue));
  if (!valeurs.length) return null;
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

// Pastille colorée à droite de chaque ligne — rouge/ambre selon la gravité, seul
// signal de couleur "alerte" de la carte (le reste reste neutre pour ne pas
// surcharger). grave=true → rouge, sinon ambre.
function Pill({ text, grave }) {
  const classes = grave ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
  return html`<span class=${`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${classes}`}>${text}</span>`;
}

function Row({ icon, color, title, subtitle, pill, onClick }) {
  const content = html`
    <div class="flex items-center gap-3 min-w-0 flex-1">
      <span
        class="h-8 w-8 rounded-lg flex items-center justify-center text-sm shrink-0"
        style=${{ backgroundColor: `${color}1F` }}
      >
        ${icon}
      </span>
      <div class="min-w-0">
        <p class="text-sm font-semibold text-slate-800 truncate">${title}</p>
        <p class="text-xs text-slate-500 truncate">${subtitle}</p>
      </div>
    </div>
    ${pill}
  `;
  return onClick
    ? html`<button class="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 px-3 py-2.5 text-left transition-colors" onClick=${onClick}>${content}</button>`
    : html`<div class="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5">${content}</div>`;
}

// Version enrichie de NeglectedSubjectCard (Dashboard), centrée sur le temps de
// travail : temps de travail perso non honoré par matière (semaine précédente
// complète, jamais la semaine en cours), matière pas travaillée depuis longtemps,
// note en baisse sur les 2 derniers CB avec notes — trois signaux distincts avec
// leur propre pastille de gravité. Les cours annulés restent en note de bas de
// carte, purement informatifs, pour ne pas noyer les vraies alertes.
export function AlertsCard({ onChangeTab }) {
  const { data, today } = useCarnet();
  const monday = mondayOf(today);
  // Diagnostic par matière vs note cible (calculée depuis la barre d'admissibilité
  // réelle de l'école cible, pas depuis la BCE prise comme seuil arbitraire) —
  // croisé avec les signaux ci-dessous pour renforcer les alertes pertinentes.
  const diag = diagnosticParMatiere(data).matieres;
  // Signaux cross-onglet : suivi administratif (tâches, colles, veille presse)
  // indépendant du temps de travail et des notes.
  const signauxMatiere = signauxParMatiere(data);
  const dissertationStaleJours = dissertationBankStale(data);

  const creneauxById = new Map(data.emploi_du_temps.creneaux.map((c) => [c.id, c]));
  const semainesRecentes = new Set([monday, addDaysStr(monday, -7)]);
  const coursAnnules = data.seances
    .filter((s) => s.statut === "annule" && semainesRecentes.has(s.semaine))
    .map((s) => ({ seance: s, creneau: creneauxById.get(s.creneauId) }))
    .filter((x) => x.creneau && x.creneau.type === "cours")
    .sort((a, b) => b.seance.semaine.localeCompare(a.seance.semaine));

  const semainePrecedente = addDaysStr(monday, -7);
  const seancesSemainePrecedente = new Map(
    data.seances.filter((s) => s.semaine === semainePrecedente).map((s) => [s.creneauId, s])
  );
  const creneauxTravail = data.emploi_du_temps.creneaux.filter((c) => c.type === "travail");
  const sessionsSemainePrecedente = data.sessions_ponctuelles.filter((s) => mondayOf(s.date) === semainePrecedente);
  const planifieParMatiere = {};
  const realiseParMatiere = {};
  for (const c of creneauxTravail) {
    const mins = durationMinutes(c.debut, c.fin);
    planifieParMatiere[c.matiere] = (planifieParMatiere[c.matiere] || 0) + mins;
    if (seancesSemainePrecedente.get(c.id)?.statut === "realise") {
      realiseParMatiere[c.matiere] = (realiseParMatiere[c.matiere] || 0) + mins;
    }
  }
  for (const s of sessionsSemainePrecedente) {
    if (s.estCours) continue;
    const mins = durationMinutes(s.debut, s.fin);
    planifieParMatiere[s.matiere] = (planifieParMatiere[s.matiere] || 0) + mins;
    if (s.statut === "realise") realiseParMatiere[s.matiere] = (realiseParMatiere[s.matiere] || 0) + mins;
  }
  // Colles : comptées en réalisé uniquement, jamais en planifié.
  for (const k of collesRealisees(data)) {
    if (mondayOf(k.date) === semainePrecedente) realiseParMatiere[k.matiere] = (realiseParMatiere[k.matiere] || 0) + k.minutes;
  }
  const travailNonHonore = Object.keys(planifieParMatiere)
    .map((matiere) => {
      const planifie = planifieParMatiere[matiere];
      const realise = realiseParMatiere[matiere] || 0;
      return { matiere, planifie, realise, ratio: planifie > 0 ? realise / planifie : 1 };
    })
    .filter((x) => x.planifie >= MIN_MINUTES_DUES && x.ratio < SEUIL_RATIO)
    .sort((a, b) => a.ratio - b.ratio);

  const derniereSemaineParMatiere = {};
  for (const e of workEntries(data)) {
    if (!derniereSemaineParMatiere[e.matiere] || e.semaine > derniereSemaineParMatiere[e.matiere]) {
      derniereSemaineParMatiere[e.matiere] = e.semaine;
    }
  }
  const cbsAsc = cbsWithNotes([...data.concours_blancs].sort((a, b) => a.date.localeCompare(b.date)));
  const dernierCB = cbsAsc[cbsAsc.length - 1];
  const avantDernierCB = cbsAsc[cbsAsc.length - 2];

  const matieresStales = [];
  const matieresEnBaisse = [];
  for (const tab of SUBJECT_TABS) {
    const derniere = derniereSemaineParMatiere[tab.key];
    const aDesCreneaux = creneauxTravail.some((c) => c.matiere === tab.key);
    if (aDesCreneaux || derniere) {
      const jours = derniere ? -daysUntil(derniere) : null;
      if (jours === null) matieresStales.push({ tab, jours: null });
      else if (jours > SEUIL_JOURS) matieresStales.push({ tab, jours });
    }
    if (dernierCB && avantDernierCB) {
      const recent = moyenneObtenue(dernierCB, tab.cbMatieres);
      const precedent = moyenneObtenue(avantDernierCB, tab.cbMatieres);
      if (recent !== null && precedent !== null && recent < precedent) {
        matieresEnBaisse.push({ tab, recent, precedent });
      }
    }
  }

  // CB de Géopolitique qui approche avec trop de lignes du suivi de révision
  // (widget HGG) pas encore revues pour ce cycle.
  const prochainCBGeopo = [...data.epreuves_cb]
    .filter((ep) => ep.matiere === "HGG" && ep.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const joursAvantCBGeopo = prochainCBGeopo ? daysUntil(prochainCBGeopo.date) : null;
  const totalRevisionsGeopo = data.geopolitique_revisions.length;
  const nonRevuesGeopo = data.geopolitique_revisions.filter((l) => !l.dernierRevu).length;
  const ratioNonRevuGeopo = totalRevisionsGeopo > 0 ? nonRevuesGeopo / totalRevisionsGeopo : 0;
  const alerteGeopo =
    joursAvantCBGeopo !== null &&
    joursAvantCBGeopo >= 0 &&
    joursAvantCBGeopo <= SEUIL_JOURS_GEOPO &&
    totalRevisionsGeopo > 0 &&
    ratioNonRevuGeopo > SEUIL_RATIO_NON_REVU_GEOPO;

  // CB qui approche (toutes matières) avec temps investi disproportionnellement
  // faible par rapport au poids du coefficient, ou carrément aucune session de
  // travail planifiée d'ici l'épreuve — généralise à toute matière le principe déjà
  // appliqué à la Géopolitique (temps de travail cohérent avec l'échéance réelle).
  const { rows: balanceRows } = coefficientBalanceRows(data, today);
  const balanceByTab = new Map(balanceRows.map((r) => [r.tab.key, r]));
  const cbSousInvesti = [];
  const cbSansTravailPrevu = [];
  // Matières déjà couvertes par un signal "temps de travail" ci-dessus — le filet
  // de sécurité BCE ne doit rattraper que ce qu'aucun autre signal n'a remonté.
  const matieresDejaSignalees = new Set([
    ...travailNonHonore.map((x) => x.matiere),
    ...matieresStales.map((x) => x.tab.key),
  ]);
  const cbCibleFiletSecurite = [];
  for (const tab of SUBJECT_TABS) {
    const prochainCB = [...data.epreuves_cb]
      .filter((ep) => tab.cbMatieres.includes(ep.matiere) && ep.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!prochainCB) continue;
    const jours = daysUntil(prochainCB.date);
    if (jours === null || jours < 0 || jours > SEUIL_JOURS_CB) continue;

    const balance = balanceByTab.get(tab.key);
    if (balance?.sousInvesti) {
      cbSousInvesti.push({ tab, jours, cb: prochainCB, pctTemps: balance.pctTemps, pctCoef: balance.pctCoef });
    }

    const aCreneauRecurrent = creneauxTravail.some((c) => c.matiere === tab.key);
    const aSessionPrevue = data.sessions_ponctuelles.some(
      (s) => s.matiere === tab.key && s.date >= today && s.date <= prochainCB.date
    );
    const sansTravailPrevu = !aCreneauRecurrent && !aSessionPrevue;
    if (sansTravailPrevu) {
      cbSansTravailPrevu.push({ tab, jours, cb: prochainCB });
    }

    // Filet de sécurité : CB proche sur une matière encore loin de sa note cible,
    // mais qu'aucun signal temps/coefficient n'a déjà remonté ce cycle.
    if (diag[tab.key]?.axeProgres && !balance?.sousInvesti && !sansTravailPrevu && !matieresDejaSignalees.has(tab.key)) {
      cbCibleFiletSecurite.push({ tab, jours, cb: prochainCB, d: diag[tab.key] });
    }
  }

  // Signal miroir vs note cible : compare le dernier CB noté (ou la BCE à défaut)
  // à la note cible calculée pour chaque matière. Un objectif déjà atteint qui se
  // dégrade (matière stale ou temps non honoré) mérite un rappel distinct — capitaliser
  // sur un acquis n'est pas la même urgence que combler un axe de progression.
  const enRetraitVsCible = [];
  const objectifEnDeclin = [];
  for (const tab of SUBJECT_TABS) {
    const d = diag[tab.key];
    if (!d) continue;
    if (d.sourceActuelle === "cb" && d.ecart > 0) {
      enRetraitVsCible.push({ tab, d });
    }
    if (d.objectifAtteint) {
      const estStale = matieresStales.some((x) => x.tab.key === tab.key);
      const estNonHonore = travailNonHonore.some((x) => x.matiere === tab.key);
      if (estStale || estNonHonore) {
        objectifEnDeclin.push({ tab, d, raison: estNonHonore ? "temps non honoré" : "pas travaillée depuis un moment" });
      }
    }
  }

  const rien =
    travailNonHonore.length === 0 &&
    matieresStales.length === 0 &&
    matieresEnBaisse.length === 0 &&
    !alerteGeopo &&
    cbSousInvesti.length === 0 &&
    cbSansTravailPrevu.length === 0 &&
    cbCibleFiletSecurite.length === 0 &&
    enRetraitVsCible.length === 0 &&
    objectifEnDeclin.length === 0 &&
    Object.keys(signauxMatiere).length === 0 &&
    dissertationStaleJours === null;

  return html`
    <${Card} title="Alertes" subtitle="Temps de travail non honoré, matières à surveiller">
      ${rien
        ? html`<p class="text-sm text-slate-400 italic">Rien à signaler pour l'instant, tout est à jour.</p>`
        : html`
            <div class="space-y-2">
              ${travailNonHonore.map((x) => {
                const pct = Math.round(x.ratio * 100);
                const d = diag[x.matiere];
                const subtitle = `${formatDuration(x.realise)} réalisé sur ${formatDuration(x.planifie)} prévu, semaine dernière${
                  d?.axeProgres ? ` · cible ${ECOLE_CIBLE_DEFAUT} ${d.cible}/20 (actuellement ${d.actuelle.toFixed(1)})` : ""
                }`;
                return html`
                  <${Row}
                    key=${`tnh-${x.matiere}`}
                    icon="⏱️"
                    color=${subjectAccent(x.matiere)}
                    title=${subjectLabel(x.matiere)}
                    subtitle=${subtitle}
                    pill=${html`<${Pill} text=${`${pct}%`} grave=${pct < 40 || !!d?.critique} />`}
                    onClick=${() => onChangeTab && onChangeTab(x.matiere)}
                  />
                `;
              })}
              ${matieresStales.map(({ tab, jours }) => {
                const d = diag[tab.key];
                const base = jours === null ? "Jamais travaillée en dehors du plan" : "Pas travaillée depuis un moment";
                const subtitle = d?.axeProgres ? `${base} · cible ${ECOLE_CIBLE_DEFAUT} ${d.cible}/20 (actuellement ${d.actuelle.toFixed(1)})` : base;
                return html`
                  <${Row}
                    key=${`stale-${tab.key}`}
                    icon="💤"
                    color=${subjectAccent(tab.key)}
                    title=${tab.label}
                    subtitle=${subtitle}
                    pill=${jours !== null && html`<${Pill} text=${`${jours} j`} grave=${jours > 20 || !!d?.critique} />`}
                    onClick=${() => onChangeTab && onChangeTab(tab.key)}
                  />
                `;
              })}
              ${matieresEnBaisse.map(
                ({ tab, recent, precedent }) => html`
                  <${Row}
                    key=${`decline-${tab.key}`}
                    icon="📉"
                    color=${subjectAccent(tab.key)}
                    title=${tab.label}
                    subtitle=${`Note en baisse sur les 2 derniers CB (${precedent.toFixed(1)} → ${recent.toFixed(1)})`}
                    pill=${html`<${Pill} text=${`${(recent - precedent).toFixed(1)}`} grave=${precedent - recent >= 2} />`}
                    onClick=${() => onChangeTab && onChangeTab(tab.key)}
                  />
                `
              )}
              ${alerteGeopo &&
              html`
                <${Row}
                  key="geopo-suivi"
                  icon="🌍"
                  color=${subjectAccent("HGG")}
                  title="HGG"
                  subtitle=${`Suivi de révision Géopolitique : ${nonRevuesGeopo}/${totalRevisionsGeopo} éléments pas encore revus`}
                  pill=${html`<${Pill} text=${`${joursAvantCBGeopo} j`} grave=${joursAvantCBGeopo <= 3} />`}
                  onClick=${() => onChangeTab && onChangeTab("HGG")}
                />
              `}
              ${cbSousInvesti.map(({ tab, jours, pctTemps, pctCoef }) => {
                const d = diag[tab.key];
                const subtitle = `CB proche : temps investi (${pctTemps.toFixed(0)}%) bien en dessous du poids du coefficient (${pctCoef.toFixed(0)}%)${
                  d?.axeProgres ? ` · cible ${ECOLE_CIBLE_DEFAUT} ${d.cible}/20 (actuellement ${d.actuelle.toFixed(1)})` : ""
                }`;
                return html`
                  <${Row}
                    key=${`cb-sousinvesti-${tab.key}`}
                    icon="⚖️"
                    color=${subjectAccent(tab.key)}
                    title=${tab.label}
                    subtitle=${subtitle}
                    pill=${html`<${Pill} text=${`${jours} j`} grave=${jours <= 5 || !!d?.critique} />`}
                    onClick=${() => onChangeTab && onChangeTab(tab.key)}
                  />
                `;
              })}
              ${cbSansTravailPrevu.map(
                ({ tab, jours }) => html`
                  <${Row}
                    key=${`cb-sanstravail-${tab.key}`}
                    icon="🚫"
                    color=${subjectAccent(tab.key)}
                    title=${tab.label}
                    subtitle="CB proche : aucune séance de travail planifiée d'ici l'épreuve"
                    pill=${html`<${Pill} text=${`${jours} j`} grave=${true} />`}
                    onClick=${() => onChangeTab && onChangeTab(tab.key)}
                  />
                `
              )}
              ${cbCibleFiletSecurite.map(
                ({ tab, jours, d }) => html`
                  <${Row}
                    key=${`cb-cible-filet-${tab.key}`}
                    icon="🎯"
                    color=${subjectAccent(tab.key)}
                    title=${tab.label}
                    subtitle=${`Cible ${ECOLE_CIBLE_DEFAUT} ${d.cible}/20, actuellement ${d.actuelle.toFixed(1)} (écart ${d.ecart.toFixed(1)} pt) — CB dans ${jours} j, vérifie que le plan de travail est suffisant`}
                    pill=${html`<${Pill} text=${`${jours} j`} grave=${jours <= 3 || d.critique} />`}
                    onClick=${() => onChangeTab && onChangeTab(tab.key)}
                  />
                `
              )}
              ${enRetraitVsCible.map(
                ({ tab, d }) => html`
                  <${Row}
                    key=${`cible-retrait-${tab.key}`}
                    icon="📊"
                    color=${subjectAccent(tab.key)}
                    title=${tab.label}
                    subtitle=${`En retrait par rapport à ta cible ${ECOLE_CIBLE_DEFAUT} (${d.actuelle.toFixed(1)} au dernier CB vs cible ${d.cible}/20)`}
                    pill=${html`<${Pill} text=${`${d.ecart.toFixed(1)}`} grave=${d.critique} />`}
                    onClick=${() => onChangeTab && onChangeTab(tab.key)}
                  />
                `
              )}
              ${objectifEnDeclin.map(
                ({ tab, d, raison }) => html`
                  <${Row}
                    key=${`cible-declin-${tab.key}`}
                    icon="⭐"
                    color=${subjectAccent(tab.key)}
                    title=${tab.label}
                    subtitle=${`Déjà au niveau cible ${ECOLE_CIBLE_DEFAUT} (${d.cible}/20) mais ${raison} — ne laisse pas retomber cet acquis`}
                    pill=${html`<${Pill} text="veille" grave=${false} />`}
                    onClick=${() => onChangeTab && onChangeTab(tab.key)}
                  />
                `
              )}
              ${SUBJECT_TABS.filter((tab) => signauxMatiere[tab.key]).map((tab) => {
                const s = signauxMatiere[tab.key];
                const parts = [];
                if (s.tachesEnRetard > 0) parts.push(`${s.tachesEnRetard} tâche${s.tachesEnRetard > 1 ? "s" : ""} en retard`);
                if (s.collesSansRetour > 0)
                  parts.push(`${s.collesSansRetour} colle${s.collesSansRetour > 1 ? "s" : ""} passée${s.collesSansRetour > 1 ? "s" : ""} sans retour renseigné`);
                if (s.veillePresseStale) parts.push(`veille presse : rien depuis ${s.veillePresseJours} j`);
                const compteAdmin = s.tachesEnRetard + s.collesSansRetour;
                const pillText = compteAdmin > 0 ? `${compteAdmin}` : `${s.veillePresseJours} j`;
                return html`
                  <${Row}
                    key=${`crosstab-${tab.key}`}
                    icon="🗂️"
                    color=${subjectAccent(tab.key)}
                    title=${tab.label}
                    subtitle=${parts.join(" · ")}
                    pill=${html`<${Pill} text=${pillText} grave=${s.tachesEnRetard > 0} />`}
                    onClick=${() => onChangeTab && onChangeTab(tab.key)}
                  />
                `;
              })}
              ${dissertationStaleJours !== null &&
              html`
                <${Row}
                  key="dissertation-stale"
                  icon="📚"
                  color="#64748B"
                  title="Banque de dissertation"
                  subtitle=${`Aucun sujet ajouté depuis ${dissertationStaleJours} j`}
                  pill=${html`<${Pill} text=${`${dissertationStaleJours} j`} grave=${false} />`}
                  onClick=${() => onChangeTab && onChangeTab("objectifs")}
                />
              `}
            </div>
          `}
      ${coursAnnules.length > 0 &&
      html`
        <p class="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
          Cours annulés récemment :
          ${coursAnnules
            .map(({ seance, creneau }) => `${creneau.titre || subjectLabel(creneau.matiere)} (sem. du ${formatDateFr(seance.semaine)})`)
            .join(" · ")}
        </p>
      `}
    <//>
  `;
}
