import { describe, it, expect } from "vitest";
import { DEFAULT_MODEL_URL, parseSketchfabUrl } from "@/lib/virtual-tour";

const ID = "619e57981a444a7e975290f6c292dd39";
describe("parseSketchfabUrl", () => {
  it("builds the embed URL from the model id", () => {
    const m = parseSketchfabUrl(DEFAULT_MODEL_URL)!;
    expect(m.modelId).toBe(ID);
    expect(m.embedUrl).toBe(`https://sketchfab.com/models/${ID}/embed?autostart=1&preload=1&ui_hint=2`);
    expect(m.pageUrl).toBe(DEFAULT_MODEL_URL);
  });
  it("ignores tracking params and trailing slash; never copies query into the embed", () => {
    const m = parseSketchfabUrl(`${DEFAULT_MODEL_URL}/?utm_source=chatgpt.com&evil=1`)!;
    expect(m.embedUrl).not.toContain("utm_source"); expect(m.embedUrl).not.toContain("evil"); expect(m.modelId).toBe(ID);
  });
  it("rejects non-https, other hosts, lookalikes, and urls without a model id", () => {
    for (const u of [`http://sketchfab.com/3d-models/x-${ID}`, `https://evil.com/3d-models/x-${ID}`, `https://sketchfab.com.evil.com/3d-models/x-${ID}`,
      `https://sketchfab.com/3d-models/no-id`, "javascript:alert(1)", "not a url", "", undefined, null]) {
      expect(parseSketchfabUrl(u as string)).toBeNull();
    }
  });
});
