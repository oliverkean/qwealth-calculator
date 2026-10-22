# Q Wealth — How Long Will My Money Last?

A responsive, client-side retirement drawdown calculator built with Next.js App Router, TypeScript, Tailwind CSS, Recharts, and Vitest. Its calculation engine reproduces the supplied Excel model rather than substituting a conventional retirement formula.

Public application: [qwealth-calculator.vercel.app](https://qwealth-calculator.vercel.app/).

## Run locally

Requires Node.js 22.12+ and npm.

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Starting balance and monthly withdrawal are blank initially; average annual return starts at an editable 7.5% and inflation at 3%. There are no initial one-off events or results. Every result is calculated from the entered values. Load example fills the optional spreadsheet reference scenario; Clear removes all four values and every event.

## Verify the implementation

```powershell
npm run check       # ESLint, TypeScript, Vitest, production build
npm run parity      # Excel vs app values, differences, and cent-level pass/fail
```

The engine tests compare all six financial columns across all 51 rows in 19 scenarios recalculated in Excel: 969 rows and 5,814 monetary comparisons. They check both unrounded differences below half a cent and identical formatted cents, together with the shortfall year. Cases include fractional amounts, large balances, zero and negative rates, and one-off events. Component tests verify that user edits update the summary, annual rows, and chart data. The parity command prints a report for every scenario; use `npm run parity -- --details` for every individual comparison.

### Browser tests

```powershell
npx playwright install chromium  # One-time browser installation
npm run test:e2e                 # Build, then test the production app
npm run test:e2e:report          # Open the HTML results and screenshots
```

Playwright uses one worker by default. During the pre-submission audit, two runs with the earlier two-worker configuration encountered browser asset-load errors (`ERR_NO_BUFFER_SPACE`), while the complete one-worker suite passed. The underlying host/network cause was not established. Running sequentially keeps the same assertions and avoids relying on the previously unreliable parallel configuration.

Playwright runs all thirteen journeys at nine Chromium widths: 320, 336, 375, 640, 768, 1024, 1280, 1440, and 1920 pixels (117 browser tests). The fresh-input journey checks that all four input controls stay inside their card's content area. It checks fresh client inputs, all annual financial fields, live chart columns, events, validation recovery, zero return, depletion, overflow, keyboard navigation, and the favicon. Pagination tests traverse all 51 years and check that the annual projection follows the chart instead of waiting for the sidebar to end. Each test also fails on browser errors or warnings. Page, chart, and paginated-results screenshots are attached to the report. Tests use an isolated production server on port 3100 and do not reuse the preview on port 3000. Generated reports, traces, and screenshots stay in ignored `playwright-report/` and `test-results/` folders. These runs cover Chromium, not Firefox or Safari.

The browser suite also tests 200% text at every viewport. It checks that sidebar buttons and the Year range control remain contained and usable, including keyboard event creation, Cancel focus restoration, and Clear.

## How the model works

The workbook has 51 rows, labelled Year 0 through Year 50. Year 0 is the **first** 12 months, so a one-off event entered as “End year 1” is applied in workbook Year 0. The default shortfall occurs in workbook Year 21, which is the end of projection year 22; 21 complete years have positive closing balances before it.

| Workbook column           | App field                                 | Calculation                                                                                                                        |
| ------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| C — Balance at year start | `openingBalance`                          | Initial input, then prior closing balance; reset to zero only if the prior closing balance is negative                             |
| D — Today$ Value          | `openingTodayValue`                       | Opening balance ÷ `(1 + inflation)^workbookYear`                                                                                   |
| E — Regular Withdrawals   | `regularWithdrawals`                      | Year 0: monthly withdrawal × 12; later years: prior amount × `(1 + inflation)` only if opening balance is positive, otherwise zero |
| F/G — Lump sums           | `lumpSumWithdrawals` / `lumpSumWindfalls` | Events for that end year, applied after monthly investment growth and regular withdrawals                                          |
| H — Balance at end        | `closingBalance`                          | Excel `FV(monthlyRate, 12, regularWithdrawals / 12, -openingBalance) - lumpWithdrawals + windfalls`                                |

The effective monthly rate is `(1 + annualReturn)^(1/12) - 1`. `FV` assumes the regular withdrawal is taken at the **end** of each month. At a zero monthly rate, the engine uses `openingBalance - regularWithdrawals`, avoiding division by zero. Integer exponents use repeated squaring to match Excel's binary rounding; using JavaScript's general power operation can cross a displayed half-cent boundary for some amounts. No intermediate values are rounded to cents; AUD formatting occurs only in the UI.

The summary has three cards: Estimated duration, Starting balance, and After 10 years. Estimated duration counts full years with a positive closing balance before the first shortfall; the chart shows the shortfall year. The summary labelled After 10 years uses the closing balance at the end of projection Year 9, because Year 0 covers the first twelve months.

The chart uses paired columns for the opening balance and its today's-dollar value, matching columns C and D. It plots exactly the 51 projection rows, labelled Years 0–50, without an extra starting point. A dashed marker identifies the end of the first year with a zero or negative close. The chart has no separate duration summary box. Its accessible description reports the first shortfall or survival through the 51-year horizon; later positive balances do not erase an earlier shortfall. Tooltips show both opening and closing balances, regular withdrawals, and nonzero one-off events. The chart does not estimate an exact depletion month.

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
- `src/components/projection-table.tsx`: paginated annual results directly beneath the chart, with 10/25/all-year options. Desktop tables scroll within their own region when needed; narrow screens use expandable cards with the same fields and values.
- `src/lib/calculator.test.ts`: Excel golden fixtures and edge cases.
- `src/lib/calculator-excel.test.ts`: complete annual comparisons across 19 Excel-recalculated scenarios.
- `scripts/extract-excel-fixtures.ps1`: reproduces fixture extraction using installed Windows Excel on a temporary workbook copy.
- `scripts/parity-report.mjs`: readable Excel/app/difference report.
- `docs/calculation-guide.md`: a code-based explanation and interview practice questions.
- `docs/calculator-flow.md`: flowchart of validation, calculation, and live results.
- `docs/functional-requirements.md`: requirement-by-requirement implementation and verification evidence.

The original confidential PDF and workbook remain outside this repository. Do **not** add them to `public/`, commit them, or upload them to a deployment. The app does not read or transmit user scenarios to a server.

## Deploy to Vercel

1. Run `npm run check` and `npm run parity` locally.
2. Push this source repository to GitHub, excluding the confidential source documents.
3. In Vercel, import the GitHub repository and choose the repository root. Use the detected Next.js settings and `npm run build`.
4. No environment variables or database are required. After deployment, test the default scenario and a changed input at the public URL.
