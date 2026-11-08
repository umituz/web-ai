import { describe, expect, it } from "vitest";
import {
  asObjectArray,
  asRecord,
  asStringArray,
  asTrimmedOptionalString,
  clampScore,
  oneOfCatalog,
} from "../../src/core/utils/coercion.util";

describe("asRecord", () => {
  it("returns the object for plain objects", () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
  });

  it("returns an empty record for non-objects, null and arrays", () => {
    expect(asRecord("x")).toEqual({});
    expect(asRecord(null)).toEqual({});
    expect(asRecord([1, 2])).toEqual({});
  });
});

describe("asStringArray", () => {
  it("keeps non-empty strings and slices to max", () => {
    expect(asStringArray(["a", " ", "b", "c", "d"], 3)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for non-arrays", () => {
    expect(asStringArray("a", 3)).toEqual([]);
  });
});

describe("asObjectArray", () => {
  it("keeps only object entries", () => {
    expect(asObjectArray([{ a: 1 }, "nope", null, [3], { b: 2 }])).toEqual([
      { a: 1 },
      { b: 2 },
    ]);
  });
});

describe("asTrimmedOptionalString", () => {
  it("trims non-empty strings", () => {
    expect(asTrimmedOptionalString("  hi  ")).toBe("hi");
  });

  it("returns undefined for blank or non-string values", () => {
    expect(asTrimmedOptionalString("   ")).toBeUndefined();
    expect(asTrimmedOptionalString(5)).toBeUndefined();
  });
});

describe("clampScore", () => {
  it("rounds and clamps finite numbers into the range", () => {
    expect(clampScore(87.4, 0, 100)).toBe(87);
    expect(clampScore(-5, 0, 100)).toBe(0);
    expect(clampScore(140, 0, 100)).toBe(100);
  });

  it("returns null for non-numbers and non-finite values", () => {
    expect(clampScore("87", 0, 100)).toBeNull();
    expect(clampScore(Number.NaN, 0, 100)).toBeNull();
  });
});

describe("oneOfCatalog", () => {
  const catalog = ["low", "medium", "high"] as const;

  it("returns the value when it is in the catalog", () => {
    expect(oneOfCatalog(catalog, "medium")).toBe("medium");
  });

  it("returns null for values outside the catalog", () => {
    expect(oneOfCatalog(catalog, "extreme")).toBeNull();
  });
});
