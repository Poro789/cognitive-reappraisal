import { escapeHtml } from "../utils.js";
import { state } from "../state.js";

// Lightweight review view: shows aggregate stats and a simple intensity
// trend. No charts, no gamification — just facts, consistent with the
// project's pressure-free design.
export function renderReview(app, render) {
  var entries = state.entries;
  var total = entries.length;

  var html = "";
  html += '<header class="app-header">';
  html += '<button class="btn btn-text" id="btn-review-back">← 返回</button>';
  html += '<h1 class="app-title">回顾</h1>';
  html += '</header>';

  if (total === 0) {
    html += '<div class="empty-state">';
    html += '<h2>还没有记录</h2>';
    html += '<p>记录一些思维记录后，这里会显示你的练习概况。</p>';
    html += '</div>';
  } else {
    // Stats
    var completed = entries.filter(function(e) { return e.followup_completed; }).length;
    var pending = total - completed;
    var avgBefore = 0, avgAfter = 0;
    entries.forEach(function(e) {
      avgBefore += e.emotion_intensity_before;
      avgAfter += e.emotion_intensity_after;
    });
    avgBefore = (avgBefore / total).toFixed(1);
    avgAfter = (avgAfter / total).toFixed(1);
    var avgChange = (avgAfter - avgBefore).toFixed(1);

    html += '<div class="review-stats">';
    html += '<div class="review-stat">';
    html += '<div class="review-stat-val">' + total + '</div>';
    html += '<div class="review-stat-label">总记录</div>';
    html += '</div>';
    html += '<div class="review-stat">';
    html += '<div class="review-stat-val">' + completed + '</div>';
    html += '<div class="review-stat-label">已回填</div>';
    html += '</div>';
    html += '<div class="review-stat">';
    html += '<div class="review-stat-val">' + pending + '</div>';
    html += '<div class="review-stat-label">待回填</div>';
    html += '</div>';
    html += '<div class="review-stat">';
    html += '<div class="review-stat-val">' + avgBefore + ' → ' + avgAfter + '</div>';
    html += '<div class="review-stat-label">平均强度变化</div>';
    html += '</div>';
    html += '</div>';

    // Intensity trend (last 14 entries, oldest first)
    var recent = entries.slice().sort(function(a, b) { return a.created_at - b.created_at; }).slice(-14);
    if (recent.length >= 2) {
      html += '<div class="review-trend">';
      html += '<div class="review-trend-title">情绪强度趋势（最近 ' + recent.length + ' 条）</div>';
      html += '<div class="trend-chart">';
      var maxVal = 10;
      recent.forEach(function(e, i) {
        var beforeH = (e.emotion_intensity_before / maxVal) * 100;
        var afterH = (e.emotion_intensity_after / maxVal) * 100;
        html += '<div class="trend-col" title="之前 ' + e.emotion_intensity_before + ' → 之后 ' + e.emotion_intensity_after + '">';
        html += '<div class="trend-bars">';
        html += '<div class="trend-bar before" style="height:' + beforeH + '%"></div>';
        html += '<div class="trend-bar after" style="height:' + afterH + '%"></div>';
        html += '</div>';
        html += '<div class="trend-num">' + (i + 1) + '</div>';
        html += '</div>';
      });
      html += '</div>';
      html += '<div class="trend-legend"><span class="legend-before">之前</span><span class="legend-after">之后</span></div>';
      html += '</div>';
    }

    // Followup prompt for pending entries
    if (pending > 0) {
      html += '<div class="review-pending">';
      html += '<div class="review-pending-title">待回填的记录</div>';
      var pendingEntries = entries.filter(function(e) { return !e.followup_completed; })
        .sort(function(a, b) { return a.created_at - b.created_at; });
      pendingEntries.slice(0, 5).forEach(function(e) {
        html += '<div class="pending-item" data-id="' + e.id + '" role="button" tabindex="0">';
        html += '<span class="pending-situation">' + escapeHtml(e.situation || "（未填写情境）").slice(0, 40) + '</span>';
        html += '<span class="pending-date">' + new Date(e.created_at).toLocaleDateString("zh-CN") + '</span>';
        html += '</div>';
      });
      if (pendingEntries.length > 5) {
        html += '<div class="pending-more">还有 ' + (pendingEntries.length - 5) + ' 条…</div>';
      }
      html += '</div>';
    }
  }

  app.innerHTML = html;

  document.getElementById("btn-review-back").addEventListener("click", function() {
    state.view = "list";
    render();
  });

  // Tap a pending item to open its detail
  var pendingItems = app.querySelectorAll(".pending-item");
  pendingItems.forEach(function(el) {
    function open() {
      state.detail = { id: el.getAttribute("data-id"), showFollowup: true, editingField: null, tagDraft: null, noteDraft: null };
      state.view = "detail";
      render();
    }
    el.addEventListener("click", open);
    el.addEventListener("keydown", function(ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(); }
    });
  });
}