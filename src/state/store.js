import React, { createContext, useContext, useEffect, useRef, useState } from "../lib/react.js";
import { html } from "../lib/htm.js";
import { loadData, saveData, fetchSnapshotMeta } from "../lib/api.js";
import { makeId } from "../lib/id.js";
import { CB_MATIERES } from "../lib/subjectMapping.js";
import { todayStr } from "../lib/dateUtils.js";
import { addDaysStr } from "../lib/scheduleUtils.js";

const DataContext = createContext(null);

// Complète les champs éventuellement absents d'un data.json plus ancien
// (emploi du temps ajouté après coup) pour éviter tout crash au chargement.
// Migre aussi l'ancien schéma (seances_realisees + emploi_du_temps.exceptions
// séparés) vers le nouveau tableau unique `seances`.
function normalize(d) {
  const emploi = d.emploi_du_temps || {};
  let seances = d.seances || [];
  if (!d.seances) {
    const realisees = (d.seances_realisees || []).map((s) => ({
      id: s.id,
      creneauId: s.creneauId,
      semaine: s.semaine,
      statut: "realise",
      matiereReelle: null,
      label: null,
    }));
    const annulees = (emploi.exceptions || []).map((e) => ({
      id: e.id,
      creneauId: e.creneauId,
      semaine: e.semaine,
      statut: "annule",
      matiereReelle: null,
      label: null,
    }));
    seances = [...realisees, ...annulees];
  }
  const { seances_realisees: _old, ...rest } = d;
  // Tâches cochées "fait" un autre jour que celui-ci sont purgées au chargement —
  // restent visibles (barrées, en bas de liste) le jour même de leur complétion,
  // puis disparaissent au changement de jour pour ne pas encombrer la liste. Les
  // anciennes tâches "fait" sans date de complétion (créées avant ce champ) sont
  // traitées comme déjà obsolètes. Un devoir (donné pendant un cours) échappe à
  // cette purge : il disparaît bien de la liste des tâches de la matière dès
  // qu'il est coché (déjà filtrée sur statut !== "fait" côté widgets, même règle
  // que pour une tâche normale), mais reste lié à sa séance indéfiniment pour
  // garder une trace de ce qui a été donné/fait, visible dans la popup du cours.
  const tachesGlobales = (d.taches_globales || [])
    .filter((t) => !(t.statut === "fait" && !t.devoir && t.faitLe !== todayStr()))
    .map((t) => ({ devoir: false, ...t }));
  const tacheIds = new Set(tachesGlobales.map((t) => t.id));
  return {
    ...rest,
    emploi_du_temps: {
      // Le type "autre" (récurrent) a été abandonné au profit des événements ponctuels ci-dessous.
      creneaux: (emploi.creneaux || [])
        .map((c) => ({ type: "travail", titre: "", theme: "", ...c }))
        .filter((c) => c.type !== "autre"),
    },
    seances,
    evenements_uniques: d.evenements_uniques || [],
    // statut par défaut "planifie" pour les sessions ponctuelles créées avant
    // l'ajout du champ — ne jamais les considérer réalisées automatiquement. Les
    // devoirIds pointant vers une tâche qui n'existe plus (supprimée à la main)
    // sont nettoyés au passage pour ne pas garder de référence fantôme.
    sessions_ponctuelles: (d.sessions_ponctuelles || []).map((s) => {
      const withDefaults = { statut: "planifie", theme: "", estCours: false, devoirIds: [], ...s };
      return { ...withDefaults, devoirIds: withDefaults.devoirIds.filter((id) => tacheIds.has(id)) };
    }),
    epreuves_cb: d.epreuves_cb || [],
    colles: d.colles || [],
    veille_presse: (d.veille_presse || []).map((a) => ({ lien: "", statut: "lu", tags: [], ...a })),
    // sujets créés avant l'ajout du statut/de la correction : considérés "traités"
    // (comportement historique, seul statut qui existait) sans correction saisie.
    sujets_dissertation: (d.sujets_dissertation || []).map((s) => ({ statut: "traite", correction: "", typeCorrection: "", note: null, revisions: [], ...s })),
    geopolitique_revisions: d.geopolitique_revisions || [],
    taches_globales: tachesGlobales,
    notes_bce_reference: d.notes_bce_reference || [],
    notes_cibles_personnalisees: d.notes_cibles_personnalisees || {},
    annales_maths: (d.annales_maths || []).map((a) => {
      const { blanche, ...rest } = { exercices: [], avancement: "", ...a };
      // Migration de l'ancien indicateur booléen "blanche" (sans date connue) vers
      // l'historique daté — on garde une trace plutôt que de la perdre silencieusement.
      const tentativesBlanches =
        a.tentativesBlanches ||
        (blanche ? [{ id: makeId("tb"), date: null, commentaire: "Migré depuis l'ancien indicateur (date exacte inconnue)" }] : []);
      return { ...rest, tentativesBlanches };
    }),
  };
}

export function useCarnet() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useCarnet doit être utilisé dans <DataProvider>");
  return ctx;
}

const MAX_HISTORY = 30;

// Copie en lecture seule publiée (snapshot statique, hébergée hors du Mac,
// cf. publish_readonly.py) : le marqueur n'est mis à `true` que dans cette
// copie-là (jamais dans l'app locale servie par server.py) — aucune tentative
// d'enregistrement n'est alors faite, il n'y a pas de serveur à qui écrire.
const READ_ONLY = typeof window !== "undefined" && window.__CARNET_READONLY__ === true;
const SNAPSHOT_AT_INITIAL = typeof window !== "undefined" ? window.__CARNET_SNAPSHOT_AT__ || null : null;

export function DataProvider({ children }) {
  const [data, setDataRaw] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [saveStatus, setSaveStatus] = useState(READ_ONLY ? "readonly" : "idle"); // idle | saving | saved | error | conflict | readonly
  const [loadError, setLoadError] = useState(null);
  const [conflictNotice, setConflictNotice] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  // Horodatage affiché dans le bandeau de lecture seule — state (pas une
  // simple constante lue une fois sur window) car mis à jour par le sondage
  // périodique ci-dessous, lui-même nécessaire parce que la page HTML elle-
  // même reste en cache navigateur jusqu'à 10 min (cf. publish_readonly.py).
  const [snapshotAt, setSnapshotAt] = useState(SNAPSHOT_AT_INITIAL);
  const snapshotAtRef = useRef(SNAPSHOT_AT_INITIAL);

  const saveTimer = useRef(null);
  const isFirstLoad = useRef(true);
  // Pile des états précédents, pour pouvoir annuler une manip malheureuse (pas
  // de bascule directe possible sinon — une fausse manip est enregistrée comme
  // n'importe quel autre changement, sans confirmation). Une ref plutôt qu'un
  // state : elle n'a pas besoin de déclencher de rendu à chaque modification
  // (data change de toute façon à chaque action) — seul canUndo est exposé.
  const historyRef = useRef([]);

  // Toutes les actions du carnet passent par ce setData (et non le setState
  // brut) pour empiler l'état précédent avant chaque changement.
  const setData = (updater) => {
    setDataRaw((prev) => {
      if (prev) {
        historyRef.current.push(prev);
        if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
        setCanUndo(true);
      }
      return typeof updater === "function" ? updater(prev) : updater;
    });
  };

  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setCanUndo(historyRef.current.length > 0);
    setDataRaw(prev);
  };

  useEffect(() => {
    loadData()
      .then((d) => {
        const normalized = normalize(d);
        setData(normalized);
        setStatus("ready");
        // La purge des tâches "fait" d'un jour précédent (dans normalize) ne doit pas
        // rester en mémoire seulement — sinon elle réapparaîtrait au prochain
        // chargement si aucune autre modification n'a entre-temps déclenché de save.
        if (!READ_ONLY && (normalized.taches_globales || []).length !== (d.taches_globales || []).length) {
          saveData(normalized).catch(() => {});
        }
      })
      .catch((err) => {
        setLoadError(err.message || String(err));
        setStatus("error");
      });
  }, []);

  // Copie en lecture seule uniquement : sonde régulièrement (et à chaque
  // retour au premier plan, ex. l'utilisateur rouvre l'onglet sur son
  // téléphone) si une publication plus récente existe, et recharge les
  // données SANS recharger la page (la page elle-même pourrait rester bloquée
  // en cache navigateur jusqu'à 10 min — cf. publish_readonly.py — alors que
  // ces petites requêtes, en cache: "no-store", touchent toujours le réseau).
  useEffect(() => {
    if (!READ_ONLY) return;
    const INTERVALLE_MS = 30000;

    const sonder = async () => {
      const meta = await fetchSnapshotMeta();
      if (!meta || !meta.snapshotAt || meta.snapshotAt === snapshotAtRef.current) return;
      try {
        const fresh = await loadData();
        setDataRaw(normalize(fresh));
        snapshotAtRef.current = meta.snapshotAt;
        setSnapshotAt(meta.snapshotAt);
      } catch {
        // Tant pis pour cette fois — on retentera à la prochaine sonde.
      }
    };

    const timer = setInterval(sonder, INTERVALLE_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") sonder();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (READ_ONLY) return;
    if (!data || isFirstLoad.current) {
      if (data) isFirstLoad.current = false;
      return;
    }
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveData(data)
        .then(() => setSaveStatus("saved"))
        .catch((err) => {
          if (err.code === "CONFLICT") {
            // Le serveur a refusé (onglet périmé ou chute suspecte du volume de
            // données) — on recharge sa version à jour sans la resauvegarder
            // aussitôt (isFirstLoad évite ça), et on prévient : mieux vaut
            // perdre la toute dernière saisie de cet onglet que le reste.
            isFirstLoad.current = true;
            setData(normalize(err.freshData));
            setSaveStatus("conflict");
            setConflictNotice(
              err.reason === "regression_suspecte"
                ? "Sauvegarde annulée : elle aurait fait disparaître beaucoup de données par rapport à ce qui est déjà enregistré. Rien n'a été perdu côté serveur, mais tes tout derniers changements dans cet onglet n'ont pas été pris en compte — la page vient d'être remise à jour."
                : "Cet onglet avait une copie périmée des données (resté ouvert pendant que des changements étaient faits ailleurs). Rien n'a été perdu côté serveur, mais tes tout derniers changements dans cet onglet n'ont pas été enregistrés — la page vient d'être remise à jour."
            );
          } else {
            setSaveStatus("error");
          }
        });
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data]);

  // ---- Profil ----
  const updateProfil = (patch) => {
    setData((d) => ({ ...d, profil: { ...d.profil, ...patch } }));
  };

  // ---- Concours blancs ----
  const emptyCbMatieres = () =>
    CB_MATIERES.map((nom) => ({ nom, note_objectif: null, note_obtenue: null, commentaire: "", causes_erreur: [] }));

  const addCB = (cb) => {
    const id = makeId("cb");
    setData((d) => ({
      ...d,
      concours_blancs: [
        ...d.concours_blancs,
        {
          id,
          nom: cb.nom,
          date: cb.date,
          matieres: cb.matieres || emptyCbMatieres(),
          classement_section: cb.classement_section ?? null,
          effectif_section: cb.effectif_section ?? null,
          classement_promo: cb.classement_promo ?? null,
          effectif_promo: cb.effectif_promo ?? null,
        },
      ],
    }));
    return id;
  };

  const updateCB = (id, patch) => {
    setData((d) => ({
      ...d,
      concours_blancs: d.concours_blancs.map((cb) => (cb.id === id ? { ...cb, ...patch } : cb)),
    }));
  };

  const deleteCB = (id) => {
    setData((d) => ({
      ...d,
      concours_blancs: d.concours_blancs.filter((cb) => cb.id !== id),
    }));
  };

  // ---- Tâches globales ----
  const addTask = ({ matiere, titre, deadline, devoir }) => {
    const task = { id: makeId("t"), matiere, titre, deadline: deadline || null, statut: "à faire", devoir: Boolean(devoir) };
    setData((d) => ({ ...d, taches_globales: [...d.taches_globales, task] }));
  };

  const updateTaskTitre = (id, titre) => {
    setData((d) => ({
      ...d,
      taches_globales: d.taches_globales.map((t) => (t.id === id ? { ...t, titre } : t)),
    }));
  };

  const toggleTaskDevoir = (id) => {
    setData((d) => ({
      ...d,
      taches_globales: d.taches_globales.map((t) => (t.id === id ? { ...t, devoir: !t.devoir } : t)),
    }));
  };

  // Devoir donné pendant un cours (sessions_ponctuelles avec estCours) : crée la
  // tâche ET la relie à la séance (devoirIds) en une seule fois, pour que la case
  // puisse ensuite afficher un repère visuel (📖) tant qu'au moins un devoir y est
  // rattaché — comme le ✏️ existant pour le contenu de séance.
  const addSessionDevoir = (sessionId, titre) => {
    setData((d) => {
      const session = d.sessions_ponctuelles.find((s) => s.id === sessionId);
      if (!session) return d;
      const task = {
        id: makeId("t"),
        matiere: session.matiere,
        titre,
        deadline: session.date,
        statut: "à faire",
        devoir: true,
      };
      return {
        ...d,
        taches_globales: [...d.taches_globales, task],
        sessions_ponctuelles: d.sessions_ponctuelles.map((s) =>
          s.id === sessionId ? { ...s, devoirIds: [...(s.devoirIds || []), task.id] } : s
        ),
      };
    });
  };

  const updateTaskStatut = (id, statut) => {
    setData((d) => ({
      ...d,
      taches_globales: d.taches_globales.map((t) =>
        t.id === id ? { ...t, statut, faitLe: statut === "fait" ? todayStr() : null } : t
      ),
    }));
  };

  const deleteTask = (id) => {
    setData((d) => ({
      ...d,
      taches_globales: d.taches_globales.filter((t) => t.id !== id),
    }));
  };

  // ---- Objectifs par matière ----
  const addObjectif = (matiereKey, texte) => {
    const obj = { id: makeId("obj"), texte, atteint: false };
    setData((d) => ({
      ...d,
      matieres_onglets: {
        ...d.matieres_onglets,
        [matiereKey]: {
          ...d.matieres_onglets[matiereKey],
          objectifs: [...d.matieres_onglets[matiereKey].objectifs, obj],
        },
      },
    }));
  };

  const toggleObjectif = (matiereKey, id) => {
    setData((d) => ({
      ...d,
      matieres_onglets: {
        ...d.matieres_onglets,
        [matiereKey]: {
          ...d.matieres_onglets[matiereKey],
          objectifs: d.matieres_onglets[matiereKey].objectifs.map((o) =>
            o.id === id ? { ...o, atteint: !o.atteint } : o
          ),
        },
      },
    }));
  };

  const deleteObjectif = (matiereKey, id) => {
    setData((d) => ({
      ...d,
      matieres_onglets: {
        ...d.matieres_onglets,
        [matiereKey]: {
          ...d.matieres_onglets[matiereKey],
          objectifs: d.matieres_onglets[matiereKey].objectifs.filter((o) => o.id !== id),
        },
      },
    }));
  };

  // ---- Commentaires par matière ----
  const addComment = (matiereKey, texte) => {
    const comment = { id: makeId("com"), date: new Date().toISOString(), texte };
    setData((d) => ({
      ...d,
      matieres_onglets: {
        ...d.matieres_onglets,
        [matiereKey]: {
          ...d.matieres_onglets[matiereKey],
          commentaires: [comment, ...d.matieres_onglets[matiereKey].commentaires],
        },
      },
    }));
  };

  const deleteComment = (matiereKey, id) => {
    setData((d) => ({
      ...d,
      matieres_onglets: {
        ...d.matieres_onglets,
        [matiereKey]: {
          ...d.matieres_onglets[matiereKey],
          commentaires: d.matieres_onglets[matiereKey].commentaires.filter((c) => c.id !== id),
        },
      },
    }));
  };

  // ---- Emploi du temps (créneaux récurrents) ----
  // type "travail" = session de révision perso (compte dans le temps de travail).
  // type "cours" = cours fixe de la scolarité (gris, ne compte jamais comme temps de travail).
  const addCreneau = (creneau) => {
    const c = {
      id: makeId("cr"),
      jour: creneau.jour,
      debut: creneau.debut,
      fin: creneau.fin,
      matiere: creneau.matiere,
      type: creneau.type || "travail",
      titre: creneau.titre || "",
      theme: creneau.matiere === "Maths" ? creneau.theme || "" : "",
    };
    setData((d) => ({
      ...d,
      emploi_du_temps: { ...d.emploi_du_temps, creneaux: [...d.emploi_du_temps.creneaux, c] },
    }));
    return c.id;
  };

  const updateCreneau = (id, patch) => {
    setData((d) => ({
      ...d,
      emploi_du_temps: {
        ...d.emploi_du_temps,
        creneaux: d.emploi_du_temps.creneaux.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    }));
  };

  const deleteCreneau = (id) => {
    setData((d) => ({
      ...d,
      emploi_du_temps: { ...d.emploi_du_temps, creneaux: d.emploi_du_temps.creneaux.filter((c) => c.id !== id) },
      seances: d.seances.filter((s) => s.creneauId !== id),
    }));
  };

  // ---- Séances (état réel d'un créneau pour une semaine donnée = date du lundi) ----
  // Une seule entrée par (creneauId, semaine) :
  //  - "realise"      → session de travail faite (matiereReelle si différente de prévu) ou case "autre" remplie (label)
  //  - "annule"       → cours annulé cette semaine-là (le créneau récurrent n'est pas touché)
  // Absence d'entrée = état par défaut (cours: a eu lieu normalement · travail/autre: pas encore fait).
  const findSeance = (d, creneauId, semaine) => d.seances.find((s) => s.creneauId === creneauId && s.semaine === semaine);

  const upsertSeance = (creneauId, semaine, patch) => {
    setData((d) => {
      const existing = findSeance(d, creneauId, semaine);
      if (existing) {
        return { ...d, seances: d.seances.map((s) => (s === existing ? { ...s, ...patch } : s)) };
      }
      return {
        ...d,
        seances: [
          ...d.seances,
          { id: makeId("sr"), creneauId, semaine, statut: null, matiereReelle: null, label: null, ...patch },
        ],
      };
    });
  };

  const clearSeance = (creneauId, semaine) => {
    setData((d) => ({ ...d, seances: d.seances.filter((s) => !(s.creneauId === creneauId && s.semaine === semaine)) }));
  };

  // Bascule "réalisé" pour une session de travail, avec matière réellement travaillée
  // et contenu de séance en option (préservé si non fourni).
  const setTravailRealise = (creneauId, semaine, matiereReelle = null, contenu) => {
    const patch = { statut: "realise", matiereReelle, label: null };
    if (contenu !== undefined) patch.contenu = contenu;
    upsertSeance(creneauId, semaine, patch);
  };

  // Enregistre uniquement le contenu prévu/fait d'une séance (ce que Victor compte
  // travailler), sans toucher à son statut réalisé/non réalisé — utile pour noter le
  // contenu à l'avance, avant que la séance ait eu lieu. Unique par (creneauId,
  // semaine) : chaque occurrence hebdomadaire d'un créneau récurrent a son propre
  // contenu.
  const updateSeanceContenu = (creneauId, semaine, contenu) => {
    upsertSeance(creneauId, semaine, { contenu });
  };

  // Bascule "annulé" pour un cours fixe cette semaine-là uniquement.
  const toggleCoursAnnule = (creneauId, semaine) => {
    setData((d) => {
      const existing = findSeance(d, creneauId, semaine);
      if (existing && existing.statut === "annule") {
        return { ...d, seances: d.seances.filter((s) => s !== existing) };
      }
      if (existing) {
        return { ...d, seances: d.seances.map((s) => (s === existing ? { ...s, statut: "annule" } : s)) };
      }
      return { ...d, seances: [...d.seances, { id: makeId("sr"), creneauId, semaine, statut: "annule", matiereReelle: null, label: null }] };
    });
  };

  // ---- Événements ponctuels (une date précise, ne se répètent jamais) ----
  // Ex : un déjeuner, un rendez-vous — distincts des créneaux récurrents et jamais
  // comptés dans le temps de travail par matière.
  const addEvenement = (evt) => {
    const e = { id: makeId("evt"), date: evt.date, debut: evt.debut, fin: evt.fin, titre: evt.titre };
    setData((d) => ({ ...d, evenements_uniques: [...d.evenements_uniques, e] }));
    return e.id;
  };

  const updateEvenement = (id, patch) => {
    setData((d) => ({
      ...d,
      evenements_uniques: d.evenements_uniques.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  };

  const deleteEvenement = (id) => {
    setData((d) => ({ ...d, evenements_uniques: d.evenements_uniques.filter((e) => e.id !== id) }));
  };

  // ---- Sessions de travail ponctuelles (une date précise, ne se répètent jamais,
  // mais comptent dans le temps de travail par matière — contrairement aux
  // événements). statut "planifie" par défaut : ne compte dans le temps de
  // travail qu'une fois marquée "realise" par Victor (jamais automatique).
  const addSessionPonctuelle = (session) => {
    const s = {
      id: makeId("sp"),
      date: session.date,
      debut: session.debut,
      fin: session.fin,
      matiere: session.matiere,
      titre: session.titre || "",
      theme: session.matiere === "Maths" ? session.theme || "" : "",
      statut: "planifie",
      estCours: session.estCours ?? false,
    };
    setData((d) => ({ ...d, sessions_ponctuelles: [...d.sessions_ponctuelles, s] }));
    return s.id;
  };

  // Crée plusieurs sessions ponctuelles indépendantes, une par semaine (même jour,
  // même horaire), sans passer par un créneau récurrent de l'emploi du temps —
  // pratique pour une poussée de révisions temporaire (ex. 4 semaines avant un CB)
  // sans polluer l'emploi du temps type après coup. Chaque occurrence reste ensuite
  // une session ponctuelle normale, modifiable/supprimable indépendamment des autres.
  const addSessionsPonctuellesRecurrentes = (session, nbSemaines) => {
    const nouvelles = Array.from({ length: nbSemaines }, (_, i) => ({
      id: makeId("sp"),
      date: addDaysStr(session.date, i * 7),
      debut: session.debut,
      fin: session.fin,
      matiere: session.matiere,
      titre: session.titre || "",
      theme: session.matiere === "Maths" ? session.theme || "" : "",
      statut: "planifie",
      estCours: session.estCours ?? false,
    }));
    setData((d) => ({ ...d, sessions_ponctuelles: [...d.sessions_ponctuelles, ...nouvelles] }));
  };

  const updateSessionPonctuelle = (id, patch) => {
    setData((d) => ({
      ...d,
      sessions_ponctuelles: d.sessions_ponctuelles.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const deleteSessionPonctuelle = (id) => {
    setData((d) => ({ ...d, sessions_ponctuelles: d.sessions_ponctuelles.filter((s) => s.id !== id) }));
  };

  const toggleSessionRealisee = (id, contenu) => {
    setData((d) => ({
      ...d,
      sessions_ponctuelles: d.sessions_ponctuelles.map((s) =>
        s.id === id
          ? { ...s, statut: s.statut === "realise" ? "planifie" : "realise", ...(contenu !== undefined ? { contenu } : {}) }
          : s
      ),
    }));
  };

  // ---- Colles (une entrée par khôlle, pas de récurrence auto — le colleur/la salle
  // changent souvent d'une fois sur l'autre). note/retour/axes_amelioration se
  // renseignent après la colle, le reste au moment de la programmer.
  const addColle = (colle) => {
    const c = {
      id: makeId("kh"),
      matiere: colle.matiere,
      date: colle.date,
      heure: colle.heure,
      salle: colle.salle || "",
      colleur: colle.colleur || "",
      note: colle.note ?? null,
      retour: colle.retour || "",
      axes_amelioration: colle.axes_amelioration || "",
    };
    setData((d) => ({ ...d, colles: [...d.colles, c] }));
    return c.id;
  };

  const updateColle = (id, patch) => {
    setData((d) => ({ ...d, colles: d.colles.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  };

  const deleteColle = (id) => {
    setData((d) => ({ ...d, colles: d.colles.filter((c) => c.id !== id) }));
  };

  // ---- Veille presse (Anglais / Espagnol) ----
  const addArticle = (article) => {
    const a = {
      id: makeId("art"),
      matiere: article.matiere,
      date: article.date,
      titre: article.titre,
      source: article.source || "",
      notes: article.notes || "",
      lien: article.lien || "",
      statut: article.statut || "a_lire",
      tags: article.tags || [],
    };
    setData((d) => ({ ...d, veille_presse: [...d.veille_presse, a] }));
    return a.id;
  };

  const updateArticle = (id, patch) => {
    setData((d) => ({ ...d, veille_presse: d.veille_presse.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  };

  const deleteArticle = (id) => {
    setData((d) => ({ ...d, veille_presse: d.veille_presse.filter((a) => a.id !== id) }));
  };

  // ---- Banque de sujets de dissertation (CG) ----
  const addSujet = (sujet) => {
    const s = {
      id: makeId("suj"),
      sujet: sujet.sujet,
      date: sujet.date || null,
      theme: sujet.theme || "",
      remarque: sujet.remarque || "",
      statut: sujet.statut || "traite",
      correction: sujet.correction || "",
      typeCorrection: sujet.typeCorrection || "",
      note: sujet.note ?? null,
      revisions: [],
    };
    setData((d) => ({ ...d, sujets_dissertation: [...d.sujets_dissertation, s] }));
    return s.id;
  };

  const updateSujet = (id, patch) => {
    setData((d) => ({
      ...d,
      sujets_dissertation: d.sujets_dissertation.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const deleteSujet = (id) => {
    setData((d) => ({ ...d, sujets_dissertation: d.sujets_dissertation.filter((s) => s.id !== id) }));
  };

  // Marque une révision ponctuelle d'un sujet déjà traité (ex. "intro refaite le
  // 24/10") sans toucher à la correction/au statut d'origine — sert juste à
  // tracer qu'on y est retourné et à le faire remonter en haut de la liste
  // (triée sur la révision la plus récente, cf. DissertationBank.js).
  const addRevisionSujet = (id, type, note = "") => {
    const revision = { id: makeId("rev"), date: todayStr(), type, note: note.trim() };
    setData((d) => ({
      ...d,
      sujets_dissertation: d.sujets_dissertation.map((s) =>
        s.id === id ? { ...s, revisions: [...(s.revisions || []), revision] } : s
      ),
    }));
  };

  const deleteRevisionSujet = (sujetId, revisionId) => {
    setData((d) => ({
      ...d,
      sujets_dissertation: d.sujets_dissertation.map((s) =>
        s.id === sujetId ? { ...s, revisions: (s.revisions || []).filter((r) => r.id !== revisionId) } : s
      ),
    }));
  };

  // ---- Suivi de révision Géopolitique (HGG) : Schémas / TT / Aires régionales et
  // pays. Chaque ligne porte la date de dernière révision, saisie manuellement par
  // Victor (jamais automatique) — sert à repérer ce qui n'a pas été revu avant un CB.
  const addRevisionLigne = (categorie, texte) => {
    const l = { id: makeId("rev"), categorie, texte, dernierRevu: null, ping: null };
    setData((d) => ({ ...d, geopolitique_revisions: [...d.geopolitique_revisions, l] }));
    return l.id;
  };

  const updateRevisionLigne = (id, patch) => {
    setData((d) => ({
      ...d,
      geopolitique_revisions: d.geopolitique_revisions.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  };

  const deleteRevisionLigne = (id) => {
    setData((d) => ({ ...d, geopolitique_revisions: d.geopolitique_revisions.filter((l) => l.id !== id) }));
  };

  // Remet à zéro toutes les dates de dernière révision (nouveau cycle de CB : ce qui
  // a été revu pour le CB précédent ne compte plus comme "à jour" pour le suivant).
  const resetRevisionsDates = () => {
    setData((d) => ({
      ...d,
      geopolitique_revisions: d.geopolitique_revisions.map((l) => ({ ...l, dernierRevu: null })),
    }));
  };

  const setGeopolitiqueCbRef = (date) => {
    setData((d) => ({ ...d, geopolitique_cb_ref: date }));
  };

  // ---- Répertoire des annales de Maths : chaque annale (ex. "EDHEC 2023")
  // appartient à une catégorie et contient un journal d'exercices travaillés — un
  // exercice peut apparaître plusieurs fois si retravaillé à des dates différentes,
  // volontairement, pour garder l'historique complet plutôt qu'écraser la tentative
  // précédente.
  const addAnnale = (categorie, nom) => {
    const a = { id: makeId("am"), nom, categorie, exercices: [], tentativesBlanches: [] };
    setData((d) => ({ ...d, annales_maths: [...d.annales_maths, a] }));
    return a.id;
  };

  const updateAnnale = (id, patch) => {
    setData((d) => ({
      ...d,
      annales_maths: d.annales_maths.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const deleteAnnale = (id) => {
    setData((d) => ({ ...d, annales_maths: d.annales_maths.filter((a) => a.id !== id) }));
  };

  const addExercice = (annaleId, exercice) => {
    const ex = { id: makeId("ex"), ...exercice };
    setData((d) => ({
      ...d,
      annales_maths: d.annales_maths.map((a) => (a.id === annaleId ? { ...a, exercices: [...a.exercices, ex] } : a)),
    }));
  };

  const updateExercice = (annaleId, exerciceId, patch) => {
    setData((d) => ({
      ...d,
      annales_maths: d.annales_maths.map((a) =>
        a.id === annaleId
          ? { ...a, exercices: a.exercices.map((ex) => (ex.id === exerciceId ? { ...ex, ...patch } : ex)) }
          : a
      ),
    }));
  };

  const deleteExercice = (annaleId, exerciceId) => {
    setData((d) => ({
      ...d,
      annales_maths: d.annales_maths.map((a) =>
        a.id === annaleId ? { ...a, exercices: a.exercices.filter((ex) => ex.id !== exerciceId) } : a
      ),
    }));
  };

  // Historique daté des fois où l'annale a été faite en conditions d'examen
  // (chronométrée, en une fois) — remplace l'ancien simple booléen "blanche" pour
  // garder une trace de chaque tentative. Un exercice du journal dont la date
  // correspond à l'une de ces tentatives est automatiquement badgé "Annale
  // blanche du …" dans AnnaleDetailModal, sans marquage manuel.
  const addTentativeBlanche = (annaleId, tentative) => {
    const t = { id: makeId("tb"), date: tentative.date, commentaire: tentative.commentaire || "" };
    setData((d) => ({
      ...d,
      annales_maths: d.annales_maths.map((a) =>
        a.id === annaleId ? { ...a, tentativesBlanches: [...a.tentativesBlanches, t] } : a
      ),
    }));
  };

  const updateTentativeBlanche = (annaleId, tentativeId, patch) => {
    setData((d) => ({
      ...d,
      annales_maths: d.annales_maths.map((a) =>
        a.id === annaleId
          ? { ...a, tentativesBlanches: a.tentativesBlanches.map((t) => (t.id === tentativeId ? { ...t, ...patch } : t)) }
          : a
      ),
    }));
  };

  const deleteTentativeBlanche = (annaleId, tentativeId) => {
    setData((d) => ({
      ...d,
      annales_maths: d.annales_maths.map((a) =>
        a.id === annaleId ? { ...a, tentativesBlanches: a.tentativesBlanches.filter((t) => t.id !== tentativeId) } : a
      ),
    }));
  };

  // Note cible personnalisée par matière — remplace la valeur calculée par
  // décalage uniforme quand Victor a une meilleure idée de ce qui est
  // atteignable dans une matière donnée (maîtrisable vs aléatoire). valeur=null
  // efface la personnalisation et revient au calcul automatique.
  const updateNoteCiblePersonnalisee = (matiere, valeur) => {
    setData((d) => {
      const next = { ...d.notes_cibles_personnalisees };
      if (valeur === null || valeur === undefined || Number.isNaN(valeur)) {
        delete next[matiere];
      } else {
        next[matiere] = valeur;
      }
      return { ...d, notes_cibles_personnalisees: next };
    });
  };

  const value = {
    data,
    status,
    loadError,
    saveStatus,
    conflictNotice,
    dismissConflictNotice: () => setConflictNotice(null),
    canUndo,
    undo,
    readOnly: READ_ONLY,
    snapshotAt,
    today: todayStr(),
    updateProfil,
    addCB,
    updateCB,
    deleteCB,
    addTask,
    updateTaskTitre,
    updateTaskStatut,
    toggleTaskDevoir,
    addSessionDevoir,
    deleteTask,
    addObjectif,
    toggleObjectif,
    deleteObjectif,
    addComment,
    deleteComment,
    emptyCbMatieres,
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
    addColle,
    updateColle,
    deleteColle,
    addArticle,
    updateArticle,
    deleteArticle,
    addSujet,
    updateSujet,
    deleteSujet,
    addRevisionSujet,
    deleteRevisionSujet,
    addRevisionLigne,
    updateRevisionLigne,
    deleteRevisionLigne,
    resetRevisionsDates,
    setGeopolitiqueCbRef,
    addAnnale,
    updateAnnale,
    deleteAnnale,
    addExercice,
    updateExercice,
    deleteExercice,
    addTentativeBlanche,
    updateTentativeBlanche,
    deleteTentativeBlanche,
    updateNoteCiblePersonnalisee,
  };

  return html`<${DataContext.Provider} value=${value}>${children}<//>`;
}
