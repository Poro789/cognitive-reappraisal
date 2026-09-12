import { escapeHtml } from "./utils.js";

// Promise-based confirm dialog. Focus starts on the cancel button (safe
// default for destructive actions). Escape cancels; Enter does NOT confirm.
export function confirmDialog(title, message, confirmLabel) {
  return new Promise(function(resolve) {
    var overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML =
      '<div class="confirm-box" role="alertdialog" aria-modal="true" aria-label="' + escapeHtml(title) + '">' +
        '<div class="confirm-title">' + escapeHtml(title) + '</div>' +
        '<div class="confirm-msg">' + escapeHtml(message) + '</div>' +
        '<div class="confirm-actions">' +
          '<button class="btn btn-text" data-act="cancel">取消</button>' +
          '<button class="btn btn-primary" data-act="ok">' + escapeHtml(confirmLabel || "确定") + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    function done(val) {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      resolve(val);
    }
    function onKey(ev) {
      // Only Escape cancels. Enter must NOT confirm — the confirm button
      // (e.g. 删除) is a destructive action that requires an explicit click.
      if (ev.key === "Escape") done(false);
    }
    var cancelBtn = overlay.querySelector('[data-act="cancel"]');
    var okBtn = overlay.querySelector('[data-act="ok"]');
    cancelBtn.addEventListener("click", function() { done(false); });
    okBtn.addEventListener("click", function() { done(true); });
    overlay.addEventListener("click", function(ev) { if (ev.target === overlay) done(false); });
    document.addEventListener("keydown", onKey);
    // Focus the cancel button: safe default so an accidental Enter never
    // triggers the destructive action.
    setTimeout(function() { cancelBtn.focus(); }, 30);
  });
}