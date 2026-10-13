import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { SUBJECT_TABS, subjectAccent } from "../../lib/subjectMapping.js";
import { daysUntil } from "../../lib/dateUtils.js";
import { mondayOf, addDaysStr, durationMinutes, formatDuration, dayKeyOf } from "../../lib/scheduleUtils.js";
import { cbsWithNotes } from "../../lib/weightedAverage.js";
import { collesRealisees } from "../../lib/colleUtils.js";
import { coefficientBalanceRows } from "../../lib/coefficientBalance.js";
import { diagnosticParMatiere, ECOLE_CIBLE_DEFAUT } from "../../lib/notesCibles.js";
import { signauxParMatiere, dissertationBankStale } from "../../lib/crossTabSignals.js";

const SEUIL_JOURS = 10;
const SEUIL_RATIO_HEURES = 0.6; // en dessous de 60% des heures prévues la semaine précédente → alerte
const MIN_MINUTES_DUES = 60; // ne pas alerter en dessous d'au moins 1h prévue cette semaine-là
const SEUIL_JOURS_GEOPO = 7; // CB de Géopolitique dans moins de 7 jours
const SEUIL_RATIO_NON_REVU_GEOPO = 0.5; // + de 50% des lignes du suivi pas encore revues
const SEUIL_JOURS_CB = 10; // fenêtre "CB qui approche", toutes matières
const FENETRE_SEANCES_MANQUEES = 7; // jours en arrière pour repérer des séances programmées non réalisées récemment

function moyenneObtenue(cb, cbMatieres) {
  const valeurs = cb.matieres
    .filter((m) => cbMatieres.includes(m.nom))
    .filter((m) => m.note_obtenue !== null && m.note_obtenue !== undefined)
    .map((m) => Number(m.note_obtenue));
  if (valeurs.length === 0) return null;
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

// Discret volontairement, placé en bas du Dashboard : signale une matière pas
// travaillée depuis un moment (croisé avec l'Agenda), une matière dont la note
// obtenue baisse sur les 2 derniers CB (jamais sur un écart objectif/obtenu, qui
// peut baisser même quand la note progresse si l'objectif a été relevé entre-temps),
// et un manque global d'heures de travail réalisées cette semaine par rapport à ce
// qui était planifié jusqu'à aujourd'hui — un avertissement doux, pas une alarme.
export function NeglectedSubjectCard({ onChangeTab }) {
  const { data, today } = useCarnet();
  // Diagnostic par matière vs note cible — même croisement que AlertsCard (Temps de travail).
  const diag = diagnosticParMatiere(data).matieres;
  const signauxMatiere = signauxParMatiere(data);
  const dissertationStaleJours = dissertationBankStale(data);

  const cbsAsc = cbsWithNotes([...data.concours_blancs].sort((a, b) => a.date.localeCompare(b.date)));
  const dernierCB = cbsAsc[cbsAsc.length - 1];
  const avantDernierCB = cbsAsc[cbsAsc.length - 2];

  // CB de Géopolitique qui approche avec trop de lignes du suivi de révision
  // (widget HGG) pas encore revues pour ce cycle — signalé sur l'onglet HGG.
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
  // faible par rapport au poids du coefficient, ou aucune session de travail
  // planifiée d'ici l'épreuve — même logique que AlertsCard (Temps de travail).
  const { rows: balanceRows } = coefficientBalanceRows(data, today);
  const balanceByTab = new Map(balanceRows.map((r) => [r.tab.key, r]));
  const creneauxTravailTous = data.emploi_du_temps.creneaux.filter((c) => c.type === "travail");

  const alertes = SUBJECT_TABS.map((tab) => {
    const creneauxMatiere = data.emploi_du_temps.creneaux.filter((c) => c.type === "travail" && c.matiere === tab.key);
    const sessionsMatiere = data.sessions_ponctuelles.filter((s) => s.matiere === tab.key && s.statut === "realise");
    const messages = [];
    const d = diag[tab.key];
    const suffixeCible = d?.axeProgres ? ` · cible ${ECOLE_CIBLE_DEFAUT} ${d.cible}/20 (actuellement ${d.actuelle.toFixed(1)})` : "";

    if (tab.key === "HGG" && alerteGeopo) {
      messages.push(
        `suivi de révision Géopolitique : ${nonRevuesGeopo}/${totalRevisionsGeopo} éléments pas encore revus, CB dans ${joursAvantCBGeopo} j`
      );
    }

    let joursCB = null;
    const prochainCB = [...data.epreuves_cb]
      .filter((ep) => tab.cbMatieres.includes(ep.matiere) && ep.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (prochainCB) {
      joursCB = daysUntil(prochainCB.date);
      if (joursCB !== null && joursCB >= 0 && joursCB <= SEUIL_JOURS_CB) {
        const balance = balanceByTab.get(tab.key);
        if (balance?.sousInvesti) {
          messages.push(
            `CB dans ${joursCB} j : temps investi (${balance.pctTemps.toFixed(0)}%) bien en dessous du poids du coefficient (${balance.pctCoef.toFixed(0)}%)${d?.critique ? suffixeCible : ""}`
          );
        }
        const aCreneauRecurrent = creneauxTravailTous.some((c) => c.matiere === tab.key);
        const aSessionPrevue = data.sessions_ponctuelles.some(
          (s) => s.matiere === tab.key && s.date >= today && s.date <= prochainCB.date
        );
        if (!aCreneauRecurrent && !aSessionPrevue) {
          messages.push(`CB dans ${joursCB} j : aucune séance de travail planifiée d'ici l'épreuve${d?.critique ? suffixeCible : ""}`);
        }
      }
    }

    if (creneauxMatiere.length > 0 || sessionsMatiere.length > 0) {
      const semainesRealisees = data.seances
        .filter((s) => s.statut === "realise")
        .filter((s) => {
          const c = creneauxMatiere.find((cc) => cc.id === s.creneauId);
          return c && (s.matiereReelle || c.matiere) === tab.key;
        })
        .map((s) => s.semaine);
      const datesSessions = sessionsMatiere.map((s) => s.date);
      const datesColles = collesRealisees(data).filter((k) => k.matiere === tab.key).map((k) => k.date);
      const toutesDates = [...semainesRealisees, ...datesSessions, ...datesColles].sort();
      const derniere = toutesDates[toutesDates.length - 1];
      const jours = derniere ? -daysUntil(derniere) : null;
      if (jours === null) {
        messages.push(`jamais travaillée (créneaux planifiés mais aucun coché réalisé)${suffixeCible}`);
      } else if (jours > SEUIL_JOURS) {
        messages.push(`pas travaillée depuis ${jours} jours${suffixeCible}`);
      }
    }

    // Filet de sécurité : CB proche sur une matière encore loin de sa note cible,
    // mais qu'aucun signal ci-dessus n'a encore remonté ce cycle.
    if (d?.axeProgres && messages.length === 0 && joursCB !== null && joursCB >= 0 && joursCB <= SEUIL_JOURS_CB) {
      messages.push(
        `cible ${ECOLE_CIBLE_DEFAUT} ${d.cible}/20, actuellement ${d.actuelle.toFixed(1)} (écart ${d.ecart.toFixed(1)} pt), CB dans ${joursCB} j — vérifie que le plan de travail est suffisant`
      );
    }

    if (dernierCB && avantDernierCB) {
      const recent = moyenneObtenue(dernierCB, tab.cbMatieres);
      const precedent = moyenneObtenue(avantDernierCB, tab.cbMatieres);
      if (recent !== null && precedent !== null && recent < precedent) {
        messages.push(`note en baisse sur les 2 derniers CB (${precedent.toFixed(1)} → ${recent.toFixed(1)})`);
      }
    }

    // Signal miroir vs note cible : dernier CB noté comparé à la cible calculée.
    if (d && d.sourceActuelle === "cb" && d.ecart > 0) {
      messages.push(`en retrait par rapport à ta cible ${ECOLE_CIBLE_DEFAUT} (${d.actuelle.toFixed(1)} au dernier CB vs cible ${d.cible}/20)`);
    }
    if (d?.objectifAtteint && messages.length > 0) {
      messages.push(`déjà au niveau cible ${ECOLE_CIBLE_DEFAUT} (${d.cible}/20) — ne laisse pas retomber cet acquis`);
    }

    const s = signauxMatiere[tab.key];
    if (s) {
      if (s.tachesEnRetard > 0) messages.push(`${s.tachesEnRetard} tâche${s.tachesEnRetard > 1 ? "s" : ""} en retard`);
      if (s.collesSansRetour > 0) {
        messages.push(`${s.collesSansRetour} colle${s.collesSansRetour > 1 ? "s" : ""} passée${s.collesSansRetour > 1 ? "s" : ""} sans retour renseigné`);
      }
      if (s.veillePresseStale) messages.push(`veille presse : rien depuis ${s.veillePresseJours} j`);
    }

    return { tab, messages };
  }).filter((a) => a.messages.length > 0);

  // Heures de travail prévues sur la semaine PRÉCÉDENTE (entièrement écoulée, donc
  // fiable) vs réellement cochées — on ne juge jamais la semaine en cours, encore
  // incomplète, qui donnerait un ratio artificiellement bas en début de semaine.
  // Détail par matière (pas seulement global) pour repérer précisément quelles
  // séances programmées dans l'Agenda n'ont pas été cochées réalisées — même
  // croisement Agenda × réalisé que AlertsCard (Temps de travail).
  const semainePrecedente = addDaysStr(mondayOf(today), -7);
  const creneauxTravail = data.emploi_du_temps.creneaux.filter((c) => c.type === "travail");
  const seancesSemainePrecedente = new Map(
    data.seances.filter((s) => s.semaine === semainePrecedente).map((s) => [s.creneauId, s])
  );
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
    .filter((x) => x.planifie >= MIN_MINUTES_DUES && x.ratio < SEUIL_RATIO_HEURES)
    .sort((a, b) => a.ratio - b.ratio);

  // Séances programmées dans l'Agenda, déjà passées (donc plus modifiables par
  // surprise), jamais cochées réalisées ni marquées annulées — le miss concret et
  // récent, plus rapide à remonter que le seuil de 10 jours ci-dessus qui ne
  // capte que les longues périodes de silence total. Fenêtre courte glissante,
  // indépendante des limites de semaine calendaire.
  const seancesManqueesParMatiere = {};
  for (let i = 1; i <= FENETRE_SEANCES_MANQUEES; i++) {
    const date = addDaysStr(today, -i);
    const semaine = mondayOf(date);
    const jourKey = dayKeyOf(date);
    for (const c of creneauxTravailTous.filter((cc) => cc.jour === jourKey && cc.matiere !== "Général")) {
      const seance = data.seances.find((s) => s.creneauId === c.id && s.semaine === semaine);
      if (seance?.statut === "realise" || seance?.statut === "annule") continue;
      (seancesManqueesParMatiere[c.matiere] ||= []).push(date);
    }
  }
  for (const s of data.sessions_ponctuelles) {
    if (s.statut === "realise" || s.matiere === "Général") continue;
    const joursEcoules = -daysUntil(s.date);
    if (joursEcoules === null || joursEcoules <= 0 || joursEcoules > FENETRE_SEANCES_MANQUEES) continue;
    (seancesManqueesParMatiere[s.matiere] ||= []).push(s.date);
  }
  const seancesManquees = Object.entries(seancesManqueesParMatiere)
    .map(([matiere, dates]) => ({ matiere, dates: dates.sort() }))
    .sort((a, b) => b.dates.length - a.dates.length);

  const rien =
    alertes.length === 0 && travailNonHonore.length === 0 && seancesManquees.length === 0 && dissertationStaleJours === null;

  return html`
    <${Card} title="Matières à surveiller" subtitle="Détection automatique — informatif seulement" className="opacity-90">
      ${rien
        ? html`<p class="text-sm text-slate-400 italic">Rien à signaler pour l'instant.</p>`
        : html`
            <ul class="space-y-2">
              ${seancesManquees.map(({ matiere, dates }) => {
                const derniereDate = dates[dates.length - 1];
                const jours = -daysUntil(derniereDate);
                return html`
                  <li key=${`sm-${matiere}`} class="flex items-start gap-2 text-sm">
                    <span class="h-2 w-2 rounded-full shrink-0 mt-1.5" style=${{ backgroundColor: subjectAccent(matiere) }}></span>
                    <span class="flex-1 text-slate-600">
                      <button class="font-medium text-slate-800 hover:underline" onClick=${() => onChangeTab(matiere)}>
                        ${matiere}
                      </button>
                      — ${dates.length} séance${dates.length > 1 ? "s" : ""} programmée${dates.length > 1 ? "s" : ""} dans l'Agenda
                      non réalisée${dates.length > 1 ? "s" : ""} ces derniers jours (dernière il y a ${jours} j)
                    </span>
                  </li>
                `;
              })}
              ${travailNonHonore.map((x) => {
                const pct = Math.round(x.ratio * 100);
                return html`
                  <li key=${`tnh-${x.matiere}`} class="flex items-start gap-2 text-sm">
                    <span class="h-2 w-2 rounded-full shrink-0 mt-1.5" style=${{ backgroundColor: subjectAccent(x.matiere) }}></span>
                    <span class="flex-1 text-slate-600">
                      <button class="font-medium text-slate-800 hover:underline" onClick=${() => onChangeTab(x.matiere)}>
                        ${x.matiere}
                      </button>
                      — seulement ${pct}% des séances programmées dans l'Agenda réalisées la semaine dernière
                      (${formatDuration(x.realise)} / ${formatDuration(x.planifie)})
                    </span>
                  </li>
                `;
              })}
              ${dissertationStaleJours !== null &&
              html`
                <li class="flex items-start gap-2 text-sm">
                  <span class="h-2 w-2 rounded-full shrink-0 mt-1.5 bg-slate-400"></span>
                  <span class="flex-1 text-slate-600">
                    <button class="font-medium text-slate-800 hover:underline" onClick=${() => onChangeTab("objectifs")}>
                      Banque de dissertation
                    </button>
                    — aucun sujet ajouté depuis ${dissertationStaleJours} j
                  </span>
                </li>
              `}
              ${alertes.map(
                ({ tab, messages }) => html`
                  <li key=${tab.key} class="flex items-start gap-2 text-sm">
                    <span class="h-2 w-2 rounded-full shrink-0 mt-1.5" style=${{ backgroundColor: subjectAccent(tab.key) }}></span>
                    <span class="flex-1 text-slate-600">
                      <button class="font-medium text-slate-800 hover:underline" onClick=${() => onChangeTab(tab.key)}>
                        ${tab.label}
                      </button>
                      — ${messages.join(" · ")}
                    </span>
                  </li>
                `
              )}
            </ul>
          `}
    <//>
  `;
}
