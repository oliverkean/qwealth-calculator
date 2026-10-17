import { describe, expect, it } from "vitest";
import {
  calculateProjection,
  defaultInputs,
  PROJECTION_YEARS,
  type CalculatorInputs,
} from "./calculator";

// Cached values from the supplied workbook, DrawdownTable C3:H24, rounded to cents.
// Column order: opening, today's opening value, regular, lump withdrawal, windfall, closing.
const defaultExcelRows = [
  [1650000, 1650000, 120000, 0, 0, 1649678.86],
  [1649678.86, 1601629.96, 123600, 0, 1500, 1647111.5],
  [1647111.5, 1552560.56, 127308, 0, 0, 1639017.79],
  [1639017.79, 1499933.46, 131127.24, 0, 0, 1626368.24],
  [1626368.24, 1445007.11, 135061.06, 0, 0, 1608702.69],
  [1608702.69, 1387681.07, 139112.89, 0, 1000, 1586522.94],
  [1586522.94, 1328687.98, 143286.28, 0, 0, 1557364.73],
  [1557364.73, 1266280.04, 147584.86, 0, 0, 1521575.23],
  [1521575.23, 1201145.53, 152012.41, 0, 0, 1478523.76],
  [1478523.76, 1133165.35, 156572.78, 0, 1000, 1428528.34],
  [1428528.34, 1062959.25, 161269.97, 0, 0, 1368926.73],
  [1368926.73, 988941.8, 166108.06, 0, 0, 1299852.76],
  [1299852.76, 911690.57, 171091.31, 0, 0, 1220445.94],
  [1220445.94, 831064.3, 176224.05, 0, 0, 1129776.73],
  [1129776.73, 746915.51, 181510.77, 0, 0, 1026841.25],
  [1026841.25, 659090.33, 186956.09, 0, 0, 910555.55],
  [910555.55, 567428.12, 192564.77, 0, 0, 779749.46],
  [779749.46, 471761.25, 198341.72, 0, 0, 633159.98],
  [633159.98, 371914.76, 204291.97, 0, 0, 469424.16],
  [469424.16, 267706.04, 210420.73, 0, 0, 287071.48],
  [287071.48, 158944.52, 216733.35, 0, 0, 84515.56],
  [84515.56, 45431.28, 223235.35, 0, 0, -139954.65],
];

function scenario(overrides: Partial<CalculatorInputs>): CalculatorInputs {
  return { ...defaultInputs, events: [...defaultInputs.events], ...overrides };
}

function expectExcelCents(
  actual: number,
  expected: number,
  context: string,
): void {
  expect(
    Math.abs(actual - expected),
    `${context}: Excel ${expected.toFixed(2)}, app ${actual.toFixed(2)}`,
  ).toBeLessThan(0.00501);
}

describe("Excel workbook parity", () => {
  it("matches every default row and column through depletion to the cent", () => {
    const projection = calculateProjection(defaultInputs);
    expect(projection.rows).toHaveLength(PROJECTION_YEARS);
    expect(projection.depletionEndYear).toBe(22); // Workbook Year 21 closes negative.

    defaultExcelRows.forEach((expected, year) => {
      const row = projection.rows[year];
      const actual = [
        row.openingBalance,
        row.openingTodayValue,
        row.regularWithdrawals,
        row.lumpSumWithdrawals,
        row.lumpSumWindfalls,
        row.closingBalance,
      ];
      actual.forEach((value, column) => {
        expectExcelCents(
          value,
          expected[column],
          `Year ${year}, column ${column}`,
        );
      });
    });

    projection.rows.slice(22).forEach((row) => {
      expect(row.openingBalance).toBe(0);
      expect(row.regularWithdrawals).toBe(0);
      expect(row.closingBalance).toBe(0);
    });
  });

  it.each([
    ["zero return", { annualReturn: 0 }, 12, 1_530_000, 1_407_900],
    [
      "zero inflation",
      { annualInflation: 0 },
      null,
      1_649_678.86,
      1_650_833.63,
    ],
    [
      "zero withdrawal",
      { monthlyWithdrawal: 0 },
      null,
      1_773_750,
      1_908_281.25,
    ],
    [
      "larger starting balance",
      { startingBalance: 2_500_000 },
      null,
      2_563_428.86,
      2_629_392.75,
    ],
    [
      "negative return",
      { annualReturn: -0.04 },
      10,
      1_466_216.21,
      1_287_750.27,
    ],
  ] as const)("matches Excel: %s", (_, overrides, depletion, year0, year1) => {
    const projection = calculateProjection(scenario(overrides));
    expect(projection.depletionEndYear).toBe(depletion);
    expectExcelCents(
      projection.rows[0].closingBalance,
      year0,
      "Year 0 closing",
    );
    expectExcelCents(
      projection.rows[1].closingBalance,
      year1,
      "Year 1 closing",
    );
  });

  it("applies end-of-year lump sums after monthly compounding", () => {
    const withdrawal = calculateProjection(
      scenario({
        events: [
          ...defaultInputs.events,
          { id: "out", endYear: 1, type: "withdrawal", amount: 50_000 },
        ],
      }),
    );
    expect(withdrawal.depletionEndYear).toBe(21);
    expectExcelCents(
      withdrawal.rows[0].closingBalance,
      1_599_678.86,
      "Lump withdrawal",
    );
    expectExcelCents(
      withdrawal.rows[1].closingBalance,
      1_593_361.5,
      "Lump withdrawal Year 1",
    );

    const windfall = calculateProjection(
      scenario({
        events: [
          ...defaultInputs.events,
          { id: "in", endYear: 1, type: "windfall", amount: 50_000 },
        ],
      }),
    );
    expect(windfall.depletionEndYear).toBe(23);
    expectExcelCents(
      windfall.rows[0].closingBalance,
      1_699_678.86,
      "Lump windfall",
    );
    expectExcelCents(
      windfall.rows[1].closingBalance,
      1_700_861.5,
      "Lump windfall Year 1",
    );
  });

  it("retains the first negative year, then permits windfall revival without restarting withdrawals", () => {
    const projection = calculateProjection(
      scenario({
        startingBalance: 10_000,
        events: [
          { id: "revival", endYear: 2, type: "windfall", amount: 1_500 },
        ],
      }),
    );
    expect(projection.depletionEndYear).toBe(1);
    expectExcelCents(
      projection.rows[0].closingBalance,
      -113_321.14,
      "Negative Year 0",
    );
    expect(projection.rows[1].openingBalance).toBe(0);
    expect(projection.rows[1].regularWithdrawals).toBe(0);
    expect(projection.rows[1].closingBalance).toBe(1_500);
    expect(projection.rows[2].regularWithdrawals).toBe(0);
    expectExcelCents(
      projection.rows[2].closingBalance,
      1_612.5,
      "Post-revival Year 2",
    );
  });

  it("matches an Excel scenario depleted in the first period", () => {
    const projection = calculateProjection(
      scenario({ startingBalance: 15_000, events: [] }),
    );
    expect(projection.depletionEndYear).toBe(1);
    expectExcelCents(
      projection.rows[0].closingBalance,
      -107_946.14,
      "Early depletion",
    );
    expect(projection.rows[1].openingBalance).toBe(0);
  });

  it("matches an Excel scenario surviving the full projection", () => {
    const projection = calculateProjection(
      scenario({
        startingBalance: 2_500_000,
        monthlyWithdrawal: 5_000,
        events: [],
      }),
    );
    expect(projection.depletionEndYear).toBeNull();
    expectExcelCents(
      projection.rows[0].closingBalance,
      2_625_464.43,
      "No depletion Year 0",
    );
    expectExcelCents(
      projection.rows[50].closingBalance,
      51_058_513.81,
      "No depletion Year 50",
    );
  });

  it("maps human end-year events to workbook years 0 and 50", () => {
    const projection = calculateProjection(
      scenario({
        monthlyWithdrawal: 0,
        events: [
          { id: "first", endYear: 1, type: "windfall", amount: 100 },
          { id: "last", endYear: 51, type: "withdrawal", amount: 200 },
        ],
      }),
    );
    expect(projection.rows[0].lumpSumWindfalls).toBe(100);
    expect(projection.rows[0].year).toBe(0);
    expect(projection.rows[50].lumpSumWithdrawals).toBe(200);
    expect(projection.rows[50].endYear).toBe(51);
  });

  it("rejects impossible input rather than returning non-finite rows", () => {
    expect(() =>
      calculateProjection(scenario({ annualInflation: -1 })),
    ).toThrow(/inflation/);
    expect(() =>
      calculateProjection(scenario({ startingBalance: Number.NaN })),
    ).toThrow(/Starting/);
    expect(() =>
      calculateProjection(
        scenario({
          events: [{ id: "bad", endYear: 52, type: "windfall", amount: 10 }],
        }),
      ),
    ).toThrow(/between 1 and 51/);
  });
});
