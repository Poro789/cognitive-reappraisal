// Basic logic tests for cognitive-reappraisal index.html
// Run with: node test.js
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

// Extract the IIFE script content
const scriptMatch = html.match(/<script>\s*(.*?)\s*<\/script>/s);
if (!scriptMatch) {
  console.error("FAIL: could not extract script");
  process.exit(1);
}

let script = scriptMatch[1];

// Remove the window.__CR_TEST__ exposure for a clean unit test of pure functions
// Instead, we'll eval in a sandbox with stubs.
function makeEl() {
  return {
    style: {},
    innerHTML: "",
    textContent: "",
    value: "",
    disabled: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    focus: () => {},
    select: () => {},
    classList: { toggle: () => {}, add: () => {}, remove: () => {} },
    getAttribute: () => null,
    setAttribute: () => {},
    appendChild: () => {},
    removeChild: () => {},
    remove: () => {},
    querySelectorAll: () => [],
    querySelector: () => null
  };
}

const appEl = makeEl();
const sandbox = {
  window: {},
  document: {
    getElementById: (id) => (id === "app" ? appEl : makeEl()),
    addEventListener: () => {},
    createElement: () => makeEl(),
    body: { appendChild: () => {}, removeChild: () => {}, classList: { toggle: () => {} } },
    querySelectorAll: () => []
  },
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = v; },
    removeItem(k) { delete this._data[k]; }
  },
  navigator: { clipboard: null },
  Date: Date,
  Math: Math,
  JSON: JSON,
  Promise: Promise,
  console: console
};

sandbox.window = sandbox;
sandbox.globalThis = sandbox;

const vm = require("vm");
const context = vm.createContext(sandbox);

try {
  vm.runInContext(script, context);
} catch (e) {
  console.error("FAIL: script threw during load:", e.message);
  process.exit(1);
}

const T = sandbox.window.__CR_TEST__;
if (!T) {
  console.error("FAIL: __CR_TEST__ not exposed");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log("PASS:", msg);
  } else {
    failed++;
    console.error("FAIL:", msg);
  }
}

// 1. formatDate
const ts = new Date(2024, 0, 15, 9, 5).getTime();
assert(T.formatDate(ts) === "2024-01-15 09:05", "formatDate basic");

// 2. truncate
assert(T.truncate("hello world", 5) === "hello…", "truncate shortens");
assert(T.truncate("hi", 5) === "hi", "truncate keeps short");
assert(T.truncate("  a  b  c  ", 10) === "a b c", "truncate normalizes whitespace");

// 3. escapeHtml
assert(T.escapeHtml("<b>&\"</b>") === "&lt;b&gt;&amp;&quot;&lt;/b&gt;", "escapeHtml");
assert(T.escapeHtml("") === "", "escapeHtml empty");

// 4. buildExportText with one entry
const entry = {
  id: "test-1",
  created_at: ts,
  situation: "今天开会时领导没看我",
  automatic_thought: "他一定对我有意见",
  thought_belief_before: 8,
  emotion_label: "焦虑",
  emotion_intensity_before: 7,
  cognitive_distortion: ["读心术"],
  evidence_for: "他今天确实没和我眼神接触",
  evidence_against: "他昨天还夸了我的报告",
  alternative_thought: "他可能只是在想别的事情",
  thought_belief_after: 4,
  emotion_intensity_after: 3,
  followup_completed: false,
  followup_outcome: "",
  followup_date: null
};

T.setEntries([entry]);
let text = T.buildExportText(["test-1"]);

assert(text.includes("请你扮演一个认知重评的审查者"), "export has instruction");
assert(text.includes("记录时间：2024-01-15 09:05"), "export has date");
assert(text.includes("情境：今天开会时领导没看我"), "export has situation");
assert(text.includes("自动想法：他一定对我有意见（当时相信程度 8/10）"), "export has automatic thought");
assert(text.includes("情绪：焦虑，强度 7/10"), "export has emotion");
assert(text.includes("认知扭曲类型：读心术"), "export has distortion");
assert(text.includes("支持这个想法的证据：他今天确实没和我眼神接触"), "export has evidence for");
assert(text.includes("反对这个想法的证据：他昨天还夸了我的报告"), "export has evidence against");
assert(text.includes("替代想法：他可能只是在想别的事情（相信程度 4/10）"), "export has alternative");
assert(text.includes("重新评估后情绪强度：3/10"), "export has after intensity");
assert(text.includes("回填结果：尚未回填"), "export has no followup");
assert(text.includes("---"), "export has separators");

// 5. buildExportText with no distortion
const entry2 = Object.assign({}, entry, { id: "test-2", cognitive_distortion: [] });
T.setEntries([entry2]);
text = T.buildExportText(["test-2"]);
assert(!text.includes("认知扭曲类型："), "export omits empty distortion");

// 6. buildExportText with followup
const entry3 = Object.assign({}, entry, {
  id: "test-3",
  followup_completed: true,
  followup_outcome: "后来发现他那天在赶一个紧急项目",
  followup_date: ts + 86400000
});
T.setEntries([entry3]);
text = T.buildExportText(["test-3"]);
assert(text.includes("回填结果：后来发现他那天在赶一个紧急项目"), "export has followup");
assert(/回填结果：后来发现他那天在赶一个紧急项目（回填时间：\d{4}-\d{2}-\d{2} \d{2}:\d{2}）/.test(text), "export has followup date");

// 7. localStorage persistence
const stored = JSON.parse(sandbox.localStorage.getItem("cognitive-reappraisal-entries"));
assert(Array.isArray(stored) && stored.length === 1 && stored[0].id === "test-3", "localStorage persists entries");

// 8. Multiple entries sorted by created_at in export
const e1 = Object.assign({}, entry, { id: "a", created_at: 1000 });
const e2 = Object.assign({}, entry, { id: "b", created_at: 2000 });
T.setEntries([e2, e1]);
text = T.buildExportText(["a", "b"]);
const idxA = text.indexOf("记录时间：");
const idxB = text.indexOf("记录时间：", idxA + 1);
assert(idxA < idxB, "export sorts entries by created_at");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);