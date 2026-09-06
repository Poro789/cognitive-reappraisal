import { describe, it, expect } from "vitest";
import { buildExportText } from "./export.js";

const ts = new Date(2024, 0, 15, 9, 5).getTime();

function makeEntry(overrides) {
  return Object.assign({
    id: "test-1",
    created_at: ts,
    situation: "今天开会时领导没看我",
    automatic_thought: "他一定对我有意见",
    thought_belief_before: 8,
    emotion_label: "焦虑",
    emotion_intensity_before: 7,
    cognitive_distortion: ["读心术"],
    distortion_note: "",
    evidence_for: "他今天确实没和我眼神接触",
    evidence_against: "他昨天还夸了我的报告",
    alternative_thought: "他可能只是在想别的事情",
    thought_belief_after: 4,
    emotion_intensity_after: 3,
    followup_completed: false,
    followup_outcome: "",
    followup_date: null
  }, overrides);
}

// buildExportText takes (ids, getEntry); provide a getEntry backed by a list.
function makeGetEntry(entries) {
  const map = {};
  entries.forEach(e => { map[e.id] = e; });
  return (id) => map[id] || null;
}

describe("buildExportText", () => {
  it("includes the review instruction", () => {
    const entry = makeEntry();
    const text = buildExportText(["test-1"], makeGetEntry([entry]));
    expect(text).toContain("请你扮演一个认知重评的审查者");
  });

  it("includes the record date", () => {
    const entry = makeEntry();
    const text = buildExportText(["test-1"], makeGetEntry([entry]));
    expect(text).toContain("记录时间：2024-01-15 09:05");
  });

  it("includes situation", () => {
    const entry = makeEntry();
    const text = buildExportText(["test-1"], makeGetEntry([entry]));
    expect(text).toContain("情境：今天开会时领导没看我");
  });

  it("includes automatic thought with belief", () => {
    const entry = makeEntry();
    const text = buildExportText(["test-1"], makeGetEntry([entry]));
    expect(text).toContain("自动想法：他一定对我有意见（当时相信程度 8/10）");
  });

  it("includes emotion with intensity", () => {
    const entry = makeEntry();
    const text = buildExportText(["test-1"], makeGetEntry([entry]));
    expect(text).toContain("情绪：焦虑，强度 7/10");
  });

  it("includes distortion type", () => {
    const entry = makeEntry();
    const text = buildExportText(["test-1"], makeGetEntry([entry]));
    expect(text).toContain("认知扭曲类型：读心术");
  });

  it("includes evidence for/against", () => {
    const entry = makeEntry();
    const text = buildExportText(["test-1"], makeGetEntry([entry]));
    expect(text).toContain("支持这个想法的证据：他今天确实没和我眼神接触");
    expect(text).toContain("反对这个想法的证据：他昨天还夸了我的报告");
  });

  it("includes alternative thought with belief", () => {
    const entry = makeEntry();
    const text = buildExportText(["test-1"], makeGetEntry([entry]));
    expect(text).toContain("替代想法：他可能只是在想别的事情（相信程度 4/10）");
  });

  it("includes after intensity", () => {
    const entry = makeEntry();
    const text = buildExportText(["test-1"], makeGetEntry([entry]));
    expect(text).toContain("重新评估后情绪强度：3/10");
  });

  it("shows 尚未回填 when no followup", () => {
    const entry = makeEntry();
    const text = buildExportText(["test-1"], makeGetEntry([entry]));
    expect(text).toContain("回填结果：尚未回填");
  });

  it("includes separators", () => {
    const entry = makeEntry();
    const text = buildExportText(["test-1"], makeGetEntry([entry]));
    expect(text).toContain("---");
  });

  it("omits distortion line when empty", () => {
    const entry = makeEntry({ id: "test-2", cognitive_distortion: [] });
    const text = buildExportText(["test-2"], makeGetEntry([entry]));
    expect(text).not.toContain("认知扭曲类型：");
  });

  it("handles 以上都不像 without a note", () => {
    const entry = makeEntry({ id: "test-none", cognitive_distortion: ["以上都不像"], distortion_note: "" });
    const text = buildExportText(["test-none"], makeGetEntry([entry]));
    expect(text).toContain("认知扭曲类型：以上都不像（用户判断不属于常见认知扭曲）");
  });

  it("handles 以上都不像 with a user note", () => {
    const entry = makeEntry({ id: "test-none-note", cognitive_distortion: ["以上都不像"], distortion_note: "我觉得运气对我特别差" });
    const text = buildExportText(["test-none-note"], makeGetEntry([entry]));
    expect(text).toContain("认知扭曲类型：以上都不像（用户描述：我觉得运气对我特别差）");
  });

  it("includes followup when completed", () => {
    const entry = makeEntry({
      id: "test-3",
      followup_completed: true,
      followup_outcome: "后来发现他那天在赶一个紧急项目",
      followup_date: ts + 86400000
    });
    const text = buildExportText(["test-3"], makeGetEntry([entry]));
    expect(text).toContain("回填结果：后来发现他那天在赶一个紧急项目");
    expect(text).toMatch(/回填结果：后来发现他那天在赶一个紧急项目（回填时间：\d{4}-\d{2}-\d{2} \d{2}:\d{2}）/);
  });

  it("sorts multiple entries by created_at", () => {
    const e1 = makeEntry({ id: "a", created_at: 1000 });
    const e2 = makeEntry({ id: "b", created_at: 2000 });
    const text = buildExportText(["a", "b"], makeGetEntry([e2, e1]));
    const idxA = text.indexOf("记录时间：");
    const idxB = text.indexOf("记录时间：", idxA + 1);
    expect(idxA).toBeLessThan(idxB);
  });

  it("uses [空] placeholder for empty fields", () => {
    const entry = makeEntry({
      id: "empty-test",
      situation: "", automatic_thought: "", emotion_label: "",
      evidence_for: "", evidence_against: "", alternative_thought: ""
    });
    const text = buildExportText(["empty-test"], makeGetEntry([entry]));
    expect(text).toContain("情境：[空]");
    expect(text).toContain("自动想法：[空]");
    expect(text).toContain("情绪：[未命名]");
    expect(text).toContain("支持这个想法的证据：[空]");
    expect(text).toContain("反对这个想法的证据：[空]");
    expect(text).toContain("替代想法：[空]");
    expect(text).not.toContain("（未填写）");
  });
});