import { REVIEW_INSTRUCTION, NONE_OF_ABOVE } from "./constants.js";
import { formatDate } from "./utils.js";

// Build the structured plain-text export for the selected entry ids.
// `getEntry` is passed in to avoid a circular import with state.js.
export function buildExportText(ids, getEntry) {
  var parts = [REVIEW_INSTRUCTION, ""];
  var selected = ids.map(getEntry).filter(Boolean);
  selected.sort(function(a, b) { return a.created_at - b.created_at; });

  selected.forEach(function(e) {
    var lines = [];
    lines.push("---");
    lines.push("记录时间：" + formatDate(e.created_at));
    lines.push("情境：" + (e.situation || "[空]"));
    lines.push("自动想法：" + (e.automatic_thought || "[空]") + "（当时相信程度 " + e.thought_belief_before + "/10）");
    lines.push("情绪：" + (e.emotion_label || "[未命名]") + "，强度 " + e.emotion_intensity_before + "/10");
    if (e.cognitive_distortion && e.cognitive_distortion.length > 0) {
      if (e.cognitive_distortion.indexOf(NONE_OF_ABOVE) !== -1) {
        var note = (e.distortion_note || "").trim();
        if (note) {
          lines.push("认知扭曲类型：以上都不像（用户描述：" + note + "）");
        } else {
          lines.push("认知扭曲类型：以上都不像（用户判断不属于常见认知扭曲）");
        }
      } else {
        lines.push("认知扭曲类型：" + e.cognitive_distortion.join("、"));
      }
    }
    lines.push("支持这个想法的证据：" + (e.evidence_for || "[空]"));
    lines.push("反对这个想法的证据：" + (e.evidence_against || "[空]"));
    lines.push("替代想法：" + (e.alternative_thought || "[空]") + "（相信程度 " + e.thought_belief_after + "/10）");
    lines.push("重新评估后情绪强度：" + e.emotion_intensity_after + "/10");
    if (e.followup_completed && e.followup_outcome) {
      lines.push("回填结果：" + e.followup_outcome + "（回填时间：" + formatDate(e.followup_date) + "）");
    } else {
      lines.push("回填结果：尚未回填");
    }
    lines.push("---");
    parts.push(lines.join("\n"));
  });

  return parts.join("\n");
}

export function copyToClipboard(text) {
  // Prefer the async Clipboard API when available (https / secure context).
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(function() {
      // Fall through to the legacy method (common on file:// where the
      // async API is blocked but a user-gesture execCommand still works).
      return legacyCopy(text);
    });
  }
  return legacyCopy(text);
}

function legacyCopy(text) {
  return new Promise(function(resolve, reject) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    // Select within the (still focused) element for iOS Safari
    var range = document.createRange();
    range.selectNodeContents(ta);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    ta.focus();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    sel.removeAllRanges();
    document.body.removeChild(ta);
    if (ok) resolve();
    else reject(new Error("copy failed"));
  });
}