/** The workbook projects Year 0 through Year 50 (51 twelve-month periods). */
export const PROJECTION_YEARS = 51;

export type EventType = "withdrawal" | "windfall";

export type LumpSumEvent = {
  id: string;
  /** A human-facing year: 1 is applied at the end of workbook Year 0. */
  endYear: number;
  type: EventType;
  amount: number;
};

export type CalculatorInputs = {
  startingBalance: number;
  annualReturn: number;
  annualInflation: number;
  monthlyWithdrawal: number;
  events: LumpSumEvent[];
};

export type ProjectionRow = {
  /** Workbook Year, zero-indexed. */
  year: number;
  endYear: number;
  openingBalance: number;
  openingTodayValue: number;
  regularWithdrawals: number;
  lumpSumWithdrawals: number;
  lumpSumWindfalls: number;
  closingBalance: number;
  /** Derived for the chart; not a column in the reference workbook. */
  closingTodayValue: number;
};

export type Projection = {
  rows: ProjectionRow[];
  /** First end-year with a non-positive closing balance, or null. */
  depletionEndYear: number | null;
};

/** Optional reference scenario for examples and tests; client projections use their submitted inputs. */
export const defaultInputs: CalculatorInputs = {
  startingBalance: 1_650_000,
  annualReturn: 0.075,
  annualInflation: 0.03,
  monthlyWithdrawal: 10_000,
  events: [
    { id: "default-2", endYear: 2, type: "windfall", amount: 1_500 },
    { id: "default-6", endYear: 6, type: "windfall", amount: 1_000 },
    { id: "default-10", endYear: 10, type: "windfall", amount: 1_000 },
  ],
};

export function validateInputs(inputs: CalculatorInputs): string[] {
  const errors: string[] = [];
  const moneyFields: [string, number][] = [
    ["Starting balance", inputs.startingBalance],
    ["Monthly withdrawal", inputs.monthlyWithdrawal],
  ];

  for (const [label, value] of moneyFields) {
    if (!Number.isFinite(value) || value < 0) {
      errors.push(`${label} must be a non-negative number.`);
    }
  }

  if (!Number.isFinite(inputs.annualReturn) || inputs.annualReturn < -1) {
    errors.push("Annual return must be at least -100%.");
  }
  if (
    !Number.isFinite(inputs.annualInflation) ||
    inputs.annualInflation <= -1
  ) {
    errors.push("Annual inflation must be greater than -100%.");
  }

  inputs.events.forEach((event, index) => {
    const label = `Event ${index + 1}`;
    if (
      !Number.isInteger(event.endYear) ||
      event.endYear < 1 ||
      event.endYear > PROJECTION_YEARS
    ) {
      errors.push(`${label} year must be between 1 and ${PROJECTION_YEARS}.`);
    }
    if (event.type !== "withdrawal" && event.type !== "windfall") {
      errors.push(`${label} type must be a withdrawal or windfall.`);
    }
    if (!Number.isFinite(event.amount) || event.amount < 0) {
      errors.push(`${label} amount must be a non-negative number.`);
    }
  });

  return errors;
}

/**
 * Match Excel's integer-power rounding using repeated squaring.
 * Math.pow can differ by a few binary units, enough to cross a half-cent boundary
 * after compounding. The caller supplies a non-negative integer exponent.
 */
function integerPower(base: number, exponent: number): number {
  let result = 1;
  let factor = base;
  let remaining = exponent;
  while (remaining > 0) {
    if (remaining % 2 === 1) result *= factor;
    remaining = Math.floor(remaining / 2);
    if (remaining > 0) factor *= factor;
  }
  return result;
}

/** Mirrors Excel FV(rate, 12, payment, -opening) with end-of-month payments. */
function endOfYearBalance(
  opening: number,
  monthlyWithdrawal: number,
  monthlyRate: number,
): number {
  if (monthlyRate === 0) {
    return opening - monthlyWithdrawal * 12;
  }

  const growth = integerPower(1 + monthlyRate, 12);
  return opening * growth - monthlyWithdrawal * ((growth - 1) / monthlyRate);
}

export function calculateProjection(inputs: CalculatorInputs): Projection {
  const errors = validateInputs(inputs);
  if (errors.length > 0) {
    throw new RangeError(errors.join(" "));
  }

  const monthlyRate = (1 + inputs.annualReturn) ** (1 / 12) - 1;
  const inflationFactor = 1 + inputs.annualInflation;
  const eventTotals = Array.from({ length: PROJECTION_YEARS }, () => ({
    withdrawal: 0,
    windfall: 0,
  }));

  for (const event of inputs.events) {
    eventTotals[event.endYear - 1][event.type] += event.amount;
  }

  const rows: ProjectionRow[] = [];
  let depletionEndYear: number | null = null;

  for (let year = 0; year < PROJECTION_YEARS; year += 1) {
    const previous = rows[year - 1];
    // The workbook retains the first negative closing figure, then resets next year's opening to zero.
    const openingBalance =
      year === 0
        ? inputs.startingBalance
        : previous.closingBalance < 0
          ? 0
          : previous.closingBalance;
    const regularWithdrawals =
      year === 0
        ? inputs.monthlyWithdrawal * 12
        : openingBalance > 0
          ? previous.regularWithdrawals * inflationFactor
          : openingBalance;
    const { withdrawal, windfall } = eventTotals[year];
    const closingBalance =
      endOfYearBalance(openingBalance, regularWithdrawals / 12, monthlyRate) -
      withdrawal +
      windfall;
    const row: ProjectionRow = {
      year,
      endYear: year + 1,
      openingBalance,
      openingTodayValue: openingBalance / integerPower(inflationFactor, year),
      regularWithdrawals,
      lumpSumWithdrawals: withdrawal,
      lumpSumWindfalls: windfall,
      closingBalance,
      closingTodayValue:
        closingBalance / integerPower(inflationFactor, year + 1),
    };

    if (
      Object.values(row).some(
        (value) => typeof value === "number" && !Number.isFinite(value),
      )
    ) {
      throw new RangeError(
        "This scenario exceeds the calculator's numeric range.",
      );
    }

    rows.push(row);
    if (depletionEndYear === null && closingBalance <= 0) {
      depletionEndYear = year + 1;
    }
  }

  return { rows, depletionEndYear };
}
