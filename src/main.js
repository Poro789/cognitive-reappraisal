import { state, loadEntries, rebuildEntryMap, loadWizardDraft } from "./state.js";
import { renderList } from "./views/list.js";
import { renderWizard } from "./views/wizard.js";
import { renderDetail } from "./views/detail.js";
import { renderReview } from "./views/review.js";
import { renderExportModal, closeExportModal } from "./views/export-modal.js";
import { buildExportText } from "./export.js";
import { formatDate, truncate, escapeHtml, draftHasContent, uid } from "./utils.js";
import "./styles.css";

var app = document.getElementById("app");

function render() {
  document.body.classList.toggle("selecting", state.selecting);
  if (state.view === "list") renderList(app, render);
  else if (state.view === "wizard") renderWizard(app, render);
  else if (state.view === "detail") renderDetail(app, render);
  else if (state.view === "review") renderReview(app, render);

  if (state.exportModal) renderExportModal();
}

// ---------- Init ----------
state.entries = loadEntries();
rebuildEntryMap();

// Check for an unfinished wizard draft and offer to resume
var savedDraft = loadWizardDraft();
if (savedDraft && draftHasContent(savedDraft.draft)) {
  state._resumeDraft = savedDraft;
}

// Event delegation for list-view cards & checkboxes (bound once).
app.addEventListener("click", function(ev) {
  var cb = ev.target.closest(".checkbox");
  if (cb) {
    ev.stopPropagation();
    toggleSelect(cb.getAttribute("data-id"));
    return;
  }
  var card = ev.target.closest(".entry-card");
  if (card) {
    var id = card.getAttribute("data-id");
    if (state.selecting) toggleSelect(id);
    else openDetail(id);
  }
});
app.addEventListener("keydown", function(ev) {
  if (ev.key !== "Enter" && ev.key !== " ") return;
  var card = ev.target.closest(".entry-card");
  if (card && ev.target === card) {
    ev.preventDefault();
    var id = card.getAttribute("data-id");
    if (state.selecting) toggleSelect(id);
    else openDetail(id);
  }
});

function toggleSelect(id) {
  if (state.selected[id]) delete state.selected[id];
  else state.selected[id] = true;
  render();
}

function openDetail(id) {
  state.detail = { id: id, showFollowup: false, editingField: null, tagDraft: null, noteDraft: null };
  state.view = "detail";
  render();
}

// Escape key closes modal
document.addEventListener("keydown", function(ev) {
  if (ev.key === "Escape" && state.exportModal) {
    closeExportModal();
  }
});

render();

// Expose for automated testing (harmless in production)
window.__CR_TEST__ = {
  getState: function() { return state; },
  setEntries: function(entries) { state.entries = entries; rebuildEntryMap(); render(); },
  buildExportText: buildExportText,
  formatDate: formatDate,
  truncate: truncate,
  escapeHtml: escapeHtml,
  draftHasContent: draftHasContent,
  uid: uid
};