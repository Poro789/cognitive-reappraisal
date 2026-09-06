// Pure helper functions (no DOM / state dependencies) — unit-testable.

export function uid() {
  // Prefer crypto.randomUUID (secure, collision-resistant); fall back to
  // timestamp+random for older browsers without it.
  // globalThis.crypto works in both browsers and Node (for tests).
  if (globalThis.crypto && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 9);
}

export function formatDate(ts) {
  var d = new Date(ts);
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  var h = String(d.getHours()).padStart(2, "0");
  var min = String(d.getMinutes()).padStart(2, "0");
  return y + "-" + m + "-" + day + " " + h + ":" + min;
}

export function truncate(str, n) {
  if (!str) return "";
  str = str.replace(/\s+/g, " ").trim();
  // Use Array.from to iterate by code point so surrogate pairs (emoji, etc.)
  // are never split in half.
  var chars = Array.from(str);
  return chars.length > n ? chars.slice(0, n).join("") + "…" : str;
}

export function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// True if the user has typed anything into the draft (sliders default to 5 and don't count)
export function draftHasContent(d) {
  return !!(
    (d.situation && d.situation.trim()) ||
    (d.automatic_thought && d.automatic_thought.trim()) ||
    (d.emotion_label && d.emotion_label.trim()) ||
    (d.evidence_for && d.evidence_for.trim()) ||
    (d.evidence_against && d.evidence_against.trim()) ||
    (d.alternative_thought && d.alternative_thought.trim()) ||
    (d.cognitive_distortion && d.cognitive_distortion.length)
  );
}