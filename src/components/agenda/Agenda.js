import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { WeekGrid } from "./WeekGrid.js";
import { MonthGrid } from "./MonthGrid.js";
import { CreneauForm } from "./CreneauForm.js";
import { EvenementForm } from "./EvenementForm.js";
import { SessionPonctuelleForm } from "./SessionPonctuelleForm.js";
import { ColleForm } from "../subject/ColleForm.js";
import { ColleDetailModal } from "./ColleDetailModal.js";
import { SeanceModal } from "./SeanceModal.js";
import { SessionModal } from "./SessionModal.js";
import { PlanningCoeffCounter } from "./PlanningCoeffCounter.js";
import {
  mondayOf,
  addDaysStr,
  formatWeekRangeFr,
  firstOfMonth,
  addMonths,
  formatMonthRangeFr,
  dayKeyOf,
  JOURS,
  durationMinutes,
  formatDuration,
} from "../../lib/scheduleUtils.js";
import { subjectAccent, subjectLabel, itemLabel } from "../../lib/subjectMapping.js";
import { collesRealisees } from "../../lib/colleUtils.js";

const COURS_COLOR = "#94A3B8";
const EVENEMENT_COLOR = "#7C3AED";
const CB_COLOR = "#DC2626";

export function Agenda({ initialDate }) {
  const {
    data,
    addCreneau,
    updateCreneau,
    deleteCreneau,
    setTravailRealise,
    updateSeanceContenu,
    toggleCoursAnnule,
    clearSeance,
    addEvenement,
    updateEvenement,
    deleteEvenement,
    addSessionPonctuelle,
    addSessionsPonctuellesRecurrentes,
    updateSessionPonctuelle,
    deleteSessionPonctuelle,
    toggleSessionRealisee,
    updateColle,
    deleteColle,
    addSessionDevoir,
    updateTaskStatut,
    canUndo,
    undo,
    today,
  } = useCarnet();
  const [monday, setMonday] = useState(() => mondayOf(initialDate || today));
  const [glissantStart, setGlissantStart] = useState(() => initialDate || today);
  const [viewMode, setViewMode] = useState("glissant"); // "semaine" | "glissant" | "mois"
  const [moisRef, setMoisRef] = useState(() => firstOfMonth(initialDate || today));
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalCreneau, setModalCreneau] = useState(null);
  const [showEvtForm, setShowEvtForm] = useState(false);
  const [editingEvt, setEditingEvt] = useState(null);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionPrefill, setSessionPrefill] = useState(null);
  const [modalSession, setModalSession] = useState(null);
  const [editingColle, setEditingColle] = useState(null);
  const [modalColle, setModalColle] = useState(null);
  const [showPlanningCoeff, setShowPlanningCoeff] = useState(true);

  const creneaux = data.emploi_du_temps.creneaux;

  // "Semaine" reste calée lundi-dimanche ; "Jours glissants" montre 7 jours à
  // partir d'un point de départ quelconque, qui avance/recule d'un jour à la
  // fois. Les deux modes partagent ensuite toute la logique de filtrage
  // ci-dessous via ce même tableau de 7 dates.
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysStr(monday, i));
  const glissantDays = Array.from({ length: 7 }, (_, i) => addDaysStr(glissantStart, i));
  const displayDays = viewMode === "glissant" ? glissantDays : weekDays;

  // Une fenêtre de 7 jours consécutifs contient chaque jour de la semaine
  // (lundi..dimanche) exactement une fois, même si elle chevauche deux
  // semaines calendaires — donc chaque créneau récurrent n'a besoin que de la
  // séance de SA propre semaine (mondayOf de sa date dans la fenêtre), jamais
  // de deux à la fois.
  const seancesByCreneauId = new Map();
  for (const d of displayDays) {
    const semaine = mondayOf(d);
    const jour = dayKeyOf(d);
    for (const s of data.seances) {
      if (s.semaine !== semaine) continue;
      const c = creneaux.find((cc) => cc.id === s.creneauId);
      if (c && c.jour === jour) seancesByCreneauId.set(s.creneauId, s);
    }
  }

  const evenementsSemaine = data.evenements_uniques
    .filter((e) => displayDays.includes(e.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.debut.localeCompare(b.debut));
  const collesSemaine = data.colles
    .filter((k) => displayDays.includes(k.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));
  const epreuvesCBSemaine = data.epreuves_cb
    .filter((ep) => displayDays.includes(ep.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.debut.localeCompare(b.debut));
  // Repère visuel des devoirs directement sur la case (📖⏳ tant qu'il en reste à
  // faire, 📖✅ une fois tous cochés) — calculé ici pour éviter de faire transiter
  // toute la liste des tâches jusqu'à WeekGrid, qui n'en a autrement pas besoin.
  const devoirStatutPourSession = (s) => {
    if (!s.devoirIds?.length) return null;
    const devoirs = s.devoirIds.map((id) => data.taches_globales.find((t) => t.id === id)).filter(Boolean);
    if (devoirs.length === 0) return null;
    return devoirs.every((t) => t.statut === "fait") ? "fait" : "encours";
  };
  const sessionsSemaine = data.sessions_ponctuelles
    .filter((s) => displayDays.includes(s.date))
    .map((s) => ({ ...s, devoirStatut: devoirStatutPourSession(s) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.debut.localeCompare(b.debut));

  // Comptage "Travail perso réalisé" — toujours sur la semaine calendaire fixe
  // (lundi-dimanche, pilotée par `monday`), jamais sur la fenêtre glissante :
  // en vue "Jours glissants", ce chiffre ne doit pas bouger quand on navigue
  // jour par jour.
  const seancesByCreneauIdSemaineFixe = new Map();
  for (const d of weekDays) {
    const semaine = mondayOf(d);
    const jour = dayKeyOf(d);
    for (const s of data.seances) {
      if (s.semaine !== semaine) continue;
      const c = creneaux.find((cc) => cc.id === s.creneauId);
      if (c && c.jour === jour) seancesByCreneauIdSemaineFixe.set(s.creneauId, s);
    }
  }
  const sessionsTravailSemaineFixe = data.sessions_ponctuelles.filter((s) => !s.estCours && weekDays.includes(s.date));
  const creneauxTravail = creneaux.filter((c) => c.type === "travail");
  const totalPlanifie =
    creneauxTravail.reduce((acc, c) => acc + durationMinutes(c.debut, c.fin), 0) +
    sessionsTravailSemaineFixe.reduce((acc, s) => acc + durationMinutes(s.debut, s.fin), 0);
  const totalRealise =
    creneauxTravail
      .filter((c) => seancesByCreneauIdSemaineFixe.get(c.id)?.statut === "realise")
      .reduce((acc, c) => acc + durationMinutes(c.debut, c.fin), 0) +
    sessionsTravailSemaineFixe
      .filter((s) => s.statut === "realise")
      .reduce((acc, s) => acc + durationMinutes(s.debut, s.fin), 0) +
    // Colles terminées (préparation + passage) : réalisé seulement, jamais planifié.
    collesRealisees(data)
      .filter((k) => weekDays.includes(k.date))
      .reduce((acc, k) => acc + k.minutes, 0);

  const openAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setShowForm(true);
  };

  const handleSubmit = (creneau) => {
    if (editing) updateCreneau(editing.id, creneau);
    else addCreneau(creneau);
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = (c) => {
    if (confirm(`Supprimer définitivement ce créneau récurrent (${c.titre || subjectLabel(c.matiere)}, ${c.jour}) ?`)) {
      deleteCreneau(c.id);
    }
  };

  const openAddEvt = () => {
    setEditingEvt(null);
    setShowEvtForm(true);
  };

  const openEditEvt = (e) => {
    setEditingEvt(e);
    setShowEvtForm(true);
  };

  const handleSubmitEvt = (evt) => {
    if (editingEvt) updateEvenement(editingEvt.id, evt);
    else addEvenement(evt);
    setShowEvtForm(false);
    setEditingEvt(null);
  };

  const handleDeleteEvt = () => {
    if (editingEvt && confirm(`Supprimer l'événement "${editingEvt.titre}" ?`)) {
      deleteEvenement(editingEvt.id);
    }
    setShowEvtForm(false);
    setEditingEvt(null);
  };

  const handleDuplicateEvt = (evt) => {
    addEvenement({ ...evt, date: addDaysStr(evt.date, 1) });
    setShowEvtForm(false);
    setEditingEvt(null);
  };

  const openAddSession = () => {
    setEditingSession(null);
    setSessionPrefill(null);
    setShowSessionForm(true);
  };

  const openAddSessionAt = (date, debut) => {
    setEditingSession(null);
    setSessionPrefill({ date, debut });
    setShowSessionForm(true);
  };

  const openEditSession = (s) => {
    setEditingSession(s);
    setShowSessionForm(true);
  };

  const handleSubmitSession = (session, nbSemaines) => {
    if (editingSession) updateSessionPonctuelle(editingSession.id, session);
    else if (nbSemaines > 1) addSessionsPonctuellesRecurrentes(session, nbSemaines);
    else addSessionPonctuelle(session);
    setShowSessionForm(false);
    setEditingSession(null);
    setSessionPrefill(null);
  };

  const handleDeleteSession = () => {
    if (editingSession && confirm("Supprimer cette session de travail ?")) {
      deleteSessionPonctuelle(editingSession.id);
    }
    setShowSessionForm(false);
    setEditingSession(null);
    setSessionPrefill(null);
  };

  const handleDuplicateSession = (session) => {
    addSessionPonctuelle({ ...session, date: addDaysStr(session.date, 1) });
    setShowSessionForm(false);
    setEditingSession(null);
  };

  return html`
    <div>
      <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div class="flex items-center gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-800">Agenda</h2>
            <p class="text-sm text-slate-500">Emploi du temps type, identique chaque semaine</p>
          </div>
          <button
            class=${`px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1.5 shrink-0 ${
              canUndo
                ? "border-slate-300 text-slate-600 hover:bg-slate-100"
                : "border-slate-200 text-slate-300 cursor-not-allowed"
            }`}
            onClick=${undo}
            disabled=${!canUndo}
            title="Annuler la dernière modification de l'agenda (et du reste du carnet)"
          >
            ↩ Annuler
          </button>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex items-center rounded-lg border border-slate-300 overflow-hidden mr-1">
            <button
              class=${`px-2.5 py-1.5 text-sm font-medium ${viewMode === "semaine" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              onClick=${() => setViewMode("semaine")}
            >
              Semaine
            </button>
            <button
              class=${`px-2.5 py-1.5 text-sm font-medium ${viewMode === "glissant" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              onClick=${() => setViewMode("glissant")}
              title="7 jours à partir d'un point de départ quelconque, qui avance jour par jour"
            >
              Jours glissants
            </button>
            <button
              class=${`px-2.5 py-1.5 text-sm font-medium ${viewMode === "mois" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              onClick=${() => setViewMode("mois")}
            >
              Mois
            </button>
          </div>
          <button
            class="h-8 w-8 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center"
            onClick=${() => {
              if (viewMode === "mois") setMoisRef(addMonths(moisRef, -1));
              else if (viewMode === "glissant") setGlissantStart(addDaysStr(glissantStart, -1));
              else setMonday(addDaysStr(monday, -7));
            }}
          >
            ←
          </button>
          <div class="text-sm font-medium text-slate-700 text-center min-w-[150px]">
            ${viewMode === "mois"
              ? formatMonthRangeFr(moisRef)
              : formatWeekRangeFr(viewMode === "glissant" ? glissantStart : monday)}
          </div>
          <button
            class="h-8 w-8 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center"
            onClick=${() => {
              if (viewMode === "mois") setMoisRef(addMonths(moisRef, 1));
              else if (viewMode === "glissant") setGlissantStart(addDaysStr(glissantStart, 1));
              else setMonday(addDaysStr(monday, 7));
            }}
          >
            →
          </button>
          <button
            class="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-100"
            onClick=${() => {
              setMonday(mondayOf(today));
              setGlissantStart(today);
              setMoisRef(firstOfMonth(today));
            }}
          >
            Aujourd'hui
          </button>
          <button
            class="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800"
            onClick=${openAdd}
          >
            + Créneau
          </button>
          <button
            class="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700"
            onClick=${openAddSession}
          >
            + Session ponctuelle
          </button>
          <button
            class="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700"
            onClick=${openAddEvt}
          >
            + Événement
          </button>
        </div>
      </div>

      ${showPlanningCoeff &&
      html`<${PlanningCoeffCounter} data=${data} weekDays=${weekDays} onClose=${() => setShowPlanningCoeff(false)} />`}

      ${showForm &&
      html`
        <${CreneauForm}
          initial=${editing}
          defaultJour=${dayKeyOf(today)}
          onSubmit=${handleSubmit}
          onCancel=${() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      `}

      ${showEvtForm &&
      html`
        <${EvenementForm}
          initial=${editingEvt}
          defaultDate=${today}
          onSubmit=${handleSubmitEvt}
          onDelete=${handleDeleteEvt}
          onDuplicate=${handleDuplicateEvt}
          onCancel=${() => {
            setShowEvtForm(false);
            setEditingEvt(null);
          }}
        />
      `}

      ${showSessionForm &&
      html`
        <${SessionPonctuelleForm}
          initial=${editingSession}
          defaultDate=${sessionPrefill?.date || today}
          defaultDebut=${sessionPrefill?.debut}
          onSubmit=${handleSubmitSession}
          onDelete=${handleDeleteSession}
          onDuplicate=${handleDuplicateSession}
          onCancel=${() => {
            setShowSessionForm(false);
            setEditingSession(null);
            setSessionPrefill(null);
          }}
        />
      `}

      ${modalSession &&
      html`
        <${SessionModal}
          session=${modalSession}
          onClose=${() => setModalSession(null)}
          onToggleRealisee=${(contenu) => toggleSessionRealisee(modalSession.id, contenu)}
          onUpdateContenu=${(contenu) => updateSessionPonctuelle(modalSession.id, { contenu })}
          onAddDevoir=${(titre) => addSessionDevoir(modalSession.id, titre)}
          devoirsExistants=${(modalSession.devoirIds || [])
            .map((id) => data.taches_globales.find((t) => t.id === id))
            .filter(Boolean)}
          onToggleDevoirFait=${(taskId, fait) => updateTaskStatut(taskId, fait ? "fait" : "à faire")}
          onEdit=${() => {
            setModalSession(null);
            openEditSession(modalSession);
          }}
        />
      `}

      ${modalColle &&
      html`
        <${ColleDetailModal}
          colle=${modalColle}
          onClose=${() => setModalColle(null)}
          onEdit=${() => {
            setEditingColle(modalColle);
            setModalColle(null);
          }}
        />
      `}

      ${editingColle &&
      html`
        <${ColleForm}
          initial=${editingColle}
          onSubmit=${(patch) => {
            updateColle(editingColle.id, patch);
            setEditingColle(null);
          }}
          onDelete=${() => {
            if (confirm("Supprimer cette colle ?")) deleteColle(editingColle.id);
            setEditingColle(null);
          }}
          onCancel=${() => setEditingColle(null)}
        />
      `}

      ${modalCreneau &&
      (() => {
        // En vue "semaine" toutes les colonnes partagent le même lundi ; en vue
        // "jours glissants" la fenêtre de 7 jours peut chevaucher deux semaines
        // calendaires, donc la bonne "semaine" (pour le suivi séance par séance)
        // dépend de la date réelle du jour affiché, pas d'un lundi global.
        const dateDuCreneau = displayDays.find((d) => dayKeyOf(d) === modalCreneau.jour);
        const semaineDuCreneau = mondayOf(dateDuCreneau || monday);
        return html`
          <${SeanceModal}
            creneau=${modalCreneau}
            semaine=${semaineDuCreneau}
            seance=${seancesByCreneauId.get(modalCreneau.id) || null}
            onClose=${() => setModalCreneau(null)}
            onSetTravailRealise=${(matiereReelle, contenu) =>
              setTravailRealise(modalCreneau.id, semaineDuCreneau, matiereReelle, contenu)}
            onUpdateContenu=${(contenu) => updateSeanceContenu(modalCreneau.id, semaineDuCreneau, contenu)}
            onToggleCoursAnnule=${() => toggleCoursAnnule(modalCreneau.id, semaineDuCreneau)}
            onClearSeance=${() => clearSeance(modalCreneau.id, semaineDuCreneau)}
          />
        `;
      })()}

      ${viewMode === "mois" &&
      html`
        <${Card}>
          <${MonthGrid}
            monthRef=${moisRef}
            onSelectDay=${(dateStr) => {
              setMonday(mondayOf(dateStr));
              setViewMode("semaine");
            }}
          />
        <//>
      `}

      ${viewMode !== "mois" &&
      (creneaux.length === 0 &&
      evenementsSemaine.length === 0 &&
      collesSemaine.length === 0 &&
      epreuvesCBSemaine.length === 0 &&
      sessionsSemaine.length === 0
        ? html`<${Card}
            ><${EmptyState} text="Aucun créneau. Ajoute ton emploi du temps type avec le bouton + Créneau." /><//
          >`
        : html`
            <${Card} className="hidden sm:block">
              <p class="text-sm text-slate-500 mb-3">
                Travail perso réalisé cette semaine : <span class="font-semibold text-slate-800"
                  >${formatDuration(totalRealise)}</span
                > sur <span class="font-semibold text-slate-800">${formatDuration(totalPlanifie)}</span> planifiées.
              </p>
              <${WeekGrid}
                creneaux=${creneaux}
                evenements=${evenementsSemaine}
                colles=${collesSemaine}
                epreuvesCB=${epreuvesCBSemaine}
                sessions=${sessionsSemaine}
                seancesByCreneauId=${seancesByCreneauId}
                days=${displayDays}
                today=${today}
                onOpen=${setModalCreneau}
                onEdit=${openEdit}
                onEditEvenement=${openEditEvt}
                onOpenColle=${setModalColle}
                onOpenSession=${setModalSession}
                onEditSession=${openEditSession}
                onMoveSession=${(id, patch) => updateSessionPonctuelle(id, patch)}
                onMoveEvenement=${(id, patch) => updateEvenement(id, patch)}
                onAddAt=${openAddSessionAt}
              />
            <//>

            <p class="sm:hidden text-sm text-slate-500 mb-3">
              Travail perso réalisé cette semaine : <span class="font-semibold text-slate-800"
                >${formatDuration(totalRealise)}</span
              > sur <span class="font-semibold text-slate-800">${formatDuration(totalPlanifie)}</span> planifiées.
            </p>

            <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              ${displayDays.map((dateStr) => {
                const j = JOURS.find((jj) => jj.key === dayKeyOf(dateStr));
                const dayCreneaux = creneaux
                  .filter((c) => c.jour === j.key)
                  .sort((a, b) => a.debut.localeCompare(b.debut));
                const dayEvenements = evenementsSemaine.filter((e) => e.date === dateStr);
                const dayColles = collesSemaine.filter((k) => k.date === dateStr);
                const dayEpreuves = epreuvesCBSemaine
                  .filter((ep) => ep.date === dateStr)
                  .sort((a, b) => a.debut.localeCompare(b.debut));
                const daySessions = sessionsSemaine
                  .filter((s) => s.date === dateStr)
                  .sort((a, b) => a.debut.localeCompare(b.debut));
                if (
                  dayCreneaux.length === 0 &&
                  dayEvenements.length === 0 &&
                  dayColles.length === 0 &&
                  dayEpreuves.length === 0 &&
                  daySessions.length === 0
                )
                  return null;
                return html`
                  <div key=${dateStr} class="bg-white rounded-xl border border-slate-200 p-3">
                    <p class="text-xs font-semibold text-slate-500 mb-2">
                      ${j.full}${viewMode === "glissant" && html`<span class="font-normal text-slate-400"> · ${new Date(dateStr + "T00:00:00").getDate()}</span>`}
                    </p>
                    <ul class="space-y-1.5">
                      ${dayEpreuves.map(
                        (ep) => html`
                          <li key=${ep.id} class="flex items-center gap-1.5 text-sm">
                            <span class="h-2 w-2 rounded-full shrink-0" style=${{ backgroundColor: CB_COLOR }}></span>
                            <span class="truncate font-medium text-red-700"
                              >📝 ${ep.debut}–${ep.fin} · ${ep.cbNom} · ${subjectLabel(ep.matiere)}</span
                            >
                          </li>
                        `
                      )}
                      ${dayCreneaux.map((c) => {
                        const seance = seancesByCreneauId.get(c.id);
                        const skipped = seance?.statut === "annule";
                        const matiereEffective = c.type !== "cours" && seance?.matiereReelle ? seance.matiereReelle : c.matiere;
                        const color = c.type === "cours" ? COURS_COLOR : subjectAccent(matiereEffective);
                        return html`
                          <li key=${c.id} class="flex items-center justify-between gap-2 text-sm">
                            <span class=${`flex items-center gap-1.5 truncate ${skipped ? "opacity-50" : ""}`}>
                              <span class="h-2 w-2 rounded-full shrink-0" style=${{ backgroundColor: color }}></span>
                              <span class=${`truncate ${skipped ? "line-through" : ""}`}
                                >${c.debut}–${c.fin} · ${itemLabel(c.matiere, c.theme, c.titre)}</span
                              >
                              ${skipped && html`<span class="text-red-500 text-xs shrink-0">annulé</span>`}
                            </span>
                            <span class="flex items-center gap-2 text-xs shrink-0">
                              ${skipped &&
                              html`<button class="text-slate-400 hover:text-slate-700" onClick=${() => setModalCreneau(c)}>
                                Rétablir
                              </button>`}
                              <button class="text-slate-400 hover:text-slate-700" onClick=${() => openEdit(c)}>
                                Modifier
                              </button>
                              <button class="text-slate-300 hover:text-red-500" onClick=${() => handleDelete(c)}>✕</button>
                            </span>
                          </li>
                        `;
                      })}
                      ${daySessions.map((s) => {
                        const done = s.statut === "realise";
                        return html`
                          <li key=${s.id} class="flex items-center justify-between gap-2 text-sm">
                            <span class="flex items-center gap-1.5 truncate">
                              <span class="h-2 w-2 rounded-full shrink-0" style=${{ backgroundColor: subjectAccent(s.matiere) }}></span>
                              <span class="truncate">${s.debut}–${s.fin} · ${itemLabel(s.matiere, s.theme, s.titre)}</span>
                              ${done && html`<span class="text-emerald-600 text-xs shrink-0">✓</span>`}
                            </span>
                            <button class="text-slate-400 hover:text-slate-700 text-xs shrink-0" onClick=${() => setModalSession(s)}>
                              Gérer
                            </button>
                          </li>
                        `;
                      })}
                      ${dayEvenements.map(
                        (e) => html`
                          <li key=${e.id} class="flex items-center justify-between gap-2 text-sm">
                            <span class="flex items-center gap-1.5 truncate">
                              <span class="h-2 w-2 rounded-full shrink-0" style=${{ backgroundColor: EVENEMENT_COLOR }}></span>
                              <span class="truncate">${e.debut}–${e.fin} · ${e.titre}</span>
                            </span>
                            <button class="text-slate-400 hover:text-slate-700 text-xs shrink-0" onClick=${() => openEditEvt(e)}>
                              Modifier
                            </button>
                          </li>
                        `
                      )}
                      ${dayColles.map(
                        (k) => html`
                          <li key=${k.id} class="flex items-center justify-between gap-2 text-sm">
                            <span class="flex items-center gap-1.5 truncate">
                              <span class="h-2 w-2 rounded-full shrink-0" style=${{ backgroundColor: subjectAccent(k.matiere) }}></span>
                              <span class="truncate">🎤 ${k.heure} · Colle ${subjectLabel(k.matiere)}${k.salle ? ` (${k.salle})` : ""}</span>
                            </span>
                            <button class="text-slate-400 hover:text-slate-700 text-xs shrink-0" onClick=${() => setEditingColle(k)}>
                              Modifier
                            </button>
                          </li>
                        `
                      )}
                    </ul>
                  </div>
                `;
              })}
            </div>
          `)}
    </div>
  `;
}
