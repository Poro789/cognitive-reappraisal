import { STORAGE_KEY, WIZARD_KEY } from "./constants.js";

export const state = {
  view: "list",        // list | wizard | detail | review
  entries: [],
  entryMap: {},        // id -> entry (kept in sync with entries for O(1) lookup)
  wizard: null,        // { draft: {...}, step: number }
  detail: null,        // { id, showFollowup, editingField, tagDraft, noteDraft }
  selected: {},        // id -> true
  selecting: false,
  exportModal: false
};

// Rebuild the id->entry map. Call after any structural change to entries.
export function rebuildEntryMap() {
  state.entryMap = {};
  for (var i = 0; i < state.entries.length; i++) {
    state.entryMap[state.entries[i].id] = state.entries[i];
  }
}

export function loadEntries() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { /* ignore */ }
  return [];
}

export function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
    return true;
  } catch (e) {
    // Storage full or disabled (e.g. private browsing). Warn the user so
    // they know the data may not persist.
    console.warn("saveEntries failed:", e);
    showToast("保存失败：浏览器存储不可用或已满。当前数据可能未保留，请尽快导出 JSON 备份。", { persistent: true });
    return false;
  }
}

// Lightweight toast notification (auto-dismisses after 3s unless persistent)
var toastTimer = null;
export function showToast(msg, opts) {
  var existing = document.getElementById("app-toast");
  if (existing) existing.remove();
  var el = document.createElement("div");
  el.id = "app-toast";
  el.setAttribute("role", "alert");
  el.textContent = msg;
  var persistent = opts && opts.persistent;
  el.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);" +
    "background:" + (persistent ? "#c0392b" : "#1c2428") + ";color:#fff;padding:10px 18px;border-radius:6px;" +
    "font-size:14px;z-index:300;max-width:90vw;text-align:center;" +
    "box-shadow:0 4px 12px rgba(0,0,0,0.2);" +
    (persistent ? "cursor:pointer;" : "");
  if (persistent) {
    el.title = "点击关闭";
    el.addEventListener("click", function() { el.remove(); });
  }
  document.body.appendChild(el);
  if (toastTimer) clearTimeout(toastTimer);
  if (!persistent) {
    toastTimer = setTimeout(function() { el.remove(); }, 3000);
  }
}

export function getEntry(id) {
  return state.entryMap[id] || null;
}

// ---------- Entry mutations (all persistence goes through here) ----------

export function addEntry(entry) {
  state.entries.push(entry);
  state.entryMap[entry.id] = entry;
  saveEntries();
}

export function updateEntry(id, patch) {
  var e = getEntry(id);
  if (!e) return;
  Object.assign(e, patch);
  saveEntries();
}

export function deleteEntry(id) {
  var idx = -1;
  for (var i = 0; i < state.entries.length; i++) {
    if (state.entries[i].id === id) { idx = i; break; }
  }
  if (idx === -1) return;
  state.entries.splice(idx, 1);
  delete state.entryMap[id];
  saveEntries();
}

// ---------- Wizard draft persistence ----------

export function saveWizardDraft() {
  if (!state.wizard) return;
  try {
    localStorage.setItem(WIZARD_KEY, JSON.stringify(state.wizard));
  } catch (e) { /* non-critical */ }
}

export function loadWizardDraft() {
  try {
    var raw = localStorage.getItem(WIZARD_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.draft && typeof parsed.step === "number") return parsed;
    }
  } catch (e) { /* ignore */ }
  return null;
}

export function clearWizardDraft() {
  try { localStorage.removeItem(WIZARD_KEY); } catch (e) { /* ignore */ }
}

// ---------- JSON import / export ----------

// Validate and normalize one imported entry. Returns null if invalid.
export function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (typeof raw.created_at !== "number" || !isFinite(raw.created_at)) return null;
  var e = {
    id: raw.id,
    created_at: raw.created_at,
    situation: typeof raw.situation === "string" ? raw.situation : "",
    automatic_thought: typeof raw.automatic_thought === "string" ? raw.automatic_thought : "",
    thought_belief_before: clampInt(raw.thought_belief_before, 1, 10, 5),
    emotion_label: typeof raw.emotion_label === "string" ? raw.emotion_label : "",
    emotion_intensity_before: clampInt(raw.emotion_intensity_before, 1, 10, 5),
    cognitive_distortion: Array.isArray(raw.cognitive_distortion)
      ? raw.cognitive_distortion.filter(function(t) { return typeof t === "string"; })
      : [],
    distortion_note: typeof raw.distortion_note === "string" ? raw.distortion_note : "",
    evidence_for: typeof raw.evidence_for === "string" ? raw.evidence_for : "",
    evidence_against: typeof raw.evidence_against === "string" ? raw.evidence_against : "",
    alternative_thought: typeof raw.alternative_thought === "string" ? raw.alternative_thought : "",
    thought_belief_after: clampInt(raw.thought_belief_after, 1, 10, 5),
    emotion_intensity_after: clampInt(raw.emotion_intensity_after, 1, 10, 5),
    followup_completed: !!raw.followup_completed,
    followup_outcome: typeof raw.followup_outcome === "string" ? raw.followup_outcome : "",
    followup_date: typeof raw.followup_date === "number" ? raw.followup_date : null
  };
  return e;
}

export function clampInt(v, min, max, fallback) {
  var n = parseInt(v, 10);
  if (!isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// Merge imported entries into state. Existing ids are skipped (not overwritten).
// Returns { added, skipped }.
export function importEntries(imported) {
  var added = 0, skipped = 0;
  for (var i = 0; i < imported.length; i++) {
    var e = normalizeEntry(imported[i]);
    if (!e) { skipped++; continue; }
    if (state.entryMap[e.id]) { skipped++; continue; }
    state.entries.push(e);
    state.entryMap[e.id] = e;
    added++;
  }
  if (added > 0) saveEntries();
  return { added: added, skipped: skipped };
}

// Build the export payload (raw entries, no review instruction).
export function buildDataExport() {
  return JSON.stringify(state.entries, null, 2);
}