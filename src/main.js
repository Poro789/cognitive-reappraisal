import { WIZARD_FIELDS, DISTORTIONS, DISTORTION_INFO, NONE_OF_ABOVE } from "./constants.js";
import { formatDate, truncate, escapeHtml, draftHasContent, uid } from "./utils.js";
import { buildExportText, copyToClipboard } from "./export.js";
import { state, rebuildEntryMap, loadEntries, saveEntries, getEntry, deleteEntry } from "./state.js";
import "./styles.css";
  // ---------- Render ----------
  var app = document.getElementById("app");

  function render() {
    document.body.classList.toggle("selecting", state.selecting);
    if (state.view === "list") renderList();
    else if (state.view === "wizard") renderWizard();
    else if (state.view === "detail") renderDetail();

    if (state.exportModal) renderExportModal();
  }

  // ---------- List View ----------
  function renderList() {
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
      // 选择记录 only makes sense when there is something to select
      if (entries.length > 0) html += '<button class="btn btn-ghost" id="btn-select-mode">选择记录</button>';
      else html += '<span class="count"></span>';
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
      // Stable numbering: #1 is the most recent (top of the list)
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

    app.innerHTML = html;

    // Bind events
    var btnNew = document.getElementById("btn-new");
    if (btnNew) btnNew.addEventListener("click", function() { startWizard(null); });

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

    var btnExport = document.getElementById("btn-export");
    if (btnExport) btnExport.addEventListener("click", function() {
      var ids = Object.keys(state.selected);
      if (ids.length === 0) return;
      state.exportModal = true;
      render();
    });

    // Entry cards + checkboxes: use event delegation on `app` (bound once at
    // init) instead of re-binding every card on each render.
  }

  function toggleSelect(id) {
    if (state.selected[id]) delete state.selected[id];
    else state.selected[id] = true;
    render();
  }

  // ---------- Confirm dialog (Promise-based) ----------
  function confirmDialog(title, message, confirmLabel) {
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
      overlay.querySelector('[data-act="cancel"]').addEventListener("click", function() { done(false); });
      overlay.querySelector('[data-act="ok"]').addEventListener("click", function() { done(true); });
      overlay.addEventListener("click", function(ev) { if (ev.target === overlay) done(false); });
      document.addEventListener("keydown", onKey);
      setTimeout(function() { overlay.querySelector('[data-act="ok"]').focus(); }, 30);
    });
  }

  // ---------- Wizard ----------
  function startWizard() {
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
    state.wizard = { draft: draft, step: 0, editingId: null };
    state.view = "wizard";
    render();
  }

  function renderWizard() {
    var w = state.wizard;
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
        // Two distinct "no specific type" actions:
        //  - 以上都不像: a meaningful negative signal (judged not a common distortion)
        //  - 跳过: leave blank, no signal
        var noneActive = draft.cognitive_distortion.indexOf(NONE_OF_ABOVE) !== -1;
        html += '<div class="tag-alt-actions">';
        html += '<button type="button" class="tag-alt-btn' + (noneActive ? " active" : "") + '" id="btn-none-above">以上都不像</button>';
        html += '<button type="button" class="skip-link" id="btn-skip-tag">跳过，不确定</button>';
        html += '</div>';
        // Optional free-text note, only relevant when "以上都不像" is chosen
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
        // Leaving from the first step discards the whole draft — confirm if anything was written
        if (draftHasContent(w.draft)) {
          confirmDialog("放弃这条记录？", "你填写的内容还没有保存，离开后就不会保留了。", "放弃").then(function(ok) {
            if (!ok) return;
            state.view = "list";
            state.wizard = null;
            render();
          });
        } else {
          state.view = "list";
          state.wizard = null;
          render();
        }
      } else {
        saveCurrentField();
        w.step--;
        render();
      }
    });

    var btnNext = document.getElementById("btn-wiz-next");
    if (btnNext) btnNext.addEventListener("click", function() {
      saveCurrentField();
      w.step++;
      render();
    });

    var btnSave = document.getElementById("btn-wiz-save");
    if (btnSave) btnSave.addEventListener("click", saveWizard);

    // Input bindings
    var input = document.getElementById("wiz-input");
    if (input) {
      input.addEventListener("input", function() {
        var field = WIZARD_FIELDS[step];
        draft[field.key] = input.value;
      });
      // Focus
      setTimeout(function() { input.focus(); }, 50);
    }

    var slider = document.getElementById("wiz-slider");
    if (slider) {
      slider.addEventListener("input", function() {
        var field = WIZARD_FIELDS[step];
        draft[field.key] = parseInt(slider.value, 10);
        document.getElementById("slider-value").textContent = slider.value;
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
        // "以上都不像" has its own fixed explanation
        if (hasNone()) {
          tagExplain.innerHTML =
            '<div class="tag-explain-title">' + escapeHtml(NONE_OF_ABOVE) + '</div>' +
            '<div class="tag-explain-desc">你觉得这个想法不属于上面任何一种常见扭曲。这本身是个有用的判断——导出时会让审查者知道这一点。</div>';
          tagExplain.hidden = false;
          return;
        }
        // Otherwise show info for the most recently selected specific tag
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

      // Keep specific tags and "以上都不像" mutually exclusive
      function syncNoneButton() {
        if (noneBtn) noneBtn.classList.toggle("active", hasNone());
      }

      // If resuming with tags already selected, show the last specific one
      if (draft.cognitive_distortion.length > 0 && !hasNone()) {
        lastShownTag = draft.cognitive_distortion[draft.cognitive_distortion.length - 1];
      }

      var tagBtns = tagGroup.querySelectorAll(".tag-btn");
      tagBtns.forEach(function(btn) {
        btn.addEventListener("click", function() {
          var tag = btn.getAttribute("data-tag");
          var idx = draft.cognitive_distortion.indexOf(tag);
          if (idx === -1) {
            // Selecting a specific type clears "以上都不像" and its note
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
          render(); // note input appears/disappears with the selection
        });
      });

      if (noneBtn) noneBtn.addEventListener("click", function() {
        if (hasNone()) {
          // Toggle off
          draft.cognitive_distortion = draft.cognitive_distortion.filter(function(t) { return t !== NONE_OF_ABOVE; });
        } else {
          // Selecting "以上都不像" clears all specific tags
          draft.cognitive_distortion = [NONE_OF_ABOVE];
          lastShownTag = null;
        }
        tagGroup.querySelectorAll(".tag-btn").forEach(function(b) { b.classList.remove("active"); });
        syncNoneButton();
        updateTagExplain();
        // Re-render so the optional note input appears/disappears with the selection
        render();
      });

      // Optional note input (only present when "以上都不像" is active)
      var noteInput = document.getElementById("wiz-distortion-note");
      if (noteInput) {
        noteInput.addEventListener("input", function() {
          draft.distortion_note = noteInput.value;
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
      render();
    });
  }

  function saveCurrentField() {
    // Values are normally saved on input events. This is a fallback safeguard:
    // if the current step has a DOM input whose value differs from the draft
    // (e.g. a browser that didn't fire input on paste), sync it now.
    var w = state.wizard;
    if (!w || w.step >= WIZARD_FIELDS.length) return;
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

  function saveWizard() {
    var w = state.wizard;
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
    state.entries.push(entry);
    state.entryMap[entry.id] = entry;

    saveEntries();
    state.view = "list";
    state.wizard = null;
    render();
  }

  // ---------- Detail View ----------
  function openDetail(id) {
    state.detail = { id: id, showFollowup: false, editingField: null, tagDraft: null, noteDraft: null };
    state.view = "detail";
    render();
  }

  function renderDetail() {
    var e = getEntry(state.detail.id);
    if (!e) {
      state.view = "list";
      render();
      return;
    }
    var editing = state.detail.editingField; // null | field key

    var html = "";
    html += '<header class="app-header">';
    html += '<button class="btn btn-text" id="btn-detail-back">← 返回</button>';
    html += '<h1 class="app-title">记录详情</h1>';
    html += '<button class="btn-delete" id="btn-detail-delete" aria-label="删除这条记录">删除</button>';
    html += '</header>';

    html += '<div class="detail">';

    // A read-only info line (not editable)
    function infoSection(label, value) {
      html += '<div class="detail-section">';
      html += '<div class="detail-label">' + label + '</div>';
      html += '<div class="detail-value">' + escapeHtml(value) + '</div>';
      html += '</div>';
    }

    // An editable text field. When editing === key, show an input; otherwise a tappable value.
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

    // An editable slider field.
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

    // Cognitive distortion: editable tag set (edits go to a draft so 取消 can revert)
    var tagDraft = state.detail.tagDraft; // array while editing, null otherwise
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

    // Followup (its own inline editor; a completed followup can be re-tapped to edit)
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
        // Followup uses its own editor box, not the generic field-edit flow
        if (key === "followup") {
          state.detail.showFollowup = true;
          render();
          return;
        }
        state.detail.editingField = key;
        // For tags, copy current value into a draft so 取消 can revert
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
          e.cognitive_distortion = state.detail.tagDraft.slice();
          e.distortion_note = state.detail.noteDraft || "";
          saveEntries();
        } else {
          var input = document.getElementById("edit-input") || document.getElementById("edit-slider");
          if (input) {
            e[key] = (input.type === "range") ? parseInt(input.value, 10) : input.value;
            saveEntries();
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

    // Distortion tags in detail (mutate the draft + explanation)
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
            // Selecting a specific type clears "以上都不像" and its note
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
          render(); // note input appears/disappears with the selection
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

      // Optional note input (only present when "以上都不像" is active)
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
      e.followup_completed = true;
      e.followup_outcome = val;
      // Keep the original date when re-editing; only stamp on first completion
      if (!e.followup_date) e.followup_date = Date.now();
      saveEntries();
      state.detail.showFollowup = false;
      render();
    });
  }

  // ---------- Export Modal ----------
  function renderExportModal() {
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
        // Last resort: select the textarea so the user can copy manually
        var ta = document.getElementById("export-text");
        ta.focus();
        ta.select();
        btn.textContent = "请手动复制 (Ctrl+C)";
        setTimeout(function() { btn.textContent = "复制到剪贴板"; }, 3000);
      });
    });

    // Focus
    setTimeout(function() {
      document.getElementById("btn-modal-close").focus();
    }, 50);
  }

  function closeExportModal() {
    state.exportModal = false;
    var modal = document.getElementById("export-modal");
    if (modal) modal.remove();
  }

  // Escape key closes modal
  document.addEventListener("keydown", function(ev) {
    if (ev.key === "Escape" && state.exportModal) {
      closeExportModal();
    }
  });

  // ---------- Init ----------
  state.entries = loadEntries();
  rebuildEntryMap();

  // Event delegation for list-view cards & checkboxes (bound once).
  // `app` is the single container that gets innerHTML-swapped on each render,
  // so a listener on `app` survives re-renders without re-binding.
  app.addEventListener("click", function(ev) {
    // Checkbox click (selection mode): stopPropagation so the card handler
    // below doesn't also fire.
    var cb = ev.target.closest(".checkbox");
    if (cb) {
      ev.stopPropagation();
      toggleSelect(cb.getAttribute("data-id"));
      return;
    }
    // Card click
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

  render();

  // Expose for automated testing (harmless in production)
  window.__CR_TEST__ = {
    getState: function() { return state; },
    setEntries: function(entries) { state.entries = entries; rebuildEntryMap(); saveEntries(); render(); },
    buildExportText: buildExportText,
    formatDate: formatDate,
    truncate: truncate,
    escapeHtml: escapeHtml,
    draftHasContent: draftHasContent,
    uid: uid
  };



