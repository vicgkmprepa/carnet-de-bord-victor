import { useEffect, useState, useRef } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { JOURS, timeToMinutes, minutesToTime, dayKeyOf } from "../../lib/scheduleUtils.js";
import { subjectAccent, subjectLabel, itemLabel } from "../../lib/subjectMapping.js";
import { colleDurees } from "../../lib/colleUtils.js";

const COURS_COLOR = "#94A3B8";
const EVENEMENT_COLOR = "#7C3AED";
const CB_COLOR = "#DC2626";
const DAY_START = 6 * 60 + 30;
const DAY_END = 24 * 60;
const SLOT_MIN = 30;
const ROW_PX = 22;
const TOTAL_SLOTS = (DAY_END - DAY_START) / SLOT_MIN;

function slotIndex(minutes) {
  return Math.round((minutes - DAY_START) / SLOT_MIN);
}


export function WeekGrid({
  creneaux,
  evenements,
  colles,
  epreuvesCB,
  sessions,
  seancesByCreneauId,
  days,
  today,
  onOpen,
  onEdit,
  onEditEvenement,
  onOpenColle,
  onOpenSession,
  onEditSession,
  onMoveSession,
  onMoveEvenement,
  onAddAt,
}) {
  const hours = [];
  // Les étiquettes restent calées sur les heures pleines même si la grille
  // démarre à la demie (6h30) — sinon elles s'afficheraient décalées (7h30,
  // 8h30…) au lieu de 7h, 8h…
  for (let m = Math.ceil(DAY_START / 60) * 60; m < DAY_END; m += 60) hours.push(m);
  const todayIndex = days.indexOf(today);

  // Glisser-déposer : uniquement pour les sessions ponctuelles et les événements
  // (éléments ancrés sur UNE date précise) — pas les créneaux récurrents (déplacer
  // une occurrence changerait le modèle hebdomadaire entier, ambigu), ni les colles
  // ou épreuves de CB (horaires imposés de l'extérieur, pas à déplacer à la légère).
  const [dragging, setDragging] = useState(null); // { type: "session" | "evenement", id, dureeMin }
  const [dragOverSlot, setDragOverSlot] = useState(null); // { di, si }
  const gridRef = useRef(null);

  // Les éléments de la grille se recouvrent souvent (chevauchement horaire, ou
  // l'élément qu'on déplace lui-même resté affiché à sa position d'origine sous le
  // curseur) — si on ne comptait que sur le drop de la case de fond, le navigateur
  // livrait l'événement dragover/drop à l'élément du dessus, qui ne sait pas le
  // gérer, et le déplacement semblait "refusé". On calcule donc systématiquement le
  // jour/créneau visé à partir de la position du curseur, peu importe l'élément sur
  // lequel l'événement atterrit.
  const slotFromEvent = (ev) => {
    const rect = gridRef.current.getBoundingClientRect();
    const colWidth = (rect.width - 44) / 7;
    let di = Math.floor((ev.clientX - rect.left - 44) / colWidth);
    di = Math.max(0, Math.min(6, di));
    let si = Math.floor((ev.clientY - rect.top) / ROW_PX);
    si = Math.max(0, Math.min(TOTAL_SLOTS - 1, si));
    return { di, si };
  };

  // Désambiguïsation clic simple / double-clic : le premier clic ouvrait le modal
  // immédiatement, avant même que le second clic n'ait le temps d'arriver — rendant
  // le double-clic inutilisable. On retarde donc l'action du clic simple le temps de
  // voir si un second clic suit ; s'il suit, le simple clic est annulé et seul le
  // double-clic s'exécute.
  const clickTimer = useRef(null);
  const onSingleClick = (action) => () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      action();
    }, 170);
  };
  const onDouble = (action) => () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    action();
  };

  const startDrag = (type, id, debut, fin) => (ev) => {
    setDragging({ type, id, dureeMin: timeToMinutes(fin) - timeToMinutes(debut) });
    ev.dataTransfer.effectAllowed = "move";
  };
  const endDrag = () => {
    setDragging(null);
    setDragOverSlot(null);
  };
  const dropOnSlot = (di, si) => (ev) => {
    ev.preventDefault();
    if (!dragging) return;
    const newStart = DAY_START + si * SLOT_MIN;
    const patch = {
      date: days[di],
      debut: minutesToTime(newStart),
      fin: minutesToTime(newStart + dragging.dureeMin),
    };
    if (dragging.type === "session") onMoveSession(dragging.id, patch);
    else onMoveEvenement(dragging.id, patch);
    setDragging(null);
    setDragOverSlot(null);
  };
  const dragOverAnywhere = (ev) => {
    if (!dragging) return;
    ev.preventDefault();
    const { di, si } = slotFromEvent(ev);
    if (!dragOverSlot || dragOverSlot.di !== di || dragOverSlot.si !== si) setDragOverSlot({ di, si });
  };
  const dropAnywhere = (ev) => {
    if (!dragging) return;
    const { di, si } = slotFromEvent(ev);
    dropOnSlot(di, si)(ev);
  };

  // Trait rouge suivant l'heure actuelle, façon Google Calendar — seulement visible
  // sur la colonne du jour si la semaine affichée est bien la semaine en cours.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine = todayIndex !== -1 && nowMinutes >= DAY_START && nowMinutes <= DAY_END;
  const nowTopPx = ((nowMinutes - DAY_START) / SLOT_MIN) * ROW_PX;

  return html`
    <div class="overflow-x-auto">
      <div style=${{ minWidth: "720px" }}>
        <div class="grid" style=${{ gridTemplateColumns: "44px repeat(7, 1fr)" }}>
          <div></div>
          ${days.map((dateStr, i) => {
            const j = JOURS.find((jj) => jj.key === dayKeyOf(dateStr));
            const dayNum = new Date(dateStr + "T00:00:00").getDate();
            return html`
              <div
                key=${dateStr}
                class=${`text-center text-xs pb-2 ${
                  i === todayIndex ? "font-semibold text-slate-900" : "font-medium text-slate-500"
                }`}
              >
                <div>${j.label}${i === todayIndex && html`<span class="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-900"></span>`}</div>
                <div class="text-[10px] font-normal text-slate-400">${dayNum}</div>
              </div>
            `;
          })}
        </div>
        <div
          ref=${gridRef}
          class="grid relative rounded-lg overflow-hidden border border-slate-200"
          style=${{
            gridTemplateColumns: "44px repeat(7, 1fr)",
            gridTemplateRows: `repeat(${TOTAL_SLOTS}, ${ROW_PX}px)`,
          }}
        >
          ${hours.map((m) => {
            const row = slotIndex(m) + 1;
            return html`
              <div
                key=${"h" + m}
                class="text-[10px] text-slate-400 text-right pr-1.5"
                style=${{ gridColumn: "1", gridRow: `${row} / span 2`, borderTop: "1px solid #E2E8F0" }}
              >
                ${String(Math.floor(m / 60)).padStart(2, "0")}h
              </div>
            `;
          })}
          ${days.map((dateStr, di) =>
            Array.from({ length: TOTAL_SLOTS }).map((_, si) => {
              const isDragOverHere = dragging && dragOverSlot && dragOverSlot.di === di && dragOverSlot.si === si;
              return html`
                <div
                  key=${`${dateStr}-${si}`}
                  class="cursor-pointer hover:bg-slate-900/[0.06]"
                  style=${{
                    gridColumn: `${di + 2}`,
                    gridRow: `${si + 1}`,
                    borderTop: "1px solid #F1F5F9",
                    borderLeft: "1px solid #F1F5F9",
                    backgroundColor: isDragOverHere
                      ? "rgba(15,23,42,0.10)"
                      : di === todayIndex
                      ? "rgba(15,23,42,0.035)"
                      : "transparent",
                  }}
                  onDragOver=${(ev) => {
                    if (!dragging) return;
                    ev.preventDefault();
                    if (!dragOverSlot || dragOverSlot.di !== di || dragOverSlot.si !== si) setDragOverSlot({ di, si });
                  }}
                  onDrop=${dropOnSlot(di, si)}
                  onClick=${() => onAddAt && onAddAt(days[di], minutesToTime(DAY_START + si * SLOT_MIN))}
                  title="Cliquer pour ajouter une session ici"
                ></div>
              `;
            })
          )}
          ${(() => {
            // Tous les éléments de la semaine (créneaux, événements, colles, sessions,
            // épreuves de CB) partagent la même grille CSS par jour, sans découpage
            // horizontal — deux éléments au même horaire se recouvraient purement et
            // simplement (le dernier rendu masquait l'autre). On regroupe donc tout par
            // jour puis on répartit les éléments qui se chevauchent en temps sur des
            // "voies" côte à côte (même principe qu'un calendrier classique), avant de
            // les rendre avec une largeur et un décalage calculés en conséquence.
            const dayBuckets = Array.from({ length: 7 }, () => []);
            const pushItem = (di, start, end, render) => {
              if (di === -1) return;
              dayBuckets[di].push({ start, end, render });
            };

            for (const c of creneaux) {
              const di = days.findIndex((d) => dayKeyOf(d) === c.jour);
              if (di === -1) continue;
              const seance = seancesByCreneauId.get(c.id) || null;
              // Un créneau annulé (cours ou travail perso) disparaît de la grille — la case
              // reste disponible pour cette semaine-là. Il reste visible, barré, dans la
              // liste du jour en dessous avec un bouton "Rétablir".
              if (seance?.statut === "annule") continue;
              const start = timeToMinutes(c.debut);
              const end = timeToMinutes(c.fin);
              const isCours = c.type === "cours";
              const done = !isCours && seance?.statut === "realise";
              const matiereEffective = !isCours && seance?.matiereReelle ? seance.matiereReelle : c.matiere;
              const color = isCours ? COURS_COLOR : subjectAccent(matiereEffective);
              const style = isCours
                ? { backgroundColor: color, borderColor: color, color: "#fff" }
                : { backgroundColor: done ? color : `${color}1F`, borderColor: color, color: done ? "#fff" : color };
              const label =
                !isCours && seance?.matiereReelle
                  ? subjectLabel(seance.matiereReelle)
                  : itemLabel(c.matiere, c.theme, c.titre);
              pushItem(
                di,
                start,
                end,
                (pos) => html`
                  <button
                    key=${c.id}
                    class="absolute my-px rounded-md text-left px-1.5 py-0.5 overflow-hidden text-[11px] leading-tight border"
                    style=${{ ...pos, ...style }}
                    onClick=${onSingleClick(() => onOpen(c))}
                    onDoubleClick=${onDouble(() => onEdit(c))}
                    onDragOver=${dragOverAnywhere}
                    onDrop=${dropAnywhere}
                    title="Clic : gérer cette séance pour la semaine affichée · double-clic : modifier le créneau récurrent"
                  >
                    <span class="font-semibold">${label}${seance?.contenu?.trim() ? " ✏️" : ""}</span>
                    ${!pos.compact && html`<span class="block opacity-80">${c.debut}–${c.fin}</span>`}
                    ${done && html`<span class="absolute top-0.5 right-1">✓</span>`}
                  </button>
                `
              );
            }

            for (const e of evenements) {
              const di = days.indexOf(e.date);
              const start = timeToMinutes(e.debut);
              const end = timeToMinutes(e.fin);
              pushItem(
                di,
                start,
                end,
                (pos) => html`
                  <button
                    key=${e.id}
                    class=${`absolute my-px rounded-md text-left px-1.5 py-0.5 overflow-hidden text-[11px] leading-tight border border-dashed cursor-grab active:cursor-grabbing ${
                      dragging?.type === "evenement" && dragging.id === e.id ? "opacity-30" : ""
                    }`}
                    style=${{
                      ...pos,
                      backgroundColor: `${EVENEMENT_COLOR}1F`,
                      borderColor: EVENEMENT_COLOR,
                      color: EVENEMENT_COLOR,
                    }}
                    draggable="true"
                    onDragStart=${startDrag("evenement", e.id, e.debut, e.fin)}
                    onDragEnd=${endDrag}
                    onDragOver=${dragOverAnywhere}
                    onDrop=${dropAnywhere}
                    onClick=${() => onEditEvenement(e)}
                    title="Événement ponctuel — clic pour modifier ou supprimer · glisser pour déplacer"
                  >
                    <span class="font-semibold">${e.titre}</span>
                    ${!pos.compact && html`<span class="block opacity-80">${e.debut}–${e.fin}</span>`}
                  </button>
                `
              );
            }

            for (const k of colles) {
              const di = days.indexOf(k.date);
              const passageStart = timeToMinutes(k.heure);
              const { prepa, passage } = colleDurees(k.matiere);
              const start = passageStart - prepa;
              const end = passageStart + passage;
              const color = subjectAccent(k.matiere);
              pushItem(
                di,
                start,
                end,
                (pos) => html`
                  <button
                    key=${k.id}
                    class="absolute my-px rounded-md text-left px-1.5 py-0.5 overflow-hidden text-[11px] leading-tight border-2"
                    style=${{ ...pos, backgroundColor: color, borderColor: "#fff", color: "#fff" }}
                    onDragOver=${dragOverAnywhere}
                    onDrop=${dropAnywhere}
                    onClick=${() => onOpenColle(k)}
                    title="Colle — clic pour modifier"
                  >
                    <span class="font-semibold">🎤 Colle ${subjectLabel(k.matiere)}</span>
                    ${!pos.compact &&
                    html`<span class="block opacity-90"
                      >${k.heure}${prepa > 0 ? ` (${minutesToTime(start)})` : ""}${k.salle ? ` · ${k.salle}` : ""}</span
                    >`}
                  </button>
                `
              );
            }

            for (const s of sessions) {
              const di = days.indexOf(s.date);
              const start = timeToMinutes(s.debut);
              const end = timeToMinutes(s.fin);
              const color = s.estCours ? COURS_COLOR : subjectAccent(s.matiere);
              const done = s.statut === "realise";
              const style = s.estCours
                ? { backgroundColor: color, borderColor: subjectAccent(s.matiere), color: "#fff", boxShadow: "0 0 0 1.5px #fff" }
                : done
                ? { backgroundColor: color, borderColor: color, color: "#fff" }
                : { backgroundColor: `${color}1F`, borderColor: color, color };
              pushItem(
                di,
                start,
                end,
                (pos) => {
                  // Pour les cours (estCours), on rogne légèrement le rectangle
                  // top/height (calé pile à pile sur les minutes réelles, donc
                  // deux cours qui se suivent se touchent exactement) pour que le
                  // liseret blanc reste visible tout autour même entre deux cours
                  // consécutifs — une simple margin ne suffit pas ici : sur des
                  // éléments en position absolute, deux marges identiques de part
                  // et d'autre d'une même frontière se compensent et ne créent
                  // aucun écart visuel.
                  const boxPos = s.estCours
                    ? { ...pos, top: `${parseFloat(pos.top) + 1.5}px`, height: `${Math.max(11, parseFloat(pos.height) - 3)}px` }
                    : pos;
                  return html`
                  <button
                    key=${s.id}
                    class=${`absolute my-px rounded-md text-left px-1.5 py-0.5 overflow-hidden text-[11px] leading-tight cursor-grab active:cursor-grabbing ${
                      s.estCours ? "border-2" : "border"
                    } ${dragging?.type === "session" && dragging.id === s.id ? "opacity-30" : ""}`}
                    style=${{ ...boxPos, ...style }}
                    draggable="true"
                    onDragStart=${startDrag("session", s.id, s.debut, s.fin)}
                    onDragEnd=${endDrag}
                    onDragOver=${dragOverAnywhere}
                    onDrop=${dropAnywhere}
                    onClick=${onSingleClick(() => onOpenSession(s))}
                    onDoubleClick=${onDouble(() => onEditSession(s))}
                    title="Session ponctuelle — clic : marquer réalisée · double-clic : modifier · glisser pour déplacer"
                  >
                    <span class="font-semibold">${itemLabel(s.matiere, s.theme, s.titre)}${s.contenu?.trim() ? " ✏️" : ""}${
                      s.devoirStatut === "fait" ? " 📖✅" : s.devoirStatut === "encours" ? " 📖⏳" : ""
                    }</span>
                    ${!pos.compact && html`<span class="block opacity-80">${s.debut}–${s.fin}</span>`}
                    ${done && html`<span class="absolute top-0.5 right-1">✓</span>`}
                  </button>
                `;
                }
              );
            }

            for (const ep of epreuvesCB) {
              const di = days.indexOf(ep.date);
              const start = timeToMinutes(ep.debut);
              const end = timeToMinutes(ep.fin);
              pushItem(
                di,
                start,
                end,
                (pos) => html`
                  <div
                    key=${ep.id}
                    class="absolute my-px rounded-md text-left px-1.5 py-0.5 overflow-hidden text-[11px] leading-tight border-2"
                    style=${{ ...pos, backgroundColor: CB_COLOR, borderColor: "#fff", color: "#fff" }}
                    onDragOver=${dragOverAnywhere}
                    onDrop=${dropAnywhere}
                    title=${`${ep.cbNom} — ${subjectLabel(ep.matiere)}`}
                  >
                    <span class="font-semibold">📝 ${ep.cbNom} · ${subjectLabel(ep.matiere)}</span>
                    ${!pos.compact && html`<span class="block opacity-90">${ep.debut}–${ep.fin}</span>`}
                  </div>
                `
              );
            }

            // Répartition des éléments en chevauchement sur des voies côte à côte (même
            // principe qu'un calendrier classique) : on regroupe par grappes d'éléments
            // mutuellement chevauchants, puis on assigne à chacun la première voie libre.
            const layoutDay = (items) => {
              const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
              const placed = [];
              let cluster = [];
              let clusterEnd = -Infinity;
              const flush = () => {
                if (!cluster.length) return;
                const laneEnds = [];
                for (const it of cluster) {
                  let lane = laneEnds.findIndex((end) => end <= it.start);
                  if (lane === -1) {
                    lane = laneEnds.length;
                    laneEnds.push(it.end);
                  } else {
                    laneEnds[lane] = it.end;
                  }
                  it.lane = lane;
                }
                const numLanes = laneEnds.length;
                for (const it of cluster) placed.push({ ...it, numLanes });
                cluster = [];
              };
              for (const it of sorted) {
                if (cluster.length && it.start >= clusterEnd) {
                  flush();
                  clusterEnd = -Infinity;
                }
                cluster.push(it);
                clusterEnd = Math.max(clusterEnd, it.end);
              }
              flush();
              return placed;
            };

            // Position absolue à l'intérieur de la zone de grille : grid-row est
            // volontairement laissé indéfini pour que la zone de positionnement couvre
            // toute la hauteur de la colonne du jour (grid-column seul suffit à fixer sa
            // largeur). Hauteur et position verticale calculées en continu à partir des
            // minutes réelles (PX_PER_MIN), pas calées sur les cases de 30 min de la
            // grille — sinon un 45 min et un 30 min qui tombent dans la même case de
            // fond se retrouvaient avec exactement la même hauteur visuelle.
            const PX_PER_MIN = ROW_PX / SLOT_MIN;
            return dayBuckets.flatMap((items, di) =>
              layoutDay(items).map(({ start, end, render, lane, numLanes }) => {
                const width = 100 / numLanes;
                const pos = {
                  gridColumn: `${di + 2} / ${di + 3}`,
                  top: `${(start - DAY_START) * PX_PER_MIN}px`,
                  height: `${Math.max(14, (end - start) * PX_PER_MIN)}px`,
                  left: `calc(${width * lane}% + 1px)`,
                  width: `calc(${width}% - 2px)`,
                };
                // Case trop courte (30 min ou moins) pour accueillir le titre ET
                // l'horaire sans déborder moche du cadre — on masque alors l'horaire, le
                // titre seul suffit à identifier le créneau.
                pos.compact = end - start <= 30;
                return render(pos);
              })
            );
          })()}
          ${showNowLine &&
          html`
            <div
              class="absolute pointer-events-none z-20"
              style=${{
                top: `${nowTopPx}px`,
                left: `calc(44px + (100% - 44px) * ${todayIndex} / 7)`,
                width: `calc((100% - 44px) / 7)`,
              }}
            >
              <div class="relative">
                <span class="absolute -left-1.5 -top-1 h-2 w-2 rounded-full bg-red-500"></span>
                <div class="h-px bg-red-500"></div>
              </div>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
