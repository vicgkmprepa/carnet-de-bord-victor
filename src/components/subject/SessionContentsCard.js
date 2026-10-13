import { useState, useEffect } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { JOURS, addDaysStr, mondayOf, dayKeyOf, addMinutesToTime } from "../../lib/scheduleUtils.js";
import { formatDateShortFr } from "../../lib/dateUtils.js";
import { itemLabel, MATHS_THEMES, MATHS_THEME_COLORS } from "../../lib/subjectMapping.js";

// Regroupe, pour la matière de cet onglet, tout ce que Victor a noté comme
// contenu de séance — créneaux récurrents (contenu propre à UNE occurrence,
// stocké sur la séance de la semaine correspondante) et sessions ponctuelles
// (contenu stocké directement dessus). Liste compacte à une ligne par entrée ;
// un clic déplie une entrée pour lire/modifier/supprimer son contenu sur place.
export function SessionContentsCard({ tab }) {
  const { data, today, updateSeanceContenu, updateSessionPonctuelle, setTravailRealise, toggleSessionRealisee } = useCarnet();
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [filtreTheme, setFiltreTheme] = useState(null);
  const [recherche, setRecherche] = useState("");
  const estMaths = tab.key === "Maths";

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const creneauxById = new Map(data.emploi_du_temps.creneaux.map((c) => [c.id, c]));
  const jourIndex = Object.fromEntries(JOURS.map((j, i) => [j.key, i]));

  // Une entrée sans contenu ne mérite d'être affichée que pendant la séance
  // (et jusqu'à 10 min après sa fin, pour laisser le temps de remplir) — sinon
  // elle disparaît purement et simplement, y compris de l'historique.
  const dansFenetreActive = (e) => e.date === today && e.debut <= nowHHMM && nowHHMM <= addMinutesToTime(e.fin, 10);
  const meriteAffichage = (e) => (e.contenu && e.contenu.trim()) || dansFenetreActive(e);

  const depuisSeances = data.seances
    .map((s) => {
      const creneau = creneauxById.get(s.creneauId);
      if (!creneau || creneau.matiere !== tab.key || s.statut === "annule") return null;
      const date = addDaysStr(s.semaine, jourIndex[creneau.jour] ?? 0);
      return {
        id: `s-${s.id}`,
        date,
        debut: creneau.debut,
        fin: creneau.fin,
        label: itemLabel(creneau.matiere, creneau.theme, creneau.titre),
        theme: creneau.theme || null,
        contenu: s.contenu || "",
        onSave: (val) => updateSeanceContenu(creneau.id, s.semaine, val),
        realise: s.statut === "realise",
        onMarkRealise: s.statut === "realise" ? null : () => setTravailRealise(creneau.id, s.semaine, s.matiereReelle, s.contenu),
      };
    })
    .filter(Boolean);

  // Créneau du jour même n'ayant encore donné lieu à aucune interaction (pas de
  // ligne dans data.seances) : entrée "virtuelle" ajoutée uniquement pendant sa
  // fenêtre active, pour permettre de remplir le contenu sans attendre qu'une
  // séance soit marquée réalisée/annulée pour exister.
  const todayJour = dayKeyOf(today);
  const todaySemaine = mondayOf(today);
  const seancesExistantes = new Set(data.seances.filter((s) => s.semaine === todaySemaine).map((s) => s.creneauId));
  const depuisCreneauxVirtuels = data.emploi_du_temps.creneaux
    .filter((c) => c.matiere === tab.key && c.jour === todayJour && !seancesExistantes.has(c.id))
    .filter((c) => c.debut <= nowHHMM && nowHHMM <= addMinutesToTime(c.fin, 10))
    .map((c) => ({
      id: `s-virtuel-${c.id}`,
      date: today,
      debut: c.debut,
      fin: c.fin,
      label: itemLabel(c.matiere, c.theme, c.titre),
      theme: c.theme || null,
      contenu: "",
      onSave: (val) => updateSeanceContenu(c.id, todaySemaine, val),
      realise: false,
      onMarkRealise: () => setTravailRealise(c.id, todaySemaine, c.matiere, ""),
    }));

  const depuisSessions = data.sessions_ponctuelles
    .filter((s) => s.matiere === tab.key)
    .map((s) => ({
      id: `p-${s.id}`,
      date: s.date,
      debut: s.debut,
      fin: s.fin,
      label: itemLabel(s.matiere, s.theme, s.titre),
      theme: s.theme || null,
      contenu: s.contenu || "",
      onSave: (val) => updateSessionPonctuelle(s.id, { contenu: val }),
      realise: s.statut === "realise",
      onMarkRealise: () => toggleSessionRealisee(s.id),
    }));

  const toutes = [...depuisSeances, ...depuisCreneauxVirtuels, ...depuisSessions].filter(meriteAffichage);
  const rechercheNorm = recherche.trim().toLowerCase();
  const entries = (showHistory
    ? toutes
        .filter((e) => e.date < today)
        .sort((a, b) => b.date.localeCompare(a.date) || b.debut.localeCompare(a.debut))
    : toutes.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.debut.localeCompare(b.debut))
  )
    .filter((e) => !filtreTheme || e.theme === filtreTheme)
    .filter((e) => !showHistory || !rechercheNorm || e.contenu.toLowerCase().includes(rechercheNorm) || e.label.toLowerCase().includes(rechercheNorm));

  const toggle = (e) => {
    if (openId === e.id) {
      setOpenId(null);
      return;
    }
    setOpenId(e.id);
    setDraft(e.contenu);
  };

  const actions = html`
    <button
      class=${`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
        showHistory ? "bg-slate-900 text-white" : "text-slate-500 border border-slate-200 hover:bg-slate-100"
      }`}
      onClick=${() => {
        setShowHistory((v) => !v);
        setFiltreTheme(null);
        setRecherche("");
      }}
    >
      <span>🕘</span> ${showHistory ? "Séances à venir" : "Historique"}
    </button>
  `;

  return html`
    <${Card} title="Contenu de séances" subtitle=${showHistory ? "Séances passées" : null} actions=${actions}>
      ${showHistory &&
      html`
        <div class="relative mb-3">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
          <input
            class="w-full border border-slate-200 bg-slate-50 focus:bg-white rounded-lg pl-9 pr-8 py-1.5 text-sm transition-colors"
            placeholder="Rechercher un mot-clé dans le contenu…"
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
      `}
      ${estMaths &&
      showHistory &&
      html`
        <div class="flex items-center gap-1 flex-wrap mb-3">
          <button
            class=${`px-2 py-1 rounded-lg text-[11px] font-medium border ${
              !filtreTheme ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:bg-slate-50"
            }`}
            onClick=${() => setFiltreTheme(null)}
          >
            Tous
          </button>
          ${MATHS_THEMES.map(
            (t) => html`
              <button
                class=${`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border ${
                  filtreTheme === t ? "text-white border-transparent" : "text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
                style=${filtreTheme === t ? { backgroundColor: MATHS_THEME_COLORS[t] } : {}}
                onClick=${() => setFiltreTheme(t)}
              >
                <span class="inline-block h-1.5 w-1.5 rounded-full shrink-0" style=${{ backgroundColor: MATHS_THEME_COLORS[t] }}></span>
                ${t}
              </button>
            `
          )}
        </div>
      `}
      ${entries.length === 0
        ? html`<${EmptyState}
            text=${showHistory
              ? rechercheNorm
                ? "Aucun résultat pour cette recherche."
                : "Aucune séance passée avec du contenu noté pour cette matière."
              : "Aucun contenu noté pour cette matière. Ouvre une séance de travail dans l'Agenda pour en ajouter un."}
          />`
        : html`
            <ul class="divide-y divide-slate-100 max-h-96 overflow-y-auto overflow-x-hidden">
              ${entries.map((e) => {
                const isOpen = openId === e.id;
                const enCours = e.date === today && e.debut <= nowHHMM && nowHHMM < e.fin;
                return html`
                  <li key=${e.id}>
                    <button
                      class=${`w-full flex items-center gap-2 py-2 px-1 text-left rounded-lg ${
                        enCours ? "bg-emerald-50 hover:bg-emerald-100" : "hover:bg-slate-50"
                      }`}
                      onClick=${() => toggle(e)}
                    >
                      ${enCours && html`<span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title="En cours"></span>`}
                      <span class="text-[11px] text-slate-400 shrink-0 w-9">${formatDateShortFr(e.date)}</span>
                      <span class=${`text-[11px] shrink-0 ${enCours ? "text-emerald-700 font-medium" : "text-slate-400"}`}>${e.debut}–${e.fin}</span>
                      <span class="text-[11px] font-medium text-slate-500 shrink-0 max-w-[7rem] truncate">${e.label}</span>
                      <span class=${`text-sm truncate flex-1 ${e.contenu ? "text-slate-700" : "text-slate-400 italic"}`}>
                        ${e.contenu || "Cliquer pour ajouter du contenu…"}
                      </span>
                      <span class="text-slate-300 text-[10px] shrink-0">${isOpen ? "▲" : "▼"}</span>
                    </button>
                    ${isOpen &&
                    html`
                      <div class="pb-3 px-1 pt-2">
                        <textarea
                          class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
                          rows="3"
                          value=${draft}
                          onInput=${(ev) => setDraft(ev.target.value)}
                        ></textarea>
                        <div class="flex items-center justify-between mt-2">
                          <button
                            class="text-xs text-red-500 hover:text-red-700"
                            onClick=${() => {
                              e.onSave("");
                              setOpenId(null);
                            }}
                          >
                            Supprimer
                          </button>
                          <div class="flex items-center gap-2">
                            ${e.date === today &&
                            e.debut <= nowHHMM &&
                            (e.onMarkRealise
                              ? html`
                                  <button
                                    class=${`text-xs font-medium px-2 py-1 rounded-lg border ${
                                      e.realise
                                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                        : "text-slate-600 border-slate-200 hover:bg-slate-50"
                                    }`}
                                    onClick=${e.onMarkRealise}
                                  >
                                    ${e.realise ? "✓ Marquer non réalisée" : "Marquer réalisée"}
                                  </button>
                                `
                              : html`<span class="text-xs font-medium text-emerald-700">✓ Réalisée</span>`)}
                            <button
                              class="px-3 py-1 rounded-lg text-xs font-medium text-white bg-slate-900 hover:bg-slate-800"
                              onClick=${() => {
                                e.onSave(draft);
                                setOpenId(null);
                              }}
                            >
                              Enregistrer
                            </button>
                          </div>
                        </div>
                      </div>
                    `}
                  </li>
                `;
              })}
            </ul>
          `}
    <//>
  `;
}
