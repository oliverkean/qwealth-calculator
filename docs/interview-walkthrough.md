# Interview walkthrough — Q Wealth calculator

Use this as a speaking guide, not a script to memorise. Open the actual code and point to the relevant functions while explaining.

## The one-minute architecture story

The Next.js App Router page renders an interactive React dashboard. The user edits a local form; the dashboard parses and validates those values, calls a pure TypeScript function, and passes the resulting 51 annual rows to both the summary cards and the Recharts graph/table. There is no server-side financial state and no database because scenarios are not saved. Keeping the engine separate from React makes it straightforward to test against Excel.

The relevant files are `src/lib/calculator.ts`, `src/components/calculator-dashboard.tsx`, `src/components/balance-chart.tsx`, and `src/components/projection-table.tsx`.

## Follow one number through the model

The workbook default starts at $1,650,000, assumes 7.5% annual return, 3% inflation, and withdraws $10,000 at the **end** of each month. We first convert 7.5% to an effective monthly return:

```text
monthlyRate = (1 + 0.075)^(1/12) - 1 ≈ 0.006044919
```

Twelve periods at that rate grow the initial balance to $1,773,750 before withdrawals. But $120,000 is taken in twelve separate $10,000 month-end payments, not as one year-end payment. Excel's `FV` values those payments at about $124,071.14 by year-end. The Year 0 closing balance is therefore **$1,649,678.86**. We use the algebraic equivalent of Excel `FV(rate, 12, payment, -opening)` in TypeScript and special-case zero return.

In the next workbook row (Year 1), the annual withdrawal rises to $123,600: `$120,000 × 1.03`. The $1,500 default windfall is added _after_ the 12 monthly periods. The Year 1 closing balance is **$1,647,111.50**. The opening balance expressed in today's dollars is `$1,649,678.86 ÷ 1.03 = $1,601,629.96`.

“Nominal” means the future-dollar number as projected. “Today's dollars” removes assumed inflation to make future purchasing power comparable with today. The table mirrors the workbook's inflation-adjusted **opening** balance. The chart additionally derives an inflation-adjusted **closing** balance; this is labelled as a derived view, not a source workbook column.

## Depletion and year labels

The workbook starts with **Year 0**, representing the first 12 months. The default first negative closing balance is in workbook **Year 21**, equivalent to the end of the 22nd projection year. The last positive year-end balance is workbook Year 20, so the dashboard describes the duration as **21 completed years** and displays the first shortfall as **Year 21**.

Excel does not model the exact month when funds run out. It computes the full annual FV and retains the negative value of **−$139,954.65** in Year 21. The next opening is reset to zero. If a windfall arrives after that, the balance can become positive again, but regular withdrawals stay at zero because the prior regular-withdrawal row became zero. That is unusual financial behavior, but changing it would break Excel parity.

## How we proved it

The default golden test checks every financial column in workbook Years 0–21 to within half a cent, followed by the remaining zero-balance rows. Alternative inputs were applied to temporary copies of the workbook and recalculated in Excel, then captured as test fixtures. `npm run parity` prints Excel, app, difference, and pass/fail side by side. Cases include zero and negative returns, zero inflation, no withdrawals, early depletion, survival through Year 50, and one-off events. The source PDF and XLSX are deliberately not in the repository.

When explaining numerical accuracy, distinguish **parity at displayed-cent precision** from mathematically exact arithmetic. JavaScript uses binary floating point, and Excel does too. We do not round each year; we compare monetary outputs within half a cent and format only for display. For production financial transactions requiring exact accounting, decimal arithmetic and a separate money policy would be appropriate—but they could introduce discrepancies with this Excel model.

## Deployment story

`npm run check` runs lint, TypeScript, tests, and a production build. `npm run parity` shows the Excel comparison. The GitHub repository can be imported into Vercel as a Next.js project with no environment variables. After deployment, verify the default Year 0, Year 1, and Year 21 figures at the public URL. A successful local build alone is not proof of deployment.

## Interview practice: realistic questions and answers

1. **Why not just calculate annual return as `7.5% / 12`?** 7.5% is an effective annual return. Dividing by 12 produces a nominal monthly rate that compounds to slightly more than 7.5% across a year. The workbook uses `(1 + annualReturn)^(1/12) - 1`, so twelve compounded months equal the annual assumption.

2. **What does Excel `FV` do here?** It combines the opening balance's compound growth with twelve equal month-end withdrawals. In code: `opening × (1 + r)^12 − monthlyWithdrawal × (((1 + r)^12 − 1) / r)`. For `r = 0`, it becomes `opening − 12 × monthlyWithdrawal`.

3. **Why does withdrawal timing matter?** A withdrawal in January has fewer months to earn returns than a withdrawal in December. Treating all $120,000 as one year-end payment would produce a different Year 0 closing balance; Excel treats them as 12 month-end payments.

4. **When does inflation change withdrawals?** The initial 12 monthly payments remain $10,000. At the next annual row, the regular annual total rises from $120,000 to $123,600 at 3% inflation. It rises again only when that year's opening balance is positive, matching Excel.

5. **When are one-off events applied?** At the end of the chosen projection year, after monthly compounding and regular withdrawals. An “End year 1” event changes workbook Year 0's closing balance directly; it does not earn returns during that year.

6. **What is the difference between nominal and real values?** Nominal is the future dollar balance. Real/today's-dollar value discounts it by cumulative inflation. For example, the Year 1 opening $1,649,678.86 is about $1,601,629.96 in today's dollars at 3% annual inflation.

7. **Why show a negative balance instead of zero?** The Excel workbook records the first negative year-end result, then sets the _next_ opening to zero. Showing the negative row makes the shortfall size visible and preserves cent-level parity. The UI separately calls it a shortfall so it is not mistaken for a usable account balance.

8. **How do you detect the depletion year?** Scan rows in order and record the first non-positive closing balance. The workbook's default first negative is Year 21. A later windfall does not erase the fact that the account already had a shortfall.

9. **Why is the engine a pure function?** The same inputs always return the same rows. It has no network calls, React hooks, or mutable shared state. That makes it easy to compare directly with Excel fixtures and reuse in the UI.

10. **Why no API or database?** The brief asks for immediate what-if projections, not accounts or saved scenarios. Sending private financial inputs to a server would add complexity and privacy risk without helping the calculation. If saved plans become a requirement, add a deliberately designed persistence/API layer later.

11. **How did you test against Excel, not just your own formula?** I inspected both worksheets and the translated row formulas, recalculated representative inputs in Excel on disposable copies, and stored their outputs as golden fixtures. The test checks default rows and edge scenarios; the parity command prints the actual monetary differences.

12. **What happens with a zero or negative annual return?** Zero takes an explicit no-interest branch to avoid dividing by zero. Returns down to −100% are mathematically supported by the monthly-rate conversion. A negative return still uses the same FV recurrence, and a −4% case is compared with Excel.

13. **What would you improve with more time?** Add browser-level responsive/accessibility regression tests and a clearer monthly depletion estimate as a separate feature. I would not silently add the monthly estimate to the Excel-parity result, because it would be a different model.

14. **How do you deploy safely?** Run all checks and the parity report, ensure the confidential PDF/XLSX are not tracked, push the repository, import it in Vercel, and smoke-test the public URL. The build needs no secrets or database configuration.
