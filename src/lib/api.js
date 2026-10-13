const BASE = "/api/data";

// Numéro de version reçu avec les données — renvoyé à chaque sauvegarde pour
// que le serveur puisse détecter un onglet resté ouvert avec une copie
// périmée (cf. server.py) au lieu d'écraser silencieusement des changements
// plus récents.
let currentVersion = null;

export async function loadData() {
  // Copie en lecture seule publiée (cf. publish_readonly.py) : pas de serveur
  // /api/data derrière un hébergement statique — on lit le fichier de données
  // figé publié à côté de la page, sans en-tête de version (inutile, il n'y a
  // jamais de sauvegarde concurrente à détecter sur une copie figée).
  if (typeof window !== "undefined" && window.__CARNET_READONLY__ === true) {
    const res = await fetch("./data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Impossible de charger data.json");
    return res.json();
  }
  const res = await fetch(BASE, { cache: "no-store" });
  if (!res.ok) throw new Error("Impossible de charger data.json");
  currentVersion = res.headers.get("X-Data-Version");
  return res.json();
}

// Copie en lecture seule uniquement : petit fichier à part (jamais mis en
// cache, { cache: "no-store" } force une vraie requête réseau à chaque appel)
// qui donne l'horodatage de la dernière publication — sert à détecter qu'une
// version plus récente existe pendant que la page elle-même reste affichée
// (cf. le sondage périodique dans store.js), sans dépendre d'un rechargement
// de page qui pourrait lui-même rester bloqué sur une copie en cache.
export async function fetchSnapshotMeta() {
  try {
    const res = await fetch("./meta.json", { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function saveData(data, { force = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (currentVersion != null) headers["X-Data-Version"] = currentVersion;
  if (force) headers["X-Force-Save"] = "1";

  const res = await fetch(BASE, { method: "POST", headers, body: JSON.stringify(data) });

  if (res.status === 409) {
    const payload = await res.json();
    currentVersion = res.headers.get("X-Data-Version");
    const err = new Error("Sauvegarde refusée : conflit détecté");
    err.code = "CONFLICT";
    err.reason = payload.reason;
    err.freshData = payload.data;
    throw err;
  }
  if (!res.ok) throw new Error("Impossible d'enregistrer data.json");
  currentVersion = res.headers.get("X-Data-Version");
  return res.json();
}
