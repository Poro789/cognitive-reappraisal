import { WIZARD_FIELDS, DISTORTIONS, DISTORTION_INFO, NONE_OF_ABOVE } from "../constants.js";
import { escapeHtml, truncate, draftHasContent } from "../utils.js";
import { state, addEntry, saveWizardDraft, clearWizardDraft } from "../state.js";
import { confirmDialog } from "../confirm.js";
import { uid } from "../utils.js";

export function renderWizard(app, render) {
  var w = state.wizard;
  if (!w || !w.draft) {
    state.view = "list";
    render();
    return;
  }
  var total = WIZARD_FIELDS.length + 1; // +1 for review screen
  var step = w.step;
  var draft = w.draft;

  var html = "";
  html += '<div class="wizard">';
  html += '<div class="wizard-top">';
  html += '<span class="wizard-step">第 ' + (step + 1) + ' 步 / 共 ' + total + ' 步</span>';
  html += '</div>';

  if (step < WIZARD_FIELDS.length) {
    var field = WIZARD_FIELDS[step];
    html += '<div class="wizard-field" key="' + field.key + '">';
    html += '<div class="wizard-prompt">' + escapeHtml(field.prompt) + '</div>';
    if (field.hint) html += '<div class="wizard-hint">' + escapeHtml(field.hint) + '</div>';
    if (field.example) html += '<div class="wizard-example">例：' + escapeHtml(field.example) + '</div>';

    if (field.type === "textarea") {
      html += '<textarea class="wizard-input" id="wiz-input" placeholder="在这里写…" aria-label="' + escapeHtml(field.prompt) + '">' + escapeHtml(draft[field.key]) + '</textarea>';
    } else if (field.type === "text") {
      html += '<input type="text" class="wizard-input-line" id="wiz-input" placeholder="在这里写…" value="' + escapeHtml(draft[field.key]) + '" aria-label="' + escapeHtml(field.prompt) + '">';
    } else if (field.type === "slider") {
      var val = draft[field.key];
      html += '<div class="slider-wrap">';
      html += '<div class="slider-value" id="slider-value">' + val + '</div>';
      html += '<div class="slider-track">';
      html += '<input type="range" class="slider" id="wiz-slider" min="1" max="10" step="1" value="' + val + '" aria-label="' + escapeHtml(field.prompt) + '">';
      html += '</div>';
      html += '<div class="slider-labels"><span>1</span><span>10</span></div>';
      html += '</div>';
    } else if (field.type === "tags") {
      html += '<div class="tag-group" id="tag-group">';
      DISTORTIONS.forEach(function(d) {
        var active = draft.cognitive_distortion.indexOf(d) !== -1;
        html += '<button type="button" class="tag-btn' + (active ? " active" : "") + '" data-tag="' + escapeHtml(d) + '">' + escapeHtml(d) + '</button>';
      });
      html += '</div>';
      html += '<div class="tag-explain" id="tag-explain" hidden></div>';
      var noneActive = draft.cognitive_distortion.indexOf(NONE_OF_ABOVE) !== -1;
      html += '<div class="tag-alt-actions">';
      html += '<button type="button" class="tag-alt-btn' + (noneActive ? " active" : "") + '" id="btn-none-above">以上都不像</button>';
      html += '<button type="button" class="skip-link" id="btn-skip-tag">跳过，不确定</button>';
      html += '</div>';
      if (noneActive) {
        html += '<div class="distortion-note-wrap">';
        html += '<input type="text" class="distortion-note" id="wiz-distortion-note" maxlength="60" placeholder="（可选）用你自己的话描述一下" value="' + escapeHtml(draft.distortion_note || "") + '" aria-label="认知扭曲补充描述">';
        html += '<div class="distortion-note-hint">例：我觉得运气对我特别差 / 事情应该更公平</div>';
        html += '</div>';
      }
    }

    html += '</div>';
  } else {
    // Review screen
    var before = draft.emotion_intensity_before;
    var after = draft.emotion_intensity_after;
    html += '<div class="wizard-field">';
    html += '<div class="wizard-prompt">这次练习带来的变化</div>';
    html += '<div class="review-compare">';
    html += '<div class="review-num"><div class="val">' + before + '</div><div class="label">之前</div></div>';
    html += '<div class="review-arrow">→</div>';
    html += '<div class="review-num"><div class="val">' + after + '</div><div class="label">之后</div></div>';
    html += '</div>';
    html += '<div class="review-summary">';
    html += '<strong>情境：</strong>' + escapeHtml(truncate(draft.situation, 50)) + '<br>';
    html += '<strong>自动想法：</strong>' + escapeHtml(truncate(draft.automatic_thought, 50)) + '<br>';
    html += '<strong>替代想法：</strong>' + escapeHtml(truncate(draft.alternative_thought, 50));
    html += '</div>';
    html += '<div class="review-next">';
    html += '<div class="review-next-title">接下来</div>';
    html += '<ul class="review-next-list">';
    html += '<li><strong>过几天回来回填。</strong>等这件事有了下文（比如对方回了消息、会议结束了），花一分钟记下实际发生了什么、哪个想法更接近事实。不用急，几天到一两周都行，不填也没关系。</li>';
    html += '<li><strong>想听听外部视角时，可以导出给 AI 审查。</strong>在列表里点\u201c选择记录\u201d，勾选这条，点\u201c导出\u201d，把文字发给 AI，让它诚实地帮你看看替代想法是不是站得住脚。</li>';
    html += '</ul>';
    html += '</div>';
    html += '</div>';
  }

  html += '</div>';

  // Bottom nav
  html += '<div class="wizard-nav">';
  if (step < WIZARD_FIELDS.length) {
    html += '<button class="btn btn-ghost" id="btn-wiz-prev">' + (step === 0 ? "取消" : "上一步") + '</button>';
    html += '<button class="btn btn-primary" id="btn-wiz-next">下一步</button>';
  } else {
    html += '<button class="btn btn-ghost" id="btn-wiz-prev">返回修改</button>';
    html += '<button class="btn btn-primary" id="btn-wiz-save">保存</button>';
  }
  html += '</div>';

  app.innerHTML = html;

  // Bind events
  var btnPrev = document.getElementById("btn-wiz-prev");
  if (btnPrev) btnPrev.addEventListener("click", function() {
    if (step === 0) {
      if (draftHasContent(w.draft)) {
        confirmDialog("放弃这条记录？", "你填写的内容还没有保存，离开后就不会保留了。", "放弃").then(function(ok) {
          if (!ok) return;
          clearWizardDraft();
          state.view = "list";
          state.wizard = null;
          render();
        });
      } else {
        clearWizardDraft();
        state.view = "list";
        state.wizard = null;
        render();
      }
    } else {
      saveCurrentField();
      w.step--;
      saveWizardDraft();
      render();
    }
  });

  var btnNext = document.getElementById("btn-wiz-next");
  if (btnNext) btnNext.addEventListener("click", function() {
    saveCurrentField();
    w.step++;
    saveWizardDraft();
    render();
  });

  var btnSave = document.getElementById("btn-wiz-save");
  if (btnSave) btnSave.addEventListener("click", function() { saveWizard(render); });

  // Input bindings
  var input = document.getElementById("wiz-input");
  if (input) {
    input.addEventListener("input", function() {
      var field = WIZARD_FIELDS[step];
      draft[field.key] = input.value;
      saveWizardDraft();
    });
    setTimeout(function() { input.focus(); }, 50);
  }

  var slider = document.getElementById("wiz-slider");
  if (slider) {
    slider.addEventListener("input", function() {
      var field = WIZARD_FIELDS[step];
      draft[field.key] = parseInt(slider.value, 10);
      document.getElementById("slider-value").textContent = slider.value;
      saveWizardDraft();
    });
  }

  // Tags
  var tagGroup = document.getElementById("tag-group");
  if (tagGroup) {
    var tagExplain = document.getElementById("tag-explain");
    var noneBtn = document.getElementById("btn-none-above");
    var lastShownTag = null;

    function hasNone() { return draft.cognitive_distortion.indexOf(NONE_OF_ABOVE) !== -1; }

    function updateTagExplain() {
      if (!tagExplain) return;
      if (hasNone()) {
        tagExplain.innerHTML =
          '<div class="tag-explain-title">' + escapeHtml(NONE_OF_ABOVE) + '</div>' +
          '<div class="tag-explain-desc">你觉得这个想法不属于上面任何一种常见扭曲。这本身是个有用的判断——导出时会让审查者知道这一点。</div>';
        tagExplain.hidden = false;
        return;
      }
      var shown = null;
      if (lastShownTag && draft.cognitive_distortion.indexOf(lastShownTag) !== -1) {
        shown = lastShownTag;
      } else if (draft.cognitive_distortion.length > 0) {
        shown = draft.cognitive_distortion[draft.cognitive_distortion.length - 1];
      }
      if (!shown) {
        tagExplain.hidden = true;
        tagExplain.innerHTML = "";
        return;
      }
      var info = DISTORTION_INFO[shown];
      if (!info) {
        tagExplain.hidden = true;
        return;
      }
      var h = '<div class="tag-explain-title">' + escapeHtml(shown) + '</div>';
      h += '<div class="tag-explain-desc">' + escapeHtml(info.desc) + '</div>';
      if (info.example) h += '<div class="tag-explain-example">例：' + escapeHtml(info.example) + '</div>';
      tagExplain.innerHTML = h;
      tagExplain.hidden = false;
    }

    function syncNoneButton() {
      if (noneBtn) noneBtn.classList.toggle("active", hasNone());
    }

    if (draft.cognitive_distortion.length > 0 && !hasNone()) {
      lastShownTag = draft.cognitive_distortion[draft.cognitive_distortion.length - 1];
    }

    var tagBtns = tagGroup.querySelectorAll(".tag-btn");
    tagBtns.forEach(function(btn) {
      btn.addEventListener("click", function() {
        var tag = btn.getAttribute("data-tag");
        var idx = draft.cognitive_distortion.indexOf(tag);
        if (idx === -1) {
          draft.cognitive_distortion = draft.cognitive_distortion.filter(function(t) { return t !== NONE_OF_ABOVE; });
          draft.distortion_note = "";
          draft.cognitive_distortion.push(tag);
          lastShownTag = tag;
        } else {
          draft.cognitive_distortion.splice(idx, 1);
          if (lastShownTag === tag) lastShownTag = null;
        }
        btn.classList.toggle("active");
        syncNoneButton();
        updateTagExplain();
        saveWizardDraft();
        render();
      });
    });

    if (noneBtn) noneBtn.addEventListener("click", function() {
      if (hasNone()) {
        draft.cognitive_distortion = draft.cognitive_distortion.filter(function(t) { return t !== NONE_OF_ABOVE; });
      } else {
        draft.cognitive_distortion = [NONE_OF_ABOVE];
        lastShownTag = null;
      }
      tagGroup.querySelectorAll(".tag-btn").forEach(function(b) { b.classList.remove("active"); });
      syncNoneButton();
      updateTagExplain();
      saveWizardDraft();
      render();
    });

    var noteInput = document.getElementById("wiz-distortion-note");
    if (noteInput) {
      noteInput.addEventListener("input", function() {
        draft.distortion_note = noteInput.value;
        saveWizardDraft();
      });
    }

    syncNoneButton();
    updateTagExplain();
  }

  var btnSkip = document.getElementById("btn-skip-tag");
  if (btnSkip) btnSkip.addEventListener("click", function() {
    draft.cognitive_distortion = [];
    draft.distortion_note = "";
    w.step++;
    saveWizardDraft();
    render();
  });
}

function saveCurrentField() {
  var w = state.wizard;
  if (!w || !w.draft || w.step >= WIZARD_FIELDS.length) return;
  var field = WIZARD_FIELDS[w.step];
  var el = document.getElementById("wiz-input") || document.getElementById("wiz-slider");
  if (!el) return;
  if (field.type === "slider") {
    var v = parseInt(el.value, 10);
    if (v !== w.draft[field.key]) w.draft[field.key] = v;
  } else {
    if (el.value !== w.draft[field.key]) w.draft[field.key] = el.value;
  }
}

function saveWizard(render) {
  var w = state.wizard;
  if (!w || !w.draft) return;
  var draft = w.draft;
  var now = Date.now();

  var entry = {
    id: uid(),
    created_at: now,
    situation: draft.situation,
    automatic_thought: draft.automatic_thought,
    thought_belief_before: draft.thought_belief_before,
    emotion_label: draft.emotion_label,
    emotion_intensity_before: draft.emotion_intensity_before,
    cognitive_distortion: draft.cognitive_distortion,
    distortion_note: draft.distortion_note || "",
    evidence_for: draft.evidence_for,
    evidence_against: draft.evidence_against,
    alternative_thought: draft.alternative_thought,
    thought_belief_after: draft.thought_belief_after,
    emotion_intensity_after: draft.emotion_intensity_after,
    followup_completed: false,
    followup_outcome: "",
    followup_date: null
  };
  addEntry(entry);
  clearWizardDraft();
  state.view = "list";
  state.wizard = null;
  render();
}