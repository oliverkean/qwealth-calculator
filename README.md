# Q Wealth — How Long Will My Money Last?

A responsive, client-side retirement drawdown calculator built with Next.js App Router, TypeScript, Tailwind CSS, Recharts, and Vitest. Its calculation engine reproduces the supplied Excel model rather than substituting a conventional retirement formula.

## Run locally

Requires Node.js 22.12+ and npm.

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Change the four assumptions or add end-of-year withdrawals and windfalls; results update immediately. Reset restores the workbook defaults.

## Verify the implementation

```powershell
npm run check       # ESLint, TypeScript, Vitest, production build
npm run parity      # Excel vs app values, differences, and cent-level pass/fail
```

The engine tests compare all six financial columns in every default workbook row through depletion (Years 0–21), then assert the post-depletion behavior. Additional fixtures were recalculated in Excel from temporary copies of the original workbook for zero return/inflation/withdrawals, other starting balances, lump sums, negative returns, early depletion, survival through Year 50, and post-depletion windfalls. Tests compare unrounded app output with Excel to within half a cent. The parity command prints a human-readable subset of those comparisons.

## How the model works

The workbook has 51 rows, labelled Year 0 through Year 50. Year 0 is the **first** 12 months, so a one-off event entered as “End year 1” is applied in workbook Year 0. The default shortfall occurs in workbook Year 21, which is the end of projection year 22; 21 complete years have positive closing balances before it.

| Workbook column           | App field                                 | Calculation                                                                                                                        |
| ------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| C — Balance at year start | `openingBalance`                          | Initial input, then prior closing balance; reset to zero only if the prior closing balance is negative                             |
| D — Today$ Value          | `openingTodayValue`                       | Opening balance ÷ `(1 + inflation)^workbookYear`                                                                                   |
| E — Regular Withdrawals   | `regularWithdrawals`                      | Year 0: monthly withdrawal × 12; later years: prior amount × `(1 + inflation)` only if opening balance is positive, otherwise zero |
| F/G — Lump sums           | `lumpSumWithdrawals` / `lumpSumWindfalls` | Events for that end year, applied after monthly investment growth and regular withdrawals                                          |
| H — Balance at end        | `closingBalance`                          | Excel `FV(monthlyRate, 12, regularWithdrawals / 12, -openingBalance) - lumpWithdrawals + windfalls`                                |

The effective monthly rate is `(1 + annualReturn)^(1/12) - 1`. `FV` assumes the regular withdrawal is taken at the **end** of each month. At a zero monthly rate, the engine uses `openingBalance - regularWithdrawals`, avoiding division by zero. No intermediate values are rounded; AUD formatting occurs only in the UI.

The chart's nominal line uses column H directly. Its dashed inflation-adjusted **closing** line is a derived view: closing balance ÷ `(1 + inflation)^(endYear)`. The workbook itself provides today's-dollar **opening** value in column D; the annual table shows that exact workbook value.

### Non-obvious Excel behavior preserved

- The first negative year-end balance is displayed rather than silently clamped. Only the _following year's opening_ is reset to zero.
- The workbook calculates a whole year's `FV` even if money would run out within that year. This is an annual model, not an exact month-of-depletion forecast.
- A later windfall can create a positive balance after depletion, but regular withdrawals do **not** restart: the previous year's regular withdrawal is already zero.
- The reference `Assumptions` sheet exposes editable event inputs for its first 30 years, while the `DrawdownTable` references event rows through Year 50. The app permits events in all 51 model years. This extends the input surface without altering the row formulas.
- A non-positive closing balance counts as a shortfall in the app summary. The workbook preserves exact zero and only clamps the next opening when the prior closing balance is _negative_.

## Architecture

- `src/lib/calculator.ts`: pure, deterministic calculation, types, defaults, and input validation. No React or browser dependencies.
- `src/components/calculator-dashboard.tsx`: local form state, field feedback, and result composition. Data stays in the browser; no account, API, or database is needed.
- `src/components/balance-chart.tsx`: Recharts visualization, dynamically loaded so the chart bundle is separate from the static page.
- `src/components/projection-table.tsx`: exact annual values in an accessible, horizontally scrollable table.
- `src/lib/calculator.test.ts`: Excel golden fixtures and edge cases.
- `scripts/parity-report.mjs`: readable Excel/app/difference report.
- `docs/interview-walkthrough.md`: a code-based explanation and interview practice questions.

The original confidential PDF and workbook remain outside this repository. Do **not** add them to `public/`, commit them, or upload them to a deployment. The app does not read or transmit user scenarios to a server.

## Deploy to Vercel

1. Run `npm run check` and `npm run parity` locally.
2. Push this source repository to GitHub, excluding the confidential source documents.
3. In Vercel, import the GitHub repository and choose the repository root. Use the detected Next.js settings and `npm run build`.
4. No environment variables or database are required. After deployment, test the default scenario and a changed input at the public URL.

The deployment is complete only when Vercel returns a working public URL. A local production build is not a deployment.

## Limits and disclaimer

This deterministic projection assumes a constant annual return and inflation rate; it does not model market volatility, tax, fees, or changing withdrawal behavior. It is general information, not personalised financial advice or a guarantee. For a real financial decision, speak with a qualified adviser.
