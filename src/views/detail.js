import { DISTORTIONS, DISTORTION_INFO, NONE_OF_ABOVE } from "../constants.js";
import { formatDate, escapeHtml } from "../utils.js";
import { state, getEntry, deleteEntry, updateEntry } from "../state.js";
import { confirmDialog } from "../confirm.js";

export function renderDetail(app, render) {
  var e = getEntry(state.detail.id);
  if (!e) {
    state.view = "list";
    render();
    return;
  }
  var editing = state.detail.editingField;

  var html = "";
  html += '<header class="app-header">';
  html += '<button class="btn btn-text" id="btn-detail-back">← 返回</button>';
  html += '<h1 class="app-title">记录详情</h1>';
  html += '<button class="btn-delete" id="btn-detail-delete" aria-label="删除这条记录">删除</button>';
  html += '</header>';

  html += '<div class="detail">';

  function infoSection(label, value) {
    html += '<div class="detail-section">';
    html += '<div class="detail-label">' + label + '</div>';
    html += '<div class="detail-value">' + escapeHtml(value) + '</div>';
    html += '</div>';
  }

  function textField(key, label, value, placeholder) {
    html += '<div class="detail-section">';
    html += '<div class="detail-label">' + label + '</div>';
    if (editing === key) {
      html += '<textarea class="detail-edit-input" id="edit-input" aria-label="' + escapeHtml(label) + '">' + escapeHtml(value || "") + '</textarea>';
      html += '<div class="detail-edit-actions">';
      html += '<button class="btn btn-primary" id="edit-save">保存</button>';
      html += '<button class="btn btn-text" id="edit-cancel">取消</button>';
      html += '</div>';
    } else {
      html += '<div class="detail-value detail-editable' + (value ? "" : " empty") + '" data-field="' + key + '" tabindex="0" role="button" aria-label="编辑' + escapeHtml(label) + '">' + (value ? escapeHtml(value) : "（未填写，点击补充）") + '</div>';
    }
    html += '</div>';
  }

  function sliderField(key, label, value) {
    html += '<div class="detail-section">';
    html += '<div class="detail-label">' + label + '</div>';
    if (editing === key) {
      html += '<div class="detail-slider-wrap">';
      html += '<div class="detail-slider-value" id="edit-slider-value">' + value + '</div>';
      html += '<input type="range" class="slider" id="edit-slider" min="1" max="10" step="1" value="' + value + '" aria-label="' + escapeHtml(label) + '">';
      html += '</div>';
      html += '<div class="detail-edit-actions">';
      html += '<button class="btn btn-primary" id="edit-save">保存</button>';
      html += '<button class="btn btn-text" id="edit-cancel">取消</button>';
      html += '</div>';
    } else {
      html += '<div class="detail-value detail-editable" data-field="' + key + '" tabindex="0" role="button" aria-label="编辑' + escapeHtml(label) + '">' + value + '/10</div>';
    }
    html += '</div>';
  }

  infoSection("记录时间", formatDate(e.created_at));
  textField("situation", "情境", e.situation);
  textField("automatic_thought", "自动想法", e.automatic_thought);
  sliderField("thought_belief_before", "当时相信程度", e.thought_belief_before);
  textField("emotion_label", "情绪", e.emotion_label);
  sliderField("emotion_intensity_before", "情绪强度（之前）", e.emotion_intensity_before);

  var tagDraft = state.detail.tagDraft;
  html += '<div class="detail-section">';
  html += '<div class="detail-label">认知扭曲类型</div>';
  if (editing === "cognitive_distortion") {
    html += '<div class="tag-group" id="detail-tag-group">';
    DISTORTIONS.forEach(function(d) {
      var active = tagDraft.indexOf(d) !== -1;
      html += '<button type="button" class="tag-btn' + (active ? " active" : "") + '" data-tag="' + escapeHtml(d) + '">' + escapeHtml(d) + '</button>';
    });
    html += '</div>';
    html += '<div class="tag-explain" id="detail-tag-explain" hidden></div>';
    var noneActive = tagDraft.indexOf(NONE_OF_ABOVE) !== -1;
    html += '<div class="tag-alt-actions">';
    html += '<button type="button" class="tag-alt-btn' + (noneActive ? " active" : "") + '" id="detail-none-above">以上都不像</button>';
    html += '<button type="button" class="skip-link" id="detail-tag-clear">清空，不选</button>';
    html += '</div>';
    if (noneActive) {
      html += '<div class="distortion-note-wrap">';
      html += '<input type="text" class="distortion-note" id="detail-distortion-note" maxlength="60" placeholder="（可选）用你自己的话描述一下" value="' + escapeHtml(state.detail.noteDraft || "") + '" aria-label="认知扭曲补充描述">';
      html += '<div class="distortion-note-hint">例：我觉得运气对我特别差 / 事情应该更公平</div>';
      html += '</div>';
    }
    html += '<div class="detail-edit-actions">';
    html += '<button class="btn btn-primary" id="edit-save">保存</button>';
    html += '<button class="btn btn-text" id="edit-cancel">取消</button>';
    html += '</div>';
  } else {
    var tags = (e.cognitive_distortion && e.cognitive_distortion.length) ? e.cognitive_distortion.join("、") : "";
    html += '<div class="detail-value detail-editable' + (tags ? "" : " empty") + '" data-field="cognitive_distortion" tabindex="0" role="button" aria-label="编辑认知扭曲类型">' + (tags || "（未选择，点击选择）") + '</div>';
  }
  html += '</div>';

  textField("evidence_for", "支持这个想法的证据", e.evidence_for);
  textField("evidence_against", "反对这个想法的证据", e.evidence_against);
  textField("alternative_thought", "替代想法", e.alternative_thought);
  sliderField("thought_belief_after", "相信程度（之后）", e.thought_belief_after);
  sliderField("emotion_intensity_after", "情绪强度（之后）", e.emotion_intensity_after);

  // Followup
  html += '<div class="detail-section">';
  html += '<div class="detail-label">回填</div>';
  if (e.followup_completed && e.followup_outcome && !state.detail.showFollowup) {
    html += '<div class="detail-value detail-editable" data-field="followup" tabindex="0" role="button" aria-label="编辑回填结果">' + escapeHtml(e.followup_outcome) + '</div>';
    html += '<div class="entry-followup" style="margin-top:6px">回填于 ' + formatDate(e.followup_date) + '</div>';
  } else if (state.detail.showFollowup) {
    html += '<div class="followup-box">';
    html += '<div class="followup-hint">等这件事有了下文再填最好——几天到一两周都行，不填也没关系。例：\u201c两天后她回了消息，说那周在赶截止日期。回头看，第一个想法说重了。\u201d</div>';
    html += '<textarea id="followup-input" placeholder="后来实际发生了什么？回头看，哪个想法更接近事实？" aria-label="回填结果">' + escapeHtml(e.followup_outcome || "") + '</textarea>';
    html += '<div class="followup-actions">';
    html += '<button class="btn btn-primary" id="btn-followup-save">保存回填</button>';
    html += '<button class="btn btn-text" id="btn-followup-cancel">取消</button>';
    html += '</div>';
    html += '</div>';
  } else {
    html += '<div class="entry-followup" style="margin-bottom:10px">待回填</div>';
    html += '<button class="btn btn-ghost" id="btn-followup-start">回填</button>';
  }
  html += '</div>';

  html += '</div>';

  app.innerHTML = html;

  // ---- Bind: back ----
  document.getElementById("btn-detail-back").addEventListener("click", function() {
    state.view = "list";
    state.detail = null;
    render();
  });

  // ---- Bind: delete ----
  document.getElementById("btn-detail-delete").addEventListener("click", function() {
    confirmDialog("删除这条记录？", "删除后无法恢复。", "删除").then(function(ok) {
      if (!ok) return;
      deleteEntry(e.id);
      state.view = "list";
      state.detail = null;
      render();
    });
  });

  // ---- Bind: field editing ----
  var editableEls = app.querySelectorAll(".detail-editable");
  editableEls.forEach(function(el) {
    function startEdit() {
      var key = el.getAttribute("data-field");
      if (key === "followup") {
        state.detail.showFollowup = true;
        render();
        return;
      }
      state.detail.editingField = key;
      if (key === "cognitive_distortion") {
        state.detail.tagDraft = (e.cognitive_distortion || []).slice();
        state.detail.noteDraft = e.distortion_note || "";
      }
      render();
    }
    el.addEventListener("click", startEdit);
    el.addEventListener("keydown", function(ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        startEdit();
      }
    });
  });

  var editSave = document.getElementById("edit-save");
  var editCancel = document.getElementById("edit-cancel");
  if (editCancel) editCancel.addEventListener("click", function() {
    state.detail.editingField = null;
    state.detail.tagDraft = null;
    state.detail.noteDraft = null;
    render();
  });

  if (editSave) {
    editSave.addEventListener("click", function() {
      var key = state.detail.editingField;
      if (key === "cognitive_distortion") {
        updateEntry(e.id, {
          cognitive_distortion: state.detail.tagDraft.slice(),
          distortion_note: state.detail.noteDraft || ""
        });
      } else {
        var input = document.getElementById("edit-input") || document.getElementById("edit-slider");
        if (input) {
          var val = (input.type === "range") ? parseInt(input.value, 10) : input.value;
          var patch = {};
          patch[key] = val;
          updateEntry(e.id, patch);
        }
      }
      state.detail.editingField = null;
      state.detail.tagDraft = null;
      state.detail.noteDraft = null;
      render();
    });
  }

  // Slider live value display
  var editSlider = document.getElementById("edit-slider");
  if (editSlider) {
    editSlider.addEventListener("input", function() {
      document.getElementById("edit-slider-value").textContent = editSlider.value;
    });
  }

  // Distortion tags in detail
  var detailTagGroup = document.getElementById("detail-tag-group");
  if (detailTagGroup) {
    var detailExplain = document.getElementById("detail-tag-explain");
    var noneBtn = document.getElementById("detail-none-above");
    var tagDraft = state.detail.tagDraft;
    var lastShown = (tagDraft.length && tagDraft[tagDraft.length - 1] !== NONE_OF_ABOVE) ? tagDraft[tagDraft.length - 1] : null;

    function hasNone() { return tagDraft.indexOf(NONE_OF_ABOVE) !== -1; }

    function updateExplain() {
      if (!detailExplain) return;
      if (hasNone()) {
        detailExplain.innerHTML =
          '<div class="tag-explain-title">' + escapeHtml(NONE_OF_ABOVE) + '</div>' +
          '<div class="tag-explain-desc">你觉得这个想法不属于上面任何一种常见扭曲。这本身是个有用的判断——导出时会让审查者知道这一点。</div>';
        detailExplain.hidden = false;
        return;
      }
      var shown = null;
      if (lastShown && tagDraft.indexOf(lastShown) !== -1) shown = lastShown;
      else if (tagDraft.length) shown = tagDraft[tagDraft.length - 1];
      if (!shown) { detailExplain.hidden = true; detailExplain.innerHTML = ""; return; }
      var info = DISTORTION_INFO[shown];
      if (!info) { detailExplain.hidden = true; return; }
      var h = '<div class="tag-explain-title">' + escapeHtml(shown) + '</div>';
      h += '<div class="tag-explain-desc">' + escapeHtml(info.desc) + '</div>';
      if (info.example) h += '<div class="tag-explain-example">例：' + escapeHtml(info.example) + '</div>';
      detailExplain.innerHTML = h;
      detailExplain.hidden = false;
    }

    function syncNoneButton() {
      if (noneBtn) noneBtn.classList.toggle("active", hasNone());
    }

    detailTagGroup.querySelectorAll(".tag-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var tag = btn.getAttribute("data-tag");
        var idx = tagDraft.indexOf(tag);
        if (idx === -1) {
          var noneIdx = tagDraft.indexOf(NONE_OF_ABOVE);
          if (noneIdx !== -1) tagDraft.splice(noneIdx, 1);
          state.detail.noteDraft = "";
          tagDraft.push(tag);
          lastShown = tag;
        } else {
          tagDraft.splice(idx, 1);
          if (lastShown === tag) lastShown = null;
        }
        btn.classList.toggle("active");
        syncNoneButton();
        updateExplain();
        render();
      });
    });

    if (noneBtn) noneBtn.addEventListener("click", function() {
      if (hasNone()) {
        var ni = tagDraft.indexOf(NONE_OF_ABOVE);
        if (ni !== -1) tagDraft.splice(ni, 1);
      } else {
        tagDraft.length = 0;
        tagDraft.push(NONE_OF_ABOVE);
        lastShown = null;
      }
      detailTagGroup.querySelectorAll(".tag-btn").forEach(function(b) { b.classList.remove("active"); });
      syncNoneButton();
      updateExplain();
      render();
    });

    var detailTagClear = document.getElementById("detail-tag-clear");
    if (detailTagClear) detailTagClear.addEventListener("click", function() {
      tagDraft.length = 0;
      state.detail.noteDraft = "";
      lastShown = null;
      detailTagGroup.querySelectorAll(".tag-btn").forEach(function(b) { b.classList.remove("active"); });
      syncNoneButton();
      updateExplain();
      render();
    });

    var noteInput = document.getElementById("detail-distortion-note");
    if (noteInput) {
      noteInput.addEventListener("input", function() {
        state.detail.noteDraft = noteInput.value;
      });
    }

    syncNoneButton();
    updateExplain();
  }

  // ---- Bind: followup ----
  var btnFollowupStart = document.getElementById("btn-followup-start");
  if (btnFollowupStart) btnFollowupStart.addEventListener("click", function() {
    state.detail.showFollowup = true;
    render();
  });

  var btnFollowupCancel = document.getElementById("btn-followup-cancel");
  if (btnFollowupCancel) btnFollowupCancel.addEventListener("click", function() {
    state.detail.showFollowup = false;
    render();
  });

  var btnFollowupSave = document.getElementById("btn-followup-save");
  if (btnFollowupSave) btnFollowupSave.addEventListener("click", function() {
    var val = document.getElementById("followup-input").value.trim();
    if (!val) return;
    var patch = {
      followup_completed: true,
      followup_outcome: val
    };
    if (!e.followup_date) patch.followup_date = Date.now();
    updateEntry(e.id, patch);
    state.detail.showFollowup = false;
    render();
  });
}