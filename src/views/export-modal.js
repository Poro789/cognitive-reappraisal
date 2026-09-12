import { escapeHtml } from "../utils.js";
import { buildExportText, copyToClipboard } from "../export.js";
import { state, getEntry } from "../state.js";

export function renderExportModal() {
  var ids = Object.keys(state.selected);
  var text = buildExportText(ids, getEntry);

  var overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "export-modal";
  overlay.innerHTML =
    '<div class="modal" role="dialog" aria-modal="true" aria-label="导出记录">' +
      '<div class="modal-header">' +
        '<span class="modal-title">导出选中记录</span>' +
        '<button class="modal-close" id="btn-modal-close" aria-label="关闭">×</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<textarea class="export-textarea" id="export-text" readonly>' + escapeHtml(text) + '</textarea>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-primary" id="btn-copy">复制到剪贴板</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  document.getElementById("btn-modal-close").addEventListener("click", closeExportModal);
  overlay.addEventListener("click", function(ev) {
    if (ev.target === overlay) closeExportModal();
  });

  // Focus trap: keep Tab/Shift+Tab cycling within the modal
  (function() {
    var focusable = overlay.querySelectorAll("button, textarea, input, [tabindex]:not([tabindex='-1'])");
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    overlay.addEventListener("keydown", function(ev) {
      if (ev.key !== "Tab") return;
      if (ev.shiftKey) {
        if (document.activeElement === first) {
          ev.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          ev.preventDefault();
          first.focus();
        }
      }
    });
  })();

  document.getElementById("btn-copy").addEventListener("click", function() {
    var btn = this;
    function showCopied() {
      btn.textContent = "已复制";
      btn.disabled = true;
      setTimeout(function() {
        btn.textContent = "复制到剪贴板";
        btn.disabled = false;
      }, 2000);
    }
    copyToClipboard(text).then(showCopied).catch(function() {
      var ta = document.getElementById("export-text");
      ta.focus();
      ta.select();
      btn.textContent = "请手动复制 (Ctrl+C)";
      setTimeout(function() { btn.textContent = "复制到剪贴板"; }, 3000);
    });
  });

  setTimeout(function() {
    document.getElementById("btn-modal-close").focus();
  }, 50);
}

export function closeExportModal() {
  state.exportModal = false;
  var modal = document.getElementById("export-modal");
  if (modal) modal.remove();
}