# Reading the calculation engine

## What changed

The engine already had a yearly loop and a first-depletion check. Its main function also contained event grouping, withdrawal conditions, financial formulas, and comments between calculation steps. Reordering that code did not give the individual calculations clear names.

The main function now calls `calculateTodaysValue`, `calculateRegularWithdrawals`, and `calculateClosingBalance`. `groupEventsByYear` handles event preparation before the annual loop. Each function is in `src/lib/calculator.ts`, with explanations above declarations rather than between calculation statements. The public types, validation rules, financial operations, and frontend are unchanged.

## Start with inputs and outputs

A function receives values, does a specific job, and returns a value. Here, `calculateProjection(inputs)` receives the client's scenario and returns two things:

- `rows`: an array containing the annual results. Each object in the array represents one Excel row.
- `depletionEndYear`: the first one-based end-year whose closing balance is zero or negative, or `null` if every closing balance stays positive.

The three calculation functions return numbers. They do not update the screen or change the input object. The main function decides when to call them and stores their answers.

## Inputs to results

`CalculatorDashboard` receives the client's values as form strings. `parseForm` converts them to numbers and converts percentages to decimal rates: entering `7.5` produces `0.075`. Event inputs use projection years 0–50, matching the table. `parseForm` adds one to each selected projection year to produce the engine's end-year; loading an example subtracts one for display. The dashboard calls `calculateProjection` when the form is valid. The optional example supplies sample inputs only when requested.

`calculateProjection` validates those numbers again, converts the effective annual return to a monthly rate, and totals any events assigned to the same end-year. It initializes `openingBalance` from the starting balance and `regularWithdrawals` from twelve monthly payments, then loops through Years 0–50. Year 0 covers the first twelve months; its year-end events have an engine end-year of 1.

`let` means a variable can be assigned another value. `openingBalance` and `regularWithdrawals` use `let` because their values change from year to year. `const` means the variable will not be reassigned. Each year's `closingBalance` uses `const` because that result stays fixed for that iteration.

The loop starts with `year = 0`. After finishing one row, `year += 1` advances to the next year. The condition `year < PROJECTION_YEARS` allows years 0 through 50 because `PROJECTION_YEARS` is 51.

Read each iteration in this order:

1. **Opening balance:** the variable already holds this year's starting amount. It was initialized before Year 0 or carried forward at the end of the previous iteration.
2. **Today's value:** call `calculateTodaysValue` with the opening amount, annual inflation, and number of elapsed years.
3. **Regular withdrawals:** Year 0 uses the initialized annual amount. The condition `year > 0` calls `calculateRegularWithdrawals` only for later years.
4. **Lump-sum withdrawals and windfalls:** read the totals for this row's end-year.
5. **Closing balance:** call `calculateClosingBalance` to apply monthly growth and month-end payments, then year-end events.
6. **Closing purchasing power:** call `calculateTodaysValue` again, this time with the closing balance and `endYear` because one more year has elapsed.
7. **Save the row:** reject numeric overflow, then append the complete row to `rows`.
8. **Check depletion:** record the first non-positive closing balance.
9. **Prepare the next opening:** assign the closing balance to `openingBalance`, using zero if the closing balance is negative. Keep the current regular withdrawal total so the next iteration can adjust it.

`rows.push(row)` appends a new result object to the array. The numbers saved in that object stay attached to that year even when `openingBalance` and `regularWithdrawals` change during the next iteration.

The returned `rows` feed the summary, `ProjectionTable`, and `BalanceChart`. The table displays the opening amount and its today's-dollar value, withdrawals, events, and closing amount. Pagination changes which rows are displayed, not which rows are calculated. The chart plots paired columns from `openingBalance` and `openingTodayValue` for the same Years 0–50. It uses the rows directly, without an extra point. `closingTodayValue` remains available to the summary after ten elapsed years and chart tooltips. The chart also receives `depletionEndYear` from the same projection, rather than calculating a separate depletion result. The marker sits at the end of that projection year's band, while the columns still represent the opening amounts.

## Understand each calculation separately

`calculateTodaysValue(balance, annualInflation, elapsedYears)` answers: "What purchasing power does this amount have in today's dollars?"

```text
today's value = balance / (1 + annualInflation)^elapsedYears
```

At Year 0, no inflation has elapsed, so the opening today's value equals the opening balance. At Year 1, the opening is divided by `1.03` for 3% inflation. The same function handles closing values with `endYear` instead of `year`.

`calculateRegularWithdrawals(openingBalance, previousRegularWithdrawals, annualInflation)` answers: "What annual withdrawal does Excel use after the first year?"

If the opening is positive, it multiplies the previous year's annual withdrawal by `1 + annualInflation`. Otherwise it returns the opening balance, which is zero after a shortfall. This is Excel's actual rule, including its use of the previous annual amount. Recomputing withdrawals from the initial monthly amount each year would both change the arithmetic and incorrectly restart withdrawals after a later windfall.

`calculateClosingBalance(openingBalance, regularWithdrawals, monthlyRate, lumpSumWithdrawals, lumpSumWindfalls)` answers: "What is left after this year's monthly activity and year-end events?"

It divides the annual withdrawal total by twelve to get the monthly payment. Its arithmetic reproduces the workbook's `FV` formula:

```text
monthlyRate = (1 + annualReturn)^(1/12) - 1
growthFactor = (1 + monthlyRate)^12
balanceWithGrowth = openingBalance × growthFactor
withdrawalsAtYearEnd = monthlyPayment × ((growthFactor - 1) / monthlyRate)
balanceBeforeEvents = balanceWithGrowth - withdrawalsAtYearEnd
closingBalance = balanceBeforeEvents - lumpSumWithdrawals + lumpSumWindfalls
```

`balanceWithGrowth` is what the opening money would become without withdrawals. `withdrawalsAtYearEnd` includes the payments and the growth lost because money was withdrawn earlier. Subtracting them gives the balance after monthly activity. Year-end events are then applied without earning any growth during that year.

At zero return, this function subtracts twelve payments directly, then applies the same year-end events. The branch avoids dividing by a zero monthly rate.

## Supporting functions and necessary precision

`groupEventsByYear` adds together events assigned to the same end-year. It keeps withdrawals and windfalls as separate totals. For example, two windfalls of $100 and $200 in end-year 2 produce one $300 total for spreadsheet Year 1. Preparing those totals once keeps event bookkeeping out of the annual calculation loop.

`wholePeriodPower` uses repeated squaring for non-negative integer exponents. Its multiplication order must remain stable: substituting a general power operation or rearranging mathematically equivalent expressions can change displayed cents at rounding boundaries. No intermediate monetary values are rounded.

`validateInputs` checks the scenario before calculation begins. The finite-number check inside the annual loop catches overflow caused by otherwise valid, unusually large inputs. These checks keep invalid values out of the React results.

## Walk through the optional example

The sample starts with $1,650,000, a 7.5% annual return, 3% inflation, and $10,000 monthly withdrawals. Actual clients supply their own values.

| Annual field                       |        Year 0 |        Year 1 |
| ---------------------------------- | ------------: | ------------: |
| Opening balance                    | $1,650,000.00 | $1,649,678.86 |
| Opening balance in today's dollars | $1,650,000.00 | $1,601,629.96 |
| Regular withdrawals                |   $120,000.00 |   $123,600.00 |
| Lump-sum withdrawals               |         $0.00 |         $0.00 |
| Windfalls                          |         $0.00 |     $1,500.00 |
| Closing balance                    | $1,649,678.86 | $1,647,111.50 |

In Year 0, the opening money grows to $1,773,750 before accounting for payments. The twelve $10,000 month-end withdrawals have a combined year-end value of about $124,071.14. Their difference is the $1,649,678.86 closing balance.

Year 1 opens with that unrounded closing balance because the previous iteration assigned it to `openingBalance`. `calculateTodaysValue` divides it by `1.03`. Because `year > 0`, `calculateRegularWithdrawals` changes the annual withdrawal total to `$120,000 × 1.03 = $123,600`, or $10,300 per month. `calculateClosingBalance` applies twelve monthly periods and then the $1,500 windfall, producing $1,647,111.50. Calculations retain unrounded numbers; only the displayed values above are rounded.

## Depletion and later years

The condition is `depletionEndYear === null && closingBalance <= 0`. It records only the first depletion, including an exact-zero result. It never uses `break`.

`&&` means both conditions must be true: depletion has not been recorded yet, and this year's closing is zero or negative. `depletionEndYear` only records a result; it does not control the loop. The loop ends after Year 50.

```ts
if (depletionEndYear === null && closingBalance <= 0) {
  depletionEndYear = endYear;
}

openingBalance = closingBalance < 0 ? 0 : closingBalance;
```

The final line is a conditional expression: use `0` if the closing is negative; otherwise use the closing balance itself. It changes next year's opening only. The saved row still contains this year's actual closing balance.

For the sample, Year 21 closes at −$139,954.65. The engine stores `depletionEndYear = 22`, a one-based end-year. The UI displays Year 21 and 21 complete positive-balance years before the shortfall. The next row opens at zero.

A later windfall can restore a positive balance. Regular withdrawals do not restart once their previous annual total has become zero. This behavior is preserved deliberately. A later recovery also does not erase the first depletion record.

If every closing balance remains positive, `depletionEndYear` stays `null`. This means no depletion within the 51-year projection, not a guarantee that the money lasts forever. The model reports annual shortfalls, not the precise month of depletion.

## Verification

The existing tests passed before this refactor. A before/after comparison of 298 scenarios covers 14,943 annual rows, all returned fields, input immutability, signed zero, and five validation/overflow failures. The SHA-256 digests of the serialized results and errors are identical, with negative zero encoded separately from positive zero.

The existing golden tests independently compare six financial columns over all 51 rows in 19 reference scenarios: 5,814 monetary comparisons plus depletion results. Their precision checks and fixtures were not weakened or changed.

After the refactor, all 61 automated tests passed. A fresh Excel recalculation on a disposable workbook copy also matched all 5,814 monetary values exactly, with zero raw differences, zero displayed-cent differences, and matching depletion years in all 19 scenarios. The original workbook's file hash was unchanged. Targeted lint, formatting, and the production build, including TypeScript checks, passed.

```powershell
npm run test:run -- --maxWorkers=1
npm run parity
npm run typecheck
```

The tradeoff is a few more named functions in the same file. Each financial formula can now be read separately from the yearly loop. Excel-compatible multiplication order and the model's unusual post-depletion rules remain necessary. Future business-rule changes need separate tests; a readability refactor must not silently change them.

## Five interview questions

1. **Why convert the annual return instead of dividing it by twelve?** It is an effective annual rate. The monthly conversion ensures twelve compounded periods reproduce that annual growth.
2. **Why not subtract all regular withdrawals at year-end?** Payments happen monthly, so each payment removes a different amount of future growth. The month-end formula accounts for that timing.
3. **Why continue after the first depletion?** The complete annual table and later events must still be calculated. Recording the first depletion is separate from deciding whether to calculate another row.
4. **Why keep `wholePeriodPower`?** It preserves the established multiplication order and cent-level results at floating-point rounding boundaries.
5. **How do you know the refactor preserved behavior?** The unchanged golden fixtures verify independent reference amounts, and the before/after comparison checks every returned field and representative errors across additional scenarios.
