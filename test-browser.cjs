// Browser smoke test using headless Chrome + CDP over WebSocket
const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

// Chrome path: override with CHROME_PATH env var or first CLI arg.
// Defaults to common Windows / macOS / Linux locations.
function resolveChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const arg = process.argv[2];
  if (arg && !arg.startsWith("-")) return arg;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium"
  ];
  for (const c of candidates) {
    try { fs.accessSync(c); return c; } catch (e) { /* not found */ }
  }
  console.error("FAIL: Chrome not found. Set CHROME_PATH env var or pass path as first arg.");
  process.exit(1);
}
const CHROME = resolveChromePath();
// Serve the built artifact (dist/) over a local HTTP server. ES modules are
// blocked under file:// by CORS, so we need http:// for the E2E run.
const distDir = path.join(__dirname, "dist");
if (!fs.existsSync(path.join(distDir, "index.html"))) {
  console.error("FAIL: dist/index.html not found. Run `npm run build` before `npm run test:e2e`.");
  process.exit(1);
}

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png"
};
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
      const filePath = path.join(distDir, urlPath);
      // Prevent path traversal
      if (!filePath.startsWith(distDir)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end("Not found"); return; }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

// Minimal WebSocket client (Node 22+ has global WebSocket)
function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(new Error("WebSocket error: " + (e.message || "unknown")));
  });
}

function sendMsg(ws, id, method, params) {
  ws.send(JSON.stringify({ id, method, params: params || {} }));
}

function waitForEvent(ws, eventName, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout waiting for " + eventName)), timeoutMs || 10000);
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === eventName) {
        clearTimeout(timer);
        ws.removeEventListener("message", handler);
        resolve(msg.params);
      }
    };
    ws.addEventListener("message", handler);
  });
}

function evaluate(ws, id, expression) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout evaluating expression")), 15000);
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        clearTimeout(timer);
        ws.removeEventListener("message", handler);
        if (msg.error) reject(new Error("Eval error: " + JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener("message", handler);
    sendMsg(ws, id, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  });
}

// Launch Chrome once and return { chrome, ws }. Reused across all viewports.
async function launchChrome() {
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=9222",
    "about:blank"
  ], { stdio: "ignore" });

  let target;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await new Promise((resolve, reject) => {
        http.get("http://127.0.0.1:9222/json", (r) => {
          let data = "";
          r.on("data", c => data += c);
          r.on("end", () => resolve(JSON.parse(data)));
        }).on("error", reject);
      });
      target = res.find(t => t.type === "page");
      if (target) break;
    } catch (e) { /* retry */ }
  }

  if (!target) {
    console.error("FAIL: could not connect to Chrome DevTools");
    chrome.kill();
    process.exit(1);
  }

  const ws = await connectWebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen && r());

  // Enable Runtime and capture console (once for the whole session)
  sendMsg(ws, 1, "Runtime.enable");
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Runtime.consoleAPICalled") {
      const args = msg.params.args.map(a => a.value !== undefined ? a.value : a.description);
      console.log("[browser]", ...args);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      console.log("[browser-exception]", JSON.stringify(msg.params.exceptionDetails, null, 2));
    }
  });
  await new Promise(r => setTimeout(r, 200));

  return { chrome, ws };
}

async function runAtSize(width, height, ws, pageUrl) {
  // Force exact viewport
  sendMsg(ws, 0, "Emulation.setDeviceMetricsOverride", {
    width: width, height: height, deviceScaleFactor: 2, mobile: width < 768
  });

  // Navigate to the app. For the first viewport the profile is fresh (no
  // localStorage). For subsequent viewports we clear localStorage from
  // within the page origin.
  sendMsg(ws, 2, "Page.navigate", { url: pageUrl });
  await new Promise(r => setTimeout(r, 1000));
  // Clear any leftover data from a previous viewport run
  await evaluate(ws, 3, "localStorage.clear()");
  sendMsg(ws, 4, "Page.navigate", { url: pageUrl });
  await new Promise(r => setTimeout(r, 1000));

  const testScript = `
    (async () => {
      const results = [];
      function assert(cond, msg) { results.push({ pass: !!cond, msg }); }

      await new Promise(r => setTimeout(r, 300));
      const app = document.getElementById("app");
      assert(app && app.innerHTML.length > 0, "app rendered");
      assert(app.innerHTML.includes("还没有记录"), "empty state shown");

      click("btn-new");
      await wait(300);

      assert(document.getElementById("wiz-input"), "wizard input exists");
      const stepEl = document.querySelector(".wizard-step");
      assert(stepEl && stepEl.textContent.includes("第 1 步"), "wizard step 1");

      function setInput(id, val) {
        const el = document.getElementById(id);
        if (!el) throw new Error("missing " + id);
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      function next() { click("btn-wiz-next"); }
      function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
      function click(id) {
        const el = document.getElementById(id);
        if (!el) throw new Error("missing " + id);
        el.click();
      }

      setInput("wiz-input", "今天开会时领导没看我");
      next();
      await wait(150);
      const stepEl2 = document.querySelector(".wizard-step");
      assert(stepEl2 && stepEl2.textContent.includes("第 2 步"), "wizard step 2");

      setInput("wiz-input", "他一定对我有意见");
      next();
      await wait(150);

      const slider = document.getElementById("wiz-slider");
      assert(slider, "slider exists");
      slider.value = "8";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      const sv = document.getElementById("slider-value");
      assert(sv && sv.textContent === "8", "slider value updated");
      next();
      await wait(150);

      setInput("wiz-input", "焦虑");
      next();
      await wait(150);

      const slider2 = document.getElementById("wiz-slider");
      slider2.value = "7";
      slider2.dispatchEvent(new Event("input", { bubbles: true }));
      next();
      await wait(150);

      // Tag explanation panel: select a tag, verify explanation appears
      const tagBtn = document.querySelector('.tag-btn[data-tag="读心术"]');
      assert(tagBtn, "distortion tag button exists");
      tagBtn.click();
      await wait(100);
      const explain = document.getElementById("tag-explain");
      assert(explain && !explain.hidden, "tag explanation panel visible after selecting tag");
      assert(explain && explain.textContent.includes("读心术"), "explanation shows tag name");
      assert(explain && explain.textContent.includes("在没有证据的情况下"), "explanation shows description");
      assert(explain && explain.textContent.includes("他没回我消息"), "explanation shows example");
      // Deselect: panel should hide (re-query: the step re-renders on tag change)
      tagBtn.click();
      await wait(100);
      const explain2 = document.getElementById("tag-explain");
      assert(explain2 && explain2.hidden, "tag explanation panel hidden after deselecting");

      // "以上都不像" flow: select it, note input appears, type a note, then clear via skip
      const noneBtn = document.getElementById("btn-none-above");
      assert(noneBtn, "以上都不像 button exists");
      noneBtn.click();
      await wait(150);
      const noteInput = document.getElementById("wiz-distortion-note");
      assert(noteInput, "optional note input appears when 以上都不像 selected");
      noteInput.value = "我觉得运气对我特别差";
      noteInput.dispatchEvent(new Event("input", { bubbles: true }));
      // Selecting a specific tag should clear "以上都不像" and the note
      tagBtn.click();
      await wait(150);
      assert(document.getElementById("wiz-distortion-note") === null, "note input hidden after picking a specific tag");
      // Now clear everything via skip
      tagBtn.click();
      await wait(100);
      click("btn-skip-tag");
      await wait(150);

      // Field examples: verify the evidence-for step shows an example line
      const exEl = document.querySelector(".wizard-example");
      assert(exEl && exEl.textContent.includes("例："), "field example shown in wizard");

      setInput("wiz-input", "他今天确实没和我眼神接触");
      next();
      await wait(150);

      setInput("wiz-input", "他昨天还夸了我的报告");
      next();
      await wait(150);

      setInput("wiz-input", "他可能只是在想别的事情");
      next();
      await wait(150);

      const slider3 = document.getElementById("wiz-slider");
      slider3.value = "4";
      slider3.dispatchEvent(new Event("input", { bubbles: true }));
      next();
      await wait(150);

      const slider4 = document.getElementById("wiz-slider");
      slider4.value = "3";
      slider4.dispatchEvent(new Event("input", { bubbles: true }));
      next();
      await wait(150);

      const review = document.querySelector(".review-compare");
      assert(review, "review screen shown");
      assert(review && review.textContent.includes("7"), "review shows before 7");
      assert(review && review.textContent.includes("3"), "review shows after 3");

      // Completion screen "接下来" guidance
      const nextSec = document.querySelector(".review-next");
      assert(nextSec, "completion screen shows 接下来 section");
      assert(nextSec && nextSec.textContent.includes("回填"), "guidance mentions followup");
      assert(nextSec && nextSec.textContent.includes("导出"), "guidance mentions export for review");

      click("btn-wiz-save");
      await wait(150);

      const cards = document.querySelectorAll(".entry-card");
      assert(cards.length === 1, "one entry in list");
      assert(cards[0] && cards[0].textContent.includes("今天开会时领导没看我"), "entry shows situation");
      assert(cards[0] && cards[0].textContent.includes("7→3"), "entry shows intensity change");
      assert(cards[0] && cards[0].textContent.includes("待回填"), "entry shows pending followup");
      assert(cards[0] && cards[0].querySelector(".entry-num") && cards[0].querySelector(".entry-num").textContent === "#1", "entry shows number #1");
      assert(cards[0] && cards[0].querySelector(".entry-date"), "entry shows creation date");
      assert(document.querySelector(".checkbox") === null, "no checkbox visible outside selection mode");

      // Header layout: 选择记录 and 新建 both on the toolbar row
      assert(document.getElementById("btn-select-mode"), "select-mode button present");
      assert(document.getElementById("btn-new"), "new button present");

      const stored = JSON.parse(localStorage.getItem("cognitive-reappraisal-entries"));
      assert(stored && stored.length === 1, "localStorage has entry");
      assert(stored && stored[0] && stored[0].situation === "今天开会时领导没看我", "localStorage situation correct");

      cards[0].click();
      await wait(150);
      assert(document.getElementById("btn-detail-back"), "detail view shown");
      assert(document.body.textContent.includes("他一定对我有意见"), "detail shows automatic thought");

      // Direct inline edit: tap the 自动想法 field, change it, save
      const autoField = document.querySelector('.detail-editable[data-field="automatic_thought"]');
      assert(autoField, "automatic thought field is editable in detail");
      autoField.click();
      await wait(150);
      const editInput = document.getElementById("edit-input");
      assert(editInput, "inline edit input appears");
      editInput.value = "他一定对我有意见（修改版）";
      editInput.dispatchEvent(new Event("input", { bubbles: true }));
      click("edit-save");
      await wait(150);
      assert(document.body.textContent.includes("他一定对我有意见（修改版）"), "inline edit saved");
      const storedAfterEdit = JSON.parse(localStorage.getItem("cognitive-reappraisal-entries"));
      assert(storedAfterEdit[0].automatic_thought === "他一定对我有意见（修改版）", "inline edit persisted to localStorage");

      // Detail: edit cognitive distortion -> 以上都不像 + note, save, verify persisted
      const distField = document.querySelector('.detail-editable[data-field="cognitive_distortion"]');
      assert(distField, "cognitive distortion field editable in detail");
      distField.click();
      await wait(150);
      const dNone = document.getElementById("detail-none-above");
      assert(dNone, "以上都不像 button in detail tag editor");
      dNone.click();
      await wait(150);
      const dNote = document.getElementById("detail-distortion-note");
      assert(dNote, "note input appears in detail when 以上都不像 selected");
      dNote.value = "我觉得事情应该更公平";
      dNote.dispatchEvent(new Event("input", { bubbles: true }));
      click("edit-save");
      await wait(150);
      const storedDist = JSON.parse(localStorage.getItem("cognitive-reappraisal-entries"))[0];
      assert(storedDist.cognitive_distortion.indexOf("以上都不像") !== -1, "detail 以上都不像 persisted");
      assert(storedDist.distortion_note === "我觉得事情应该更公平", "detail distortion note persisted");

      click("btn-detail-back");
      await wait(150);
      document.querySelector(".entry-card").click();
      await wait(150);
      click("btn-followup-start");
      await wait(150);
      const fu = document.getElementById("followup-input");
      assert(fu, "followup input exists");
      fu.value = "后来发现他那天在赶一个紧急项目";
      fu.dispatchEvent(new Event("input", { bubbles: true }));
      click("btn-followup-save");
      await wait(150);
      // After saving, the detail view shows the outcome text + "回填于" date.
      // "已回填" only appears on the list card, so assert on the detail view.
      assert(document.body.textContent.includes("后来发现他那天在赶一个紧急项目") && document.body.textContent.includes("回填于"), "followup saved");

      // Re-edit a completed followup: tap it, change, save
      const fuEditable = document.querySelector('.detail-editable[data-field="followup"]');
      assert(fuEditable, "completed followup is tappable to edit");
      fuEditable.click();
      await wait(150);
      const fu2 = document.getElementById("followup-input");
      assert(fu2, "followup re-edit input appears");
      assert(fu2.value === "后来发现他那天在赶一个紧急项目", "re-edit prefills existing followup");
      fu2.value = "后来发现他那天在赶一个紧急项目（补充：已当面澄清）";
      fu2.dispatchEvent(new Event("input", { bubbles: true }));
      click("btn-followup-save");
      await wait(150);
      assert(document.body.textContent.includes("已当面澄清"), "followup re-edit saved");
      const storedFu = JSON.parse(localStorage.getItem("cognitive-reappraisal-entries"))[0];
      assert(storedFu.followup_outcome.indexOf("已当面澄清") !== -1, "followup re-edit persisted");

      click("btn-detail-back");
      await wait(150);

      // Delete: create a second entry, then delete it
      click("btn-new");
      await wait(200);
      const dTa = document.getElementById("wiz-input");
      dTa.value = "待删除的测试记录";
      dTa.dispatchEvent(new Event("input", { bubbles: true }));
      // walk through to save quickly (leave most fields default)
      for (let s = 0; s < 11; s++) { click("btn-wiz-next"); await wait(120); }
      click("btn-wiz-save");
      await wait(200);
      assert(document.querySelectorAll(".entry-card").length === 2, "second entry created");
      // open the newest (top) card and delete it
      document.querySelector(".entry-card").click();
      await wait(150);
      click("btn-detail-delete");
      await wait(150);
      const confirmBox = document.querySelector(".confirm-box");
      assert(confirmBox, "delete confirm dialog appears");
      confirmBox.querySelector('[data-act="ok"]').click();
      await wait(200);
      assert(document.querySelectorAll(".entry-card").length === 1, "entry deleted");
      assert(JSON.parse(localStorage.getItem("cognitive-reappraisal-entries")).length === 1, "delete persisted");

      // Phase 1 done; parent will reload the page, then run phase 2
      return { results, pass: results.filter(r => r.pass).length, fail: results.filter(r => !r.pass).length, phase: 1 };
    })()
  `;

  const result1 = await evaluate(ws, 10, testScript);
  const value1 = result1 && result1.result ? result1.result.value : null;
  if (!value1 || !value1.results || value1.fail > 0) {
    if (value1 && value1.results) value1.results.forEach(r => console.log((r.pass ? "PASS" : "FAIL") + ": " + r.msg));
    console.error("FAIL: phase 1 failed");
    if (result1 && result1.exceptionDetails) console.error(JSON.stringify(result1.exceptionDetails, null, 2));
    return false;
  }

  // Reload the page to test localStorage persistence
  sendMsg(ws, 11, "Page.navigate", { url: pageUrl });
  await new Promise(r => setTimeout(r, 1500));

  const testScript2 = `
    (async () => {
      const results = [];
      function assert(cond, msg) { results.push({ pass: !!cond, msg }); }
      function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
      function click(id) {
        const el = document.getElementById(id);
        if (!el) throw new Error("missing " + id);
        el.click();
      }

      await wait(300);
      const cardsAfterReload = document.querySelectorAll(".entry-card");
      assert(cardsAfterReload.length === 1, "entry persists after reload");
      assert(cardsAfterReload[0] && cardsAfterReload[0].textContent.includes("今天开会时领导没看我"), "entry content persists after reload");
      assert(cardsAfterReload[0] && cardsAfterReload[0].textContent.includes("已回填"), "followup persists after reload");

      click("btn-select-mode");
      await wait(150);
      assert(document.body.classList.contains("selecting"), "selecting mode active");
      const cb = document.querySelector(".checkbox");
      assert(cb, "checkbox appears in selection mode");
      // Select all
      click("btn-select-all");
      await wait(150);
      assert(document.querySelectorAll(".checkbox:checked").length === 1, "select-all checks the entry");
      const btnExport = document.getElementById("btn-export");
      assert(btnExport && !btnExport.disabled, "export button enabled");
      btnExport.click();
      await wait(150);
      const modal = document.getElementById("export-modal");
      assert(modal, "export modal shown");
      const exportText = document.getElementById("export-text").value;
      assert(exportText.includes("请你扮演一个认知重评的审查者"), "export has instruction");
      assert(exportText.includes("情境：今天开会时领导没看我"), "export has situation");
      assert(exportText.includes("回填结果：后来发现他那天在赶一个紧急项目"), "export has followup");
const fuLine = exportText.split(String.fromCharCode(10)).find(l => l.indexOf("回填结果") === 0) || "";
      window.__FU_LINE__ = fuLine;
      assert(fuLine.indexOf("回填时间：") !== -1, "export has followup date");

      const bodyWidth = document.body.scrollWidth;
      const winWidth = window.innerWidth;
      assert(bodyWidth <= winWidth + 1, "no horizontal scroll at current width (body=" + bodyWidth + ", win=" + winWidth + ")");

      const btns = document.querySelectorAll(".btn, .tag-btn, .skip-link, .entry-check");
      let smallTargets = 0;
      btns.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.height < 44 && rect.width < 44) {
          smallTargets++;
          console.log("DEBUG small target:", el.tagName, el.className, rect.width, rect.height);
        }
      });
      assert(smallTargets === 0, "all interactive targets >= 44px (small=" + smallTargets + ")");

      return { results, pass: results.filter(r => r.pass).length, fail: results.filter(r => !r.pass).length };
    })()
  `;

  const result2 = await evaluate(ws, 12, testScript2);
  const value2 = result2 && result2.result ? result2.result.value : null;
  // Read the followup line for debugging
  try {
    const fuRes = await evaluate(ws, 13, "window.__FU_LINE__ || ''");
    console.log("DEBUG followup line:", fuRes && fuRes.result ? fuRes.result.value : "(none)");
  } catch (e) { /* ignore */ }

  // Print phase 1 results
  value1.results.forEach(r => console.log((r.pass ? "PASS" : "FAIL") + ": " + r.msg));
  if (value2 && value2.results) {
    value2.results.forEach(r => console.log((r.pass ? "PASS" : "FAIL") + ": " + r.msg));
    const totalPass = value1.pass + value2.pass;
    const totalFail = value1.fail + value2.fail;
    console.log(`\n${totalPass} passed, ${totalFail} failed`);
    return totalFail === 0;
  } else {
    console.error("FAIL: no result from phase 2");
    console.error(JSON.stringify(result2, null, 2));
    return false;
  }
}

async function main() {
  const sizes = [
    [375, 812, "iPhone SE/13 mini (375px)"],
    [390, 844, "iPhone 14 (390px)"],
    [414, 896, "iPhone Plus (414px)"],
    [1280, 800, "Desktop (1280px)"]
  ];
  const { server, port } = await startServer();
  const pageUrl = "http://127.0.0.1:" + port + "/";
  const { chrome, ws } = await launchChrome();
  let allPass = true;
  try {
    for (const [w, h, label] of sizes) {
      console.log("\n=== " + label + " ===");
      const ok = await runAtSize(w, h, ws, pageUrl);
      if (!ok) allPass = false;
    }
  } finally {
    ws.close();
    chrome.kill();
    server.close();
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(allPass ? "\nALL VIEWPORTS PASSED" : "\nSOME VIEWPORTS FAILED");
  process.exit(allPass ? 0 : 1);
}

main().catch(e => {
  console.error("Browser test error:", e.message);
  process.exit(1);
});