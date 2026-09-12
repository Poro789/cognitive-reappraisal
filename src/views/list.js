import { formatDate, truncate, escapeHtml } from "../utils.js";
import { state, importEntries, buildDataExport, showToast, clearWizardDraft } from "../state.js";

export function renderList(app, render) {
  var entries = state.entries.slice().sort(function(a, b) { return b.created_at - a.created_at; });
  var selectedCount = Object.keys(state.selected).length;

  var html = "";
  html += '<header class="app-header">';
  html += '<h1 class="app-title">思维记录</h1>';
  html += '</header>';

  if (state.selecting) {
    var allSelected = selectedCount === entries.length && entries.length > 0;
    html += '<div class="list-toolbar">';
    html += '<button class="btn btn-text" id="btn-cancel-select">取消</button>';
    html += '<button class="btn-select-all" id="btn-select-all">' + (allSelected ? "全不选" : "全选") + '</button>';
    html += '<span class="count">已选 ' + selectedCount + ' 条</span>';
    html += '<button class="btn btn-primary" id="btn-export"' + (selectedCount === 0 ? ' disabled' : '') + '>导出</button>';
    html += '</div>';
  } else {
    html += '<div class="list-toolbar">';
    if (entries.length > 0) html += '<button class="btn btn-ghost" id="btn-select-mode">选择记录</button>';
    else html += '<span class="count"></span>';
    html += '<button class="btn btn-ghost" id="btn-review">回顾</button>';
    html += '<button class="btn btn-primary" id="btn-new">新建</button>';
    html += '</div>';
  }

  if (entries.length === 0) {
    html += '<div class="empty-state">';
    html += '<h2>还没有记录</h2>';
    html += '<p>这是一个基于认知行为疗法的思维记录工具。当你被某个想法困住时，点\u201c新建\u201d，跟着提示一步步写下当时的情境、想法和情绪，然后试着找证据、换一个更平衡的想法。不需要一次写完，随时可以回来补充。</p>';
    html += '</div>';
  } else {
    html += '<div class="entry-list">';
    entries.forEach(function(e, i) {
      var isSelected = !!state.selected[e.id];
      var emotion = e.emotion_label ? escapeHtml(e.emotion_label) : "未命名";
      var change = e.emotion_intensity_before + "→" + e.emotion_intensity_after;
      var followup = e.followup_completed ? "已回填" : "待回填";
      var num = entries.length - i; // most recent = highest number

      html += '<div class="entry-card' + (isSelected ? " selected" : "") + '" data-id="' + e.id + '" tabindex="' + (state.selecting ? "-1" : "0") + '" role="button" aria-label="' + (state.selecting ? "选择记录：" : "查看记录：") + escapeHtml(truncate(e.situation, 20)) + '">';
      if (state.selecting) {
        html += '<span class="entry-check">';
        html += '<input type="checkbox" class="checkbox" data-id="' + e.id + '"' + (isSelected ? " checked" : "") + ' aria-label="选择这条记录">';
        html += '</span>';
      }
      html += '<div class="entry-body">';
      html += '<div class="entry-topline">';
      html += '<span class="entry-num">#' + num + '</span>';
      html += '<span class="entry-date">' + formatDate(e.created_at) + '</span>';
      html += '</div>';
      html += '<div class="entry-situation">' + escapeHtml(truncate(e.situation, 30)) + '</div>';
      html += '<div class="entry-meta">';
      html += '<span class="emotion">' + emotion + '</span>';
      html += '<span class="intensity-change">' + change + '</span>';
      html += '</div>';
      html += '<div class="entry-followup">' + followup + (e.followup_completed && e.followup_date ? ' · ' + formatDate(e.followup_date) : '') + '</div>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Resume banner for an unfinished wizard draft
  if (state._resumeDraft) {
    html += '<div class="resume-banner">';
    html += '<span class="resume-text">上次有一条未完成的记录</span>';
    html += '<button class="btn btn-ghost resume-btn" id="btn-resume-draft">继续填写</button>';
    html += '<button class="btn btn-text resume-btn" id="btn-discard-draft">放弃</button>';
    html += '</div>';
  }

  // Data management + privacy note
  html += '<div class="list-footer">';
  html += '<div class="data-actions">';
  html += '<button class="btn btn-text data-btn" id="btn-export-json">导出 JSON</button>';
  html += '<button class="btn btn-text data-btn" id="btn-import-json">导入 JSON</button>';
  html += '<input type="file" id="import-file-input" accept=".json,application/json" hidden>';
  html += '</div>';
  html += '<p class="privacy-note">数据仅保存在此浏览器中，清除浏览器数据会删除记录。</p>';
  html += '</div>';

  app.innerHTML = html;

  // Bind events
  var btnNew = document.getElementById("btn-new");
  if (btnNew) btnNew.addEventListener("click", function() {
    startNewWizard();
    render();
  });

  var btnCancel = document.getElementById("btn-cancel-select");
  if (btnCancel) btnCancel.addEventListener("click", function() {
    state.selecting = false;
    state.selected = {};
    render();
  });

  var btnSelectAll = document.getElementById("btn-select-all");
  if (btnSelectAll) btnSelectAll.addEventListener("click", function() {
    var allSelected = Object.keys(state.selected).length === entries.length && entries.length > 0;
    state.selected = {};
    if (!allSelected) {
      entries.forEach(function(en) { state.selected[en.id] = true; });
    }
    render();
  });

  var btnSelectMode = document.getElementById("btn-select-mode");
  if (btnSelectMode) btnSelectMode.addEventListener("click", function() {
    state.selecting = true;
    render();
  });

  var btnReview = document.getElementById("btn-review");
  if (btnReview) btnReview.addEventListener("click", function() {
    state.view = "review";
    render();
  });

  var btnExport = document.getElementById("btn-export");
  if (btnExport) btnExport.addEventListener("click", function() {
    var ids = Object.keys(state.selected);
    if (ids.length === 0) return;
    state.exportModal = true;
    render();
  });

  // Resume draft
  var btnResume = document.getElementById("btn-resume-draft");
  if (btnResume) btnResume.addEventListener("click", function() {
    state.wizard = state._resumeDraft;
    state._resumeDraft = null;
    state.view = "wizard";
    render();
  });

  var btnDiscard = document.getElementById("btn-discard-draft");
  if (btnDiscard) btnDiscard.addEventListener("click", function() {
    clearWizardDraft();
    state._resumeDraft = null;
    render();
  });

  // Data management
  var btnExportJson = document.getElementById("btn-export-json");
  if (btnExportJson) btnExportJson.addEventListener("click", exportJson);

  var btnImportJson = document.getElementById("btn-import-json");
  var fileInput = document.getElementById("import-file-input");
  if (btnImportJson && fileInput) {
    btnImportJson.addEventListener("click", function() { fileInput.click(); });
    fileInput.addEventListener("change", function() {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        handleImport(reader.result);
        fileInput.value = "";
      };
      reader.readAsText(file);
    });
  }
}

function startNewWizard() {
  var draft = {
    situation: "",
    automatic_thought: "",
    thought_belief_before: 5,
    emotion_label: "",
    emotion_intensity_before: 5,
    cognitive_distortion: [],
    distortion_note: "",
    evidence_for: "",
    evidence_against: "",
    alternative_thought: "",
    thought_belief_after: 5,
    emotion_intensity_after: 5
  };
  state.wizard = { draft: draft, step: 0 };
  state.view = "wizard";
}

function exportJson() {
  if (state.entries.length === 0) {
    showToast("没有可导出的记录。");
    return;
  }
  var text = buildDataExport();
  var blob = new Blob([text], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  var d = new Date();
  a.download = "cognitive-reappraisal-" + d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0") + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  showToast("已导出 " + state.entries.length + " 条记录。");
}

function handleImport(jsonText) {
  var parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    showToast("导入失败：文件不是有效的 JSON。");
    return;
  }
  if (!Array.isArray(parsed)) {
    showToast("导入失败：JSON 格式不正确（应为记录数组）。");
    return;
  }
  var result = importEntries(parsed);
  if (result.added > 0) {
    showToast("已导入 " + result.added + " 条记录" + (result.skipped > 0 ? "，跳过 " + result.skipped + " 条（重复或无效）" : "") + "。");
  } else {
    showToast("没有新记录可导入" + (result.skipped > 0 ? "（" + result.skipped + " 条重复或无效）" : "") + "。");
  }
}