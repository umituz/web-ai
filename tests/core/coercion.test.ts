import { describe, expect, it } from "vitest";
import {
  asBoolean,
  asInteger,
  asNonEmptyString,
  asNumber,
  asObjectArray,
  asRecord,
  asStringArray,
  asTrimmedOptionalString,
  clampNumber,
  clampScore,
  coerceArray,
  oneOfCatalog,
  safeParseJson,
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

describe("asBoolean", () => {
  it("handles boolean types", () => {
    expect(asBoolean(true)).toBe(true);
    expect(asBoolean(false)).toBe(false);
  });

  it("handles string representations", () => {
    expect(asBoolean("true")).toBe(true);
    expect(asBoolean("TRUE")).toBe(true);
    expect(asBoolean("1")).toBe(true);
    expect(asBoolean("false")).toBe(false);
    expect(asBoolean("0")).toBe(false);
  });

  it("handles numeric 1 and 0", () => {
    expect(asBoolean(1)).toBe(true);
    expect(asBoolean(0)).toBe(false);
  });

  it("falls back to default value", () => {
    expect(asBoolean("other", true)).toBe(true);
    expect(asBoolean(undefined, false)).toBe(false);
  });
});

describe("asNumber", () => {
  it("returns finite numbers", () => {
    expect(asNumber(42)).toBe(42);
    expect(asNumber(3.14)).toBe(3.14);
  });

  it("parses numeric strings", () => {
    expect(asNumber("42")).toBe(42);
    expect(asNumber("  3.14  ")).toBe(3.14);
  });

  it("falls back to default value for non-numeric input", () => {
    expect(asNumber("abc", 10)).toBe(10);
    expect(asNumber(Number.NaN, 5)).toBe(5);
    expect(asNumber(null, 0)).toBe(0);
  });
});

describe("asInteger", () => {
  it("truncates decimals", () => {
    expect(asInteger(42.8)).toBe(42);
    expect(asInteger(-3.9)).toBe(-3);
  });

  it("parses integer strings", () => {
    expect(asInteger("100")).toBe(100);
  });

  it("falls back for non-integers", () => {
    expect(asInteger("nope", 7)).toBe(7);
  });
});

describe("asNonEmptyString", () => {
  it("trims and returns non-empty strings", () => {
    expect(asNonEmptyString("  hello ")).toBe("hello");
  });

  it("returns default for empty strings or non-strings", () => {
    expect(asNonEmptyString("   ", "fallback")).toBe("fallback");
    expect(asNonEmptyString(null, "fallback")).toBe("fallback");
  });
});

describe("coerceArray", () => {
  it("maps items and drops null or undefined", () => {
    const res = coerceArray([1, 2, "bad", 4], (item) => (typeof item === "number" ? item * 10 : null));
    expect(res).toEqual([10, 20, 40]);
  });

  it("respects max limit", () => {
    const res = coerceArray([1, 2, 3, 4], (item) => item, 2);
    expect(res).toEqual([1, 2]);
  });

  it("returns empty array for non-array input", () => {
    expect(coerceArray("invalid", (x) => x)).toEqual([]);
  });
});

describe("clampNumber", () => {
  it("clamps between min and max", () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
    expect(clampNumber(-5, 0, 10)).toBe(0);
    expect(clampNumber(50, 0, 10)).toBe(10);
  });

  it("returns defaultValue for non-finite values", () => {
    expect(clampNumber("not a number", 0, 10, 7)).toBe(7);
    expect(clampNumber(Number.NaN, 0, 10, 3)).toBe(3);
  });
});

describe("safeParseJson", () => {
  it("returns parsed object for valid JSON string", () => {
    expect(safeParseJson('{"key":"value"}', {})).toEqual({ key: "value" });
  });

  it("returns object directly if already an object", () => {
    const obj = { foo: "bar" };
    expect(safeParseJson(obj, {})).toBe(obj);
  });

  it("returns fallback for invalid JSON string or invalid types", () => {
    expect(safeParseJson("invalid json", { default: true })).toEqual({ default: true });
    expect(safeParseJson(null, { default: true })).toEqual({ default: true });
    expect(safeParseJson(undefined, 123)).toBe(123);
  });
});
