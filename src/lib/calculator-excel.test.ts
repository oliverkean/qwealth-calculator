import { describe, expect, it } from "vitest";
import fixtures from "@/test/fixtures/excel-scenarios.json";
import { calculateProjection, type CalculatorInputs } from "./calculator";

const columns = [
  "openingBalance",
  "openingTodayValue",
  "regularWithdrawals",
  "lumpSumWithdrawals",
  "lumpSumWindfalls",
  "closingBalance",
] as const;
const money = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

describe("complete annual tables recalculated in Excel", () => {
  it.each(fixtures)(
    "matches every year and financial column: $name",
    (fixture) => {
      const result = calculateProjection(fixture.inputs as CalculatorInputs);
      expect(result.rows).toHaveLength(fixture.rows.length);
      expect(result.depletionEndYear).toBe(fixture.depletionEndYear);

      const mismatches: {
        year: number;
        column: string;
        excel: number;
        app: number;
        difference: number;
      }[] = [];
      fixture.rows.forEach((expectedRow, year) => {
        columns.forEach((column, columnIndex) => {
          const excel = expectedRow[columnIndex];
          const app = result.rows[year][column];
          const difference = app - excel;
          if (
            Math.abs(difference) >= 0.005 ||
            money.format(app) !== money.format(excel)
          ) {
            mismatches.push({ year, column, excel, app, difference });
          }
        });
      });
      expect(
        mismatches,
        `${fixture.name}: financial values must match Excel to the displayed cent`,
      ).toEqual([]);
    },
  );
});
