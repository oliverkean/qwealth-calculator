// Project 51 twelve-month periods, labelled Year 0 through Year 50.
export const PROJECTION_YEARS = 51;
const MONTHS_PER_YEAR = 12;

export type EventType = "withdrawal" | "windfall";

/** Events occur at year-end; endYear 1 ends the first twelve months. */
export type LumpSumEvent = {
  id: string;
  endYear: number;
  type: EventType;
  amount: number;
};

/** Annual rates use decimals: 0.075 means 7.5%. */
export type CalculatorInputs = {
  startingBalance: number;
  annualReturn: number;
  annualInflation: number;
  monthlyWithdrawal: number;
  events: LumpSumEvent[];
};

/**
 * Year 0 covers the first twelve months and ends at endYear 1.
 * Today values express opening and closing balances in today's purchasing power.
 */
export type ProjectionRow = {
  year: number;
  endYear: number;
  openingBalance: number;
  openingTodayValue: number;
  regularWithdrawals: number;
  lumpSumWithdrawals: number;
  lumpSumWindfalls: number;
  closingBalance: number;
  closingTodayValue: number;
};

/** depletionEndYear is the first non-positive close; null means none within 51 years. */
export type Projection = {
  rows: ProjectionRow[];
  depletionEndYear: number | null;
};

// Optional sample values for the Load example action.
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
 * Project 51 years of balances using monthly growth and withdrawals.
 * Year 0 uses the initial annual withdrawal; later rows adjust the previous amount.
 * Save each closing balance before resetting a negative balance for the next row.
 */
export function calculateProjection(inputs: CalculatorInputs): Projection {
  const errors = validateInputs(inputs);
  if (errors.length > 0) {
    throw new RangeError(errors.join(" "));
  }

  const monthlyRate = (1 + inputs.annualReturn) ** (1 / MONTHS_PER_YEAR) - 1;
  const eventsByYear = groupEventsByYear(inputs.events);
  const rows: ProjectionRow[] = [];
  let openingBalance = inputs.startingBalance;
  let regularWithdrawals = inputs.monthlyWithdrawal * MONTHS_PER_YEAR;
  let depletionEndYear: number | null = null;

  for (let year = 0; year < PROJECTION_YEARS; year += 1) {
    const endYear = year + 1;
    const openingTodayValue = calculateTodaysValue(
      openingBalance,
      inputs.annualInflation,
      year,
    );

    if (year > 0) {
      regularWithdrawals = calculateRegularWithdrawals(
        openingBalance,
        regularWithdrawals,
        inputs.annualInflation,
      );
    }

    const { lumpSumWithdrawals, lumpSumWindfalls } = eventsByYear[year];
    const closingBalance = calculateClosingBalance(
      openingBalance,
      regularWithdrawals,
      monthlyRate,
      lumpSumWithdrawals,
      lumpSumWindfalls,
    );
    const closingTodayValue = calculateTodaysValue(
      closingBalance,
      inputs.annualInflation,
      endYear,
    );

    const row: ProjectionRow = {
      year,
      endYear,
      openingBalance,
      openingTodayValue,
      regularWithdrawals,
      lumpSumWithdrawals,
      lumpSumWindfalls,
      closingBalance,
      closingTodayValue,
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

    openingBalance = closingBalance < 0 ? 0 : closingBalance;
  }

  return { rows, depletionEndYear };
}

/** Discount a balance by inflation for the number of elapsed years. */
function calculateTodaysValue(
  balance: number,
  annualInflation: number,
  elapsedYears: number,
): number {
  return balance / wholePeriodPower(1 + annualInflation, elapsedYears);
}

/**
 * Adjust the previous annual withdrawal for inflation when the opening is positive.
 * After withdrawals become zero, a later windfall does not restart them.
 */
function calculateRegularWithdrawals(
  openingBalance: number,
  previousRegularWithdrawals: number,
  annualInflation: number,
): number {
  if (openingBalance > 0) {
    return previousRegularWithdrawals * (1 + annualInflation);
  }

  return openingBalance;
}

/**
 * Compound the opening balance and account for twelve month-end withdrawals.
 * Subtract lump-sum withdrawals and add windfalls at year-end.
 * With zero return, subtract the payments without dividing by the monthly rate.
 */
function calculateClosingBalance(
  openingBalance: number,
  regularWithdrawals: number,
  monthlyRate: number,
  lumpSumWithdrawals: number,
  lumpSumWindfalls: number,
): number {
  const monthlyWithdrawal = regularWithdrawals / MONTHS_PER_YEAR;
  let balanceAfterMonthlyWithdrawals: number;

  if (monthlyRate === 0) {
    balanceAfterMonthlyWithdrawals =
      openingBalance - monthlyWithdrawal * MONTHS_PER_YEAR;
  } else {
    const annualGrowthFactor = wholePeriodPower(
      1 + monthlyRate,
      MONTHS_PER_YEAR,
    );
    const balanceWithGrowth = openingBalance * annualGrowthFactor;
    const withdrawalGrowthFactor = (annualGrowthFactor - 1) / monthlyRate;
    const withdrawalsAtYearEnd = monthlyWithdrawal * withdrawalGrowthFactor;

    balanceAfterMonthlyWithdrawals = balanceWithGrowth - withdrawalsAtYearEnd;
  }

  return balanceAfterMonthlyWithdrawals - lumpSumWithdrawals + lumpSumWindfalls;
}

/** Total withdrawals and windfalls separately for each event's end-year. */
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

/** Use a fixed multiplication order to preserve cents near rounding boundaries. */
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
