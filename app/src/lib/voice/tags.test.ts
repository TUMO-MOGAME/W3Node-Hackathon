import { describe, expect, it } from "vitest";
import { stripVoiceTags } from "./tags";

describe("stripVoiceTags", () => {
  it("removes tone tags at the start and in the middle", () => {
    expect(stripVoiceTags("[happy] I've opened the Send money screen for you.")).toBe("I've opened the Send money screen for you.");
    expect(stripVoiceTags("Of course. [short pause] Your vault holds 23,915 USD₮.")).toBe("Of course. Your vault holds 23,915 USD₮.");
  });

  it("keeps ordinary text and non-tag brackets", () => {
    expect(stripVoiceTags("Rule [1] pays fees.")).toBe("Rule [1] pays fees.");
    expect(stripVoiceTags("No tags here.")).toBe("No tags here.");
  });

  it("returns an empty string for a tag-only line", () => {
    expect(stripVoiceTags("[laughs]")).toBe("");
  });
});
