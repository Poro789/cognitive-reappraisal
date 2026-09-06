import { STORAGE_KEY } from "./constants.js";

export const state = {
  view: "list",        // list | wizard | detail
  entries: [],
  entryMap: {},        // id -> entry (kept in sync with entries for O(1) lookup)
  wizard: null,        // { draft: {...}, step: number, editingId: null }
  detail: null,        // { id, showFollowup: boolean }
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
  } catch (e) {
    // Storage full or disabled (e.g. private browsing). Warn the user so
    // they know the data may not persist.
    console.warn("saveEntries failed:", e);
    showToast("保存失败：浏览器存储不可用或已满，数据可能未保留。");
  }
}

// Lightweight toast notification (auto-dismisses after 3s)
var toastTimer = null;
export function showToast(msg) {
  var existing = document.getElementById("app-toast");
  if (existing) existing.remove();
  var el = document.createElement("div");
  el.id = "app-toast";
  el.setAttribute("role", "alert");
  el.textContent = msg;
  el.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);" +
    "background:#1c2428;color:#fff;padding:10px 18px;border-radius:6px;" +
    "font-size:14px;z-index:300;max-width:90vw;text-align:center;" +
    "box-shadow:0 4px 12px rgba(0,0,0,0.2);";
  document.body.appendChild(el);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.remove(); }, 3000);
}

export function getEntry(id) {
  return state.entryMap[id] || null;
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