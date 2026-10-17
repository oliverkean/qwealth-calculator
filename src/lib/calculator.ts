/** Project 51 twelve-month periods, labelled Year 0 through Year 50. */
export const PROJECTION_YEARS = 51;
const MONTHS_PER_YEAR = 12;

export type EventType = "withdrawal" | "windfall";

export type LumpSumEvent = {
  id: string;
  /** 1 means the end of the first twelve months. */
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
  /** Zero-based year: 0 covers the first twelve months. */
  year: number;
  endYear: number;
  openingBalance: number;
  openingTodayValue: number;
  regularWithdrawals: number;
  lumpSumWithdrawals: number;
  lumpSumWindfalls: number;
  closingBalance: number;
  /** Year-end balance expressed in today's purchasing power. */
  closingTodayValue: number;
};

export type Projection = {
  rows: ProjectionRow[];
  /** First end-year with a non-positive closing balance, or null. */
  depletionEndYear: number | null;
};

/** Optional values for the Load example action. */
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

export function calculateProjection(inputs: CalculatorInputs): Projection {
  const errors = validateInputs(inputs);
  if (errors.length > 0) {
    throw new RangeError(errors.join(" "));
  }

  const monthlyRate = (1 + inputs.annualReturn) ** (1 / MONTHS_PER_YEAR) - 1;
  const inflationFactor = 1 + inputs.annualInflation;
  const eventsByYear = groupEventsByYear(inputs.events);
  const rows: ProjectionRow[] = [];
  let depletionEndYear: number | null = null;

  for (let year = 0; year < PROJECTION_YEARS; year += 1) {
    const endYear = year + 1;
    const previousRow = rows[year - 1];
    let openingBalance = inputs.startingBalance;
    let regularWithdrawals = inputs.monthlyWithdrawal * MONTHS_PER_YEAR;

    if (previousRow) {
      openingBalance = previousRow.closingBalance;
      if (openingBalance < 0) {
        openingBalance = 0;
      }

      if (openingBalance > 0) {
        regularWithdrawals = previousRow.regularWithdrawals * inflationFactor;
      } else {
        regularWithdrawals = openingBalance;
      }
    }

    const monthlyWithdrawal = regularWithdrawals / MONTHS_PER_YEAR;
    const balanceAfterRegularWithdrawals = applyGrowthAndMonthlyWithdrawals(
      openingBalance,
      monthlyWithdrawal,
      monthlyRate,
    );
    const { lumpSumWithdrawals, lumpSumWindfalls } = eventsByYear[year];

    // One-off events happen after all twelve monthly periods.
    const closingBalance =
      balanceAfterRegularWithdrawals - lumpSumWithdrawals + lumpSumWindfalls;
    const row: ProjectionRow = {
      year,
      endYear,
      openingBalance,
      openingTodayValue:
        openingBalance / wholePeriodPower(inflationFactor, year),
      regularWithdrawals,
      lumpSumWithdrawals,
      lumpSumWindfalls,
      closingBalance,
      closingTodayValue:
        closingBalance / wholePeriodPower(inflationFactor, endYear),
    };

    const hasNonFiniteValue = Object.values(row).some(
      (value) => typeof value === "number" && !Number.isFinite(value),
    );
    if (hasNonFiniteValue) {
      throw new RangeError(
        "This scenario exceeds the calculator's numeric range.",
      );
    }

    rows.push(row);
    if (depletionEndYear === null && closingBalance <= 0) {
      depletionEndYear = endYear;
    }
  }

  return { rows, depletionEndYear };
}

function groupEventsByYear(events: LumpSumEvent[]) {
  const totals = Array.from({ length: PROJECTION_YEARS }, () => ({
    lumpSumWithdrawals: 0,
    lumpSumWindfalls: 0,
  }));

  for (const event of events) {
    const yearTotals = totals[event.endYear - 1];
    if (event.type === "withdrawal") {
      yearTotals.lumpSumWithdrawals += event.amount;
    } else {
      yearTotals.lumpSumWindfalls += event.amount;
    }
  }

  return totals;
}

/** Apply growth followed by a withdrawal at the end of each month. */
function applyGrowthAndMonthlyWithdrawals(
  openingBalance: number,
  monthlyWithdrawal: number,
  monthlyRate: number,
): number {
  if (monthlyRate === 0) {
    return openingBalance - monthlyWithdrawal * MONTHS_PER_YEAR;
  }

  const annualGrowthFactor = wholePeriodPower(1 + monthlyRate, MONTHS_PER_YEAR);
  const balanceWithGrowth = openingBalance * annualGrowthFactor;
  const withdrawalGrowthFactor = (annualGrowthFactor - 1) / monthlyRate;
  const withdrawalsAtYearEnd = monthlyWithdrawal * withdrawalGrowthFactor;

  return balanceWithGrowth - withdrawalsAtYearEnd;
}

/** Keep the multiplication order stable to preserve cent rounding over whole periods. */
function wholePeriodPower(base: number, exponent: number): number {
  let result = 1;
  let factor = base;
  let remainingExponent = exponent;

  while (remainingExponent > 0) {
    if (remainingExponent % 2 === 1) {
      result *= factor;
    }
    remainingExponent = Math.floor(remainingExponent / 2);
    if (remainingExponent > 0) {
      factor *= factor;
    }
  }

  return result;
}
