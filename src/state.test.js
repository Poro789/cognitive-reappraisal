import { describe, it, expect, beforeEach, vi } from "vitest";
import { normalizeEntry, clampInt } from "./state.js";

// state.js imports from constants.js and utils.js — no DOM needed for
// the pure functions we test here.

describe("normalizeEntry", () => {
  it("returns null for non-object input", () => {
    expect(normalizeEntry(null)).toBeNull();
    expect(normalizeEntry("string")).toBeNull();
    expect(normalizeEntry(42)).toBeNull();
    expect(normalizeEntry([1, 2])).toBeNull();
  });

  it("returns null for missing id", () => {
    expect(normalizeEntry({ created_at: 1000 })).toBeNull();
    expect(normalizeEntry({ id: "", created_at: 1000 })).toBeNull();
  });

  it("returns null for missing or invalid created_at", () => {
    expect(normalizeEntry({ id: "a" })).toBeNull();
    expect(normalizeEntry({ id: "a", created_at: "not-a-number" })).toBeNull();
    expect(normalizeEntry({ id: "a", created_at: NaN })).toBeNull();
  });

  it("normalizes a valid entry", () => {
    const raw = {
      id: "test-1",
      created_at: 1700000000000,
      situation: "测试情境",
      automatic_thought: "测试想法",
      thought_belief_before: 8,
      emotion_label: "焦虑",
      emotion_intensity_before: 7,
      cognitive_distortion: ["灾难化"],
      distortion_note: "",
      evidence_for: "证据A",
      evidence_against: "证据B",
      alternative_thought: "替代想法",
      thought_belief_after: 4,
      emotion_intensity_after: 3,
      followup_completed: false,
      followup_outcome: "",
      followup_date: null
    };
    const e = normalizeEntry(raw);
    expect(e).not.toBeNull();
    expect(e.id).toBe("test-1");
    expect(e.situation).toBe("测试情境");
    expect(e.thought_belief_before).toBe(8);
    expect(e.cognitive_distortion).toEqual(["灾难化"]);
    expect(e.followup_completed).toBe(false);
  });

  it("fills in defaults for missing optional fields", () => {
    const e = normalizeEntry({ id: "min", created_at: 1000 });
    expect(e).not.toBeNull();
    expect(e.situation).toBe("");
    expect(e.thought_belief_before).toBe(5);
    expect(e.emotion_intensity_before).toBe(5);
    expect(e.cognitive_distortion).toEqual([]);
    expect(e.followup_completed).toBe(false);
    expect(e.followup_date).toBeNull();
  });

  it("clamps out-of-range slider values", () => {
    const e = normalizeEntry({
      id: "clamp", created_at: 1000,
      thought_belief_before: 15,
      emotion_intensity_before: 0,
      thought_belief_after: -3,
      emotion_intensity_after: 99
    });
    expect(e.thought_belief_before).toBe(10);
    expect(e.emotion_intensity_before).toBe(1);
    expect(e.thought_belief_after).toBe(1);
    expect(e.emotion_intensity_after).toBe(10);
  });

  it("filters non-string items from cognitive_distortion", () => {
    const e = normalizeEntry({
      id: "filter", created_at: 1000,
      cognitive_distortion: ["灾难化", 42, null, "读心术"]
    });
    expect(e.cognitive_distortion).toEqual(["灾难化", "读心术"]);
  });

  it("coerces followup_completed to boolean", () => {
    const e1 = normalizeEntry({ id: "a", created_at: 1, followup_completed: "yes" });
    expect(e1.followup_completed).toBe(true);
    const e2 = normalizeEntry({ id: "b", created_at: 1, followup_completed: 0 });
    expect(e2.followup_completed).toBe(false);
  });
});

describe("clampInt", () => {
  it("clamps to range", () => {
    expect(clampInt(5, 1, 10, 5)).toBe(5);
    expect(clampInt(0, 1, 10, 5)).toBe(1);
    expect(clampInt(15, 1, 10, 5)).toBe(10);
  });
  it("returns fallback for non-numeric", () => {
    expect(clampInt("abc", 1, 10, 5)).toBe(5);
    expect(clampInt(null, 1, 10, 5)).toBe(5);
    expect(clampInt(undefined, 1, 10, 5)).toBe(5);
  });
});