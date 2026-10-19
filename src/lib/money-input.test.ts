import { describe, expect, it } from "vitest";
import { formatMoneyInput, parseMoneyInput } from "./money-input";

describe("money input parsing", () => {
  it.each([
    ["0", 0],
    ["1350000.50", 1350000.5],
    ["1,350,000.50", 1350000.5],
    [" 1,350,000.50 ", 1350000.5],
    ["-1,000.25", -1000.25],
    [".50", 0.5],
    ["1200.", 1200],
    ["1e308", 1e308],
  ])("parses %s without changing its numeric amount", (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each(["", " ", "-", ".", "1,2", "1,,000", "1,000x", "0x10"])(
    "keeps blank, incomplete, and malformed amounts invalid: %s",
    (input) => {
      expect(parseMoneyInput(input)).toBeNaN();
    },
  );
});

describe("money input display", () => {
  it.each([
    ["0", "0"],
    ["1350000", "1,350,000"],
    ["1350000.50", "1,350,000.50"],
    ["1234567.8901234", "1,234,567.8901234"],
    ["1,234,567.8901234", "1,234,567.8901234"],
    ["-1200.50", "-1,200.50"],
    ["1200.", "1,200."],
    [".50", ".50"],
    ["", ""],
    ["-", "-"],
    ["1,2", "1,2"],
    ["1e308", "1e308"],
  ])(
    "formats %s as %s without rounding or hiding invalid input",
    (input, expected) => {
      expect(formatMoneyInput(input)).toBe(expected);
    },
  );
});
