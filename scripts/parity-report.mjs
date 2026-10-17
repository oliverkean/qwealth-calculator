import { calculateProjection, defaultInputs } from "../src/lib/calculator.ts";

// Values recalculated in Excel from disposable copies of the supplied workbook.
const fixtures = [
  {
    scenario: "Default",
    overrides: {},
    workbookYear: 0,
    excelClosing: 1649678.8590986747,
  },
  {
    scenario: "Default",
    overrides: {},
    workbookYear: 1,
    excelClosing: 1647111.4984027103,
  },
  {
    scenario: "Default",
    overrides: {},
    workbookYear: 20,
    excelClosing: 84515.55631355359,
  },
  {
    scenario: "Default",
    overrides: {},
    workbookYear: 21,
    excelClosing: -139954.6468874682,
  },
  { scenario: "Default", overrides: {}, workbookYear: 22, excelClosing: 0 },
  {
    scenario: "Zero return",
    overrides: { annualReturn: 0 },
    workbookYear: 1,
    excelClosing: 1407900,
  },
  {
    scenario: "Zero inflation",
    overrides: { annualInflation: 0 },
    workbookYear: 21,
    excelClosing: 1645196.8156407576,
  },
  {
    scenario: "No withdrawals",
    overrides: { monthlyWithdrawal: 0 },
    workbookYear: 50,
    excelClosing: 66062507.08867651,
  },
  {
    scenario: "Negative return",
    overrides: { annualReturn: -0.04 },
    workbookYear: 9,
    excelClosing: -42738.34337211719,
  },
];

const reports = fixtures.map((fixture) => {
  const inputs = {
    ...defaultInputs,
    events: [...defaultInputs.events],
    ...fixture.overrides,
  };
  const actual =
    calculateProjection(inputs).rows[fixture.workbookYear].closingBalance;
  const difference = actual - fixture.excelClosing;
  return {
    scenario: fixture.scenario,
    year: fixture.workbookYear,
    "Excel (AUD)": fixture.excelClosing.toFixed(2),
    "App (AUD)": actual.toFixed(2),
    "Difference (AUD)": difference.toFixed(4),
    "Within 1 cent": Math.abs(difference) < 0.005 ? "PASS" : "FAIL",
  };
});

console.table(reports);
if (reports.some((report) => report["Within 1 cent"] === "FAIL"))
  process.exitCode = 1;
