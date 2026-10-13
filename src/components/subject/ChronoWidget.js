import { useEffect, useRef, useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";

function formatMs(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio indisponible (autoplay bloqué, navigateur non supporté…) — on ignore.
  }
}

export function ChronoWidget({ tab }) {
  const [mode, setMode] = useState("chrono"); // chrono | minuteur
  const [running, setRunning] = useState(false);
  const [accumulatedMs, setAccumulatedMs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [dureeMin, setDureeMin] = useState(10);
  const [termine, setTermine] = useState(false);
  const startedAtRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setNow(Date.now()), 250);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const elapsedMs = accumulatedMs + (running ? now - startedAtRef.current : 0);
  const totalMs = dureeMin * 60000;
  const remainingMs = mode === "minuteur" ? totalMs - elapsedMs : null;

  useEffect(() => {
    if (mode === "minuteur" && running && remainingMs <= 0) {
      setRunning(false);
      setAccumulatedMs(totalMs);
      setTermine(true);
      beep();
    }
  }, [remainingMs, running, mode]);

  const start = () => {
    setTermine(false);
    startedAtRef.current = Date.now();
    setNow(Date.now());
    setRunning(true);
  };

  const pause = () => {
    setAccumulatedMs((v) => v + (Date.now() - startedAtRef.current));
    setRunning(false);
  };

  const reset = () => {
    setRunning(false);
    setAccumulatedMs(0);
    setTermine(false);
    setNow(Date.now());
  };

  const switchMode = (m) => {
    setMode(m);
    reset();
  };

  const display = mode === "chrono" ? formatMs(elapsedMs) : formatMs(Math.max(0, remainingMs));

  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-slate-800">Chrono / Minuteur</h3>
        <div class="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          <button
            class=${`px-3 py-1 ${mode === "chrono" ? "text-white" : "text-slate-500 hover:bg-slate-50"}`}
            style=${mode === "chrono" ? { backgroundColor: tab.accent } : {}}
            onClick=${() => switchMode("chrono")}
          >
            Chrono
          </button>
          <button
            class=${`px-3 py-1 border-l border-slate-200 ${mode === "minuteur" ? "text-white" : "text-slate-500 hover:bg-slate-50"}`}
            style=${mode === "minuteur" ? { backgroundColor: tab.accent } : {}}
            onClick=${() => switchMode("minuteur")}
          >
            Minuteur
          </button>
        </div>
      </div>

      ${mode === "minuteur" &&
      !running &&
      elapsedMs === 0 &&
      html`
        <label class="text-sm text-slate-600 block mb-3">
          Durée (minutes)
          <input
            type="number"
            min="1"
            max="240"
            class="mt-1 w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value=${dureeMin}
            onInput=${(e) => setDureeMin(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      `}

      <div
        class=${`text-5xl font-bold tabular-nums text-center py-6 rounded-xl mb-4 ${
          termine ? "bg-red-50 text-red-600 animate-pulse" : "bg-slate-50 text-slate-800"
        }`}
      >
        ${display}
      </div>

      ${termine && html`<p class="text-center text-sm text-red-600 font-medium mb-4">Temps écoulé !</p>`}

      <div class="flex justify-center gap-2">
        ${!running &&
        html`<button
          class="px-5 py-1.5 rounded-lg text-sm font-medium text-white"
          style=${{ backgroundColor: tab.accent }}
          onClick=${start}
        >
          ${elapsedMs > 0 ? "Reprendre" : "Démarrer"}
        </button>`}
        ${running &&
        html`<button class="px-5 py-1.5 rounded-lg text-sm font-medium text-white bg-slate-500 hover:bg-slate-600" onClick=${pause}>
          Pause
        </button>`}
        <button class="px-5 py-1.5 rounded-lg text-sm text-slate-600 border border-slate-300 hover:bg-slate-50" onClick=${reset}>
          Réinitialiser
        </button>
      </div>
    </div>
  `;
}
