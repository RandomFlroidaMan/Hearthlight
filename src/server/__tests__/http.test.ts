import { describe, expect, it } from "vitest";
import { parseFormData, parseJsonBody } from "../http";

// Regression coverage: every POST/PATCH route used to call
// `request.json()` directly, which throws on malformed input and produced
// a bare, bodyless 500 instead of a clean 400 — found via a live debug
// pass, not a test that predated the bug.
describe("parseJsonBody", () => {
  it("returns the parsed data for valid JSON", async () => {
    const request = new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ foo: "bar" }),
    });
    const result = await parseJsonBody(request);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ foo: "bar" });
    }
  });

  it("returns a 400 response for malformed JSON instead of throwing", async () => {
    const request = new Request("http://test", {
      method: "POST",
      body: "not json",
    });
    const result = await parseJsonBody(request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const json = await result.response.json();
      expect(json.error).toBe("invalid_json");
    }
  });

  it("returns a 400 response for an empty body", async () => {
    const request = new Request("http://test", { method: "POST", body: "" });
    const result = await parseJsonBody(request);
    expect(result.ok).toBe(false);
  });
});

describe("parseFormData", () => {
  it("returns the parsed FormData for a real multipart body", async () => {
    const form = new FormData();
    form.set("name", "Test");
    const request = new Request("http://test", { method: "POST", body: form });
    const result = await parseFormData(request);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.get("name")).toBe("Test");
    }
  });

  it("returns a 400 response instead of throwing when the body isn't multipart", async () => {
    const request = new Request("http://test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });
    const result = await parseFormData(request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const json = await result.response.json();
      expect(json.error).toBe("invalid_form_data");
    }
  });
});
