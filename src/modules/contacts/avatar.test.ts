import { describe, it, expect } from "vitest";
import { initials, colorFor } from "./avatar";

describe("initials", () => {
  it("uses first letters of two name parts", () => {
    expect(initials("Kovács Anna", "k@x.hu")).toBe("KA");
  });
  it("uses single name initial", () => {
    expect(initials("Béla", "b@x.hu")).toBe("BÉ".slice(0, 2));
  });
  it("falls back to email when no name", () => {
    expect(initials("", "zoltan@x.hu")).toBe("ZO");
  });
});

describe("colorFor", () => {
  it("is deterministic for the same key", () => {
    expect(colorFor("a@x.hu")).toBe(colorFor("a@x.hu"));
  });
  it("returns a hsl string", () => {
    expect(colorFor("a@x.hu")).toMatch(/^hsl\(/);
  });
});
