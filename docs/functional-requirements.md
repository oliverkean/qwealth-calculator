# Functional requirements review

The PDF leaves visual styling to the developer. Neither “Your assumptions” nor “Planning tools / 01” is required copy. The input section is now “Calculator inputs”, and the extra header label is removed.

| Requirement                                                | Implementation and verification                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editable starting savings in AUD                           | Local form state; changing it updates the summary, chart data, and annual results. Tested with different and fractional starting balances.                                                                                          |
| Editable annual return and inflation                       | Percentage inputs convert to decimal rates for the engine. Tests include zero return, zero inflation, negative return, deflation, and tiny positive return.                                                                         |
| Editable monthly withdrawal                                | Updates each annual row and the shortfall result. A zero-withdrawal case verifies survival through the horizon.                                                                                                                     |
| Optional lump withdrawals and windfalls in a selected year | Users can add, change, and remove events. Events in the same year are aggregated. The allowed end-year range is 1–51. Boundary, duplicate-event, and post-depletion cases are covered.                                              |
| Exact monthly compounding and month-end withdrawals        | The annual engine uses the algebraic Excel FV equivalent for 12 monthly periods. Integer powers use repeated squaring to reproduce Excel's rounding at cent boundaries.                                                             |
| Duration and shortfall result                              | Derived from the first non-positive closing balance. Displays survival through 51 years when no shortfall occurs. Year 0 indexing is explained.                                                                                     |
| Nominal and today's-dollar values                          | The chart shows both; the year-10 summary includes both. The table contains the source model's today's-dollar opening balance.                                                                                                      |
| Complete annual drawdown table                             | All six financial columns for Years 0–50. The table spans the page on desktops. Narrow screens use expandable cards with exactly the same fields and values.                                                                        |
| Responsive chart                                           | Uses fresh engine rows from the current inputs. Its starting point also uses the current starting balance.                                                                                                                          |
| Validation and edge cases                                  | Rejects blank/invalid monetary values, negative amounts, return below −100%, inflation at or below −100%, and event years outside 1–51. Calculation overflow displays an error. Zero values and valid negative rates are supported. |
| Example and fresh-client controls                          | Starts with empty fields. Load example restores the optional reference inputs and events. Clear removes every value and event.                                                                                                      |
| General-information disclaimer                             | Visible footer explains projections depend on entered values, assume constant rates, and are estimates; includes the past-performance warning.                                                                                      |
| No database requirement                                    | All scenario state and financial calculations remain in the browser.                                                                                                                                                                |
| Source documents kept confidential                         | Original PDF and XLSX remain outside the repository and published assets. Test fixtures contain numerical reference outputs, not copies of the source documents.                                                                    |

## Calculation evidence

`src/test/fixtures/excel-scenarios.json` contains 19 scenarios recalculated using installed Excel on a disposable copy of the source workbook. Every scenario contains all 51 rows and six financial columns: **969 rows and 5,814 monetary comparisons**. Tests check both raw differences below half a cent and identical formatted cents, plus the depletion year.

The scenarios include default inputs, zero return/inflation/withdrawals, another starting balance, both lump types, negative return, early depletion, no depletion, fractional amounts, deflation, a windfall after depletion, zero balance, exact-zero closing balance, a total investment loss, tiny positive return, large amounts, and multiple events in one year.

`npm run parity` prints a summary for every scenario and sample Excel/app/difference values. `npm run parity -- --details` prints all comparisons. The extraction script prints newly recalculated JSON when supplied a local workbook path; it closes the disposable workbook without saving and removes the temporary copy.

Component tests verify that editing all four main inputs changes the displayed annual rows and the data passed to the chart. They also cover event edits and removal, invalid-input recovery, Load example, and Clear.

## Browser verification

The production build was checked in responsive frames at 375, 768, 1280, 1440, and 1920 pixels. At every width the page's scroll width equalled its available width. Desktop tables at 1280 pixels and above fitted all seven columns without horizontal scrolling; narrower screens displayed the expandable year cards with all six financial fields.

A fresh browser scenario entered $1,000,000, 2% annual return, −1% inflation, and $8,000 monthly withdrawals, with no events. It displayed a Year 0 closing balance of $923,123.15, a Year 10-end balance of $203,039.28, and the first shortfall in Year 12, matching the Excel fixture. Changing monthly withdrawals to zero changed the chart path and showed no shortfall. Clear removed all four values and the results. The optional example is loaded only by its own button.

The custom SVG favicon returned HTTP 200 with the SVG content type, and the page's icon link references it. The direct production preview had no browser warnings or errors.

## Deployment status

The application can be built and run locally. A Vercel public URL remains a separate delivery requirement; the latest checked CLI session was logged out. Do not claim public deployment until the URL is created and smoke-tested.
