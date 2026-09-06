import { describe, it, expect } from "vitest";
import { formatDate, truncate, escapeHtml, draftHasContent, uid } from "./utils.js";

describe("formatDate", () => {
  it("formats a timestamp as YYYY-MM-DD HH:mm", () => {
    const ts = new Date(2024, 0, 15, 9, 5).getTime();
    expect(formatDate(ts)).toBe("2024-01-15 09:05");
  });
});

describe("truncate", () => {
  it("shortens long strings with an ellipsis", () => {
    expect(truncate("hello world", 5)).toBe("hello…");
  });
  it("keeps short strings as-is", () => {
    expect(truncate("hi", 5)).toBe("hi");
  });
  it("normalizes whitespace", () => {
    expect(truncate("  a  b  c  ", 10)).toBe("a b c");
  });
  it("handles emoji (surrogate pairs) without splitting", () => {
    const emojiStr = "🎉🎊🎈🎆🎇"; // 5 emoji, each 2 UTF-16 code units
    expect(truncate(emojiStr, 3)).toBe("🎉🎊🎈…");
  });
  it("handles mixed text + emoji", () => {
    expect(truncate("ab🎉cd", 3)).toBe("ab🎉…");
  });
  it("keeps a single emoji that fits", () => {
    expect(truncate("🎉", 1)).toBe("🎉");
  });
  it("truncates two emoji to one", () => {
    expect(truncate("🎉🎊", 1)).toBe("🎉…");
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML special characters", () => {
    expect(escapeHtml("<b>&\"</b>")).toBe("&lt;b&gt;&amp;&quot;&lt;/b&gt;");
  });
  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });
  it("escapes mixed quotes", () => {
    expect(escapeHtml(`<a href="x" title='y'>`)).toBe("&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;");
  });
  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("draftHasContent", () => {
  const emptyDraft = {
    situation: "", automatic_thought: "", emotion_label: "",
    evidence_for: "", evidence_against: "", alternative_thought: "",
    cognitive_distortion: []
  };
  it("returns false for an empty draft", () => {
    expect(draftHasContent(emptyDraft)).toBe(false);
  });
  it("returns false for whitespace-only situation", () => {
    expect(draftHasContent(Object.assign({}, emptyDraft, { situation: "  " }))).toBe(false);
  });
  it("returns true when situation is filled", () => {
    expect(draftHasContent(Object.assign({}, emptyDraft, { situation: "x" }))).toBe(true);
  });
  it("returns true when automatic_thought is filled", () => {
    expect(draftHasContent(Object.assign({}, emptyDraft, { automatic_thought: "y" }))).toBe(true);
  });
  it("returns true when emotion_label is filled", () => {
    expect(draftHasContent(Object.assign({}, emptyDraft, { emotion_label: "z" }))).toBe(true);
  });
  it("returns true when evidence_for is filled", () => {
    expect(draftHasContent(Object.assign({}, emptyDraft, { evidence_for: "e" }))).toBe(true);
  });
  it("returns true when evidence_against is filled", () => {
    expect(draftHasContent(Object.assign({}, emptyDraft, { evidence_against: "e" }))).toBe(true);
  });
  it("returns true when alternative_thought is filled", () => {
    expect(draftHasContent(Object.assign({}, emptyDraft, { alternative_thought: "a" }))).toBe(true);
  });
  it("returns true when a distortion is selected", () => {
    expect(draftHasContent(Object.assign({}, emptyDraft, { cognitive_distortion: ["灾难化"] }))).toBe(true);
  });
  it("returns false when only sliders are set (they default to 5)", () => {
    expect(draftHasContent(Object.assign({}, emptyDraft, { thought_belief_before: 10, emotion_intensity_before: 10 }))).toBe(false);
  });
});

describe("uid", () => {
  it("generates 200 unique ids", () => {
    const ids = new Set();
    for (let i = 0; i < 200; i++) ids.add(uid());
    expect(ids.size).toBe(200);
  });
  it("returns a non-empty string", () => {
    const id = uid();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});