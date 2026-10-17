import { readFile } from "node:fs/promises";
import { calculateProjection } from "../src/lib/calculator.ts";

const fixtures = JSON.parse(
  await readFile(
    new URL("../src/test/fixtures/excel-scenarios.json", import.meta.url),
    "utf8",
  ),
);
const columns = [
  "openingBalance",
  "openingTodayValue",
  "regularWithdrawals",
  "lumpSumWithdrawals",
  "lumpSumWindfalls",
  "closingBalance",
];
const money = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const comparisons = [];
const reports = fixtures.map((fixture) => {
  const actual = calculateProjection(fixture.inputs);
  let maximumDifference = 0;
  let mismatches = 0;
  fixture.rows.forEach((expected, year) => {
    columns.forEach((column, index) => {
      const excelValue = expected[index];
      const appValue = actual.rows[year][column];
      const difference = appValue - excelValue;
      const pass =
        Math.abs(difference) < 0.005 &&
        money.format(appValue) === money.format(excelValue);
      maximumDifference = Math.max(maximumDifference, Math.abs(difference));
      if (!pass) mismatches += 1;
      comparisons.push({
        scenario: fixture.name,
        year,
        column,
        "Excel (AUD)": money.format(excelValue),
        "App (AUD)": money.format(appValue),
        "Difference (AUD)": difference.toFixed(10),
        result: pass ? "PASS" : "FAIL",
      });
    });
  });
  return {
    scenario: fixture.name,
    rows: fixture.rows.length,
    "Amounts checked": fixture.rows.length * columns.length,
    "Maximum difference (AUD)": maximumDifference.toFixed(10),
    "Cent mismatches": mismatches,
    "Shortfall year matches":
      actual.depletionEndYear === fixture.depletionEndYear,
    result:
      mismatches === 0 && actual.depletionEndYear === fixture.depletionEndYear
        ? "PASS"
        : "FAIL",
  };
});

console.table(reports);
console.table(
  process.argv.includes("--details")
    ? comparisons
    : comparisons.filter(
        (comparison) =>
          comparison.result === "FAIL" ||
          (comparison.scenario === "Default" &&
            [0, 1, 21].includes(comparison.year) &&
            comparison.column === "closingBalance"),
      ),
);
if (reports.some((report) => report.result === "FAIL")) process.exitCode = 1;
