"use client";

import { useState } from "react";
import type { ProjectionRow } from "@/lib/calculator";

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Keep compact table headings alongside the full accessible and mobile labels. */
const columns = [
  { key: "openingBalance", heading: "Opening", label: "Opening balance" },
  {
    key: "openingTodayValue",
    heading: "Today's value",
    label: "Opening balance in today's dollars",
  },
  {
    key: "regularWithdrawals",
    heading: "Withdrawals",
    label: "Regular withdrawals",
  },
  {
    key: "lumpSumWithdrawals",
    heading: "Lump sums",
    label: "Lump-sum withdrawals",
  },
  { key: "lumpSumWindfalls", heading: "Windfalls", label: "Windfalls" },
  { key: "closingBalance", heading: "Closing", label: "Closing balance" },
] as const;

/**
 * Display the dashboard's calculated rows. Pagination selects the visible years;
 * the complete projection remains available to the summary and chart.
 */
export function ProjectionTable({ rows }: { rows: ProjectionRow[] }) {
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  // Include Year 0 in the first range, then advance in complete year intervals.
  const pageCount = Math.max(1, Math.ceil((rows.length - 1) / pageSize));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const firstRowIndex = currentPage === 0 ? 0 : currentPage * pageSize + 1;
  const visibleRows = rows.slice(
    firstRowIndex,
    (currentPage + 1) * pageSize + 1,
  );
  const pageButtonClass =
    "min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-semibold transition-colors hover:border-orange hover:text-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p role="status" aria-live="polite" className="text-muted">
          Showing years {visibleRows[0]?.year ?? 0}–
          {visibleRows.at(-1)?.year ?? 0}
        </p>
        <label className="flex items-center gap-3 font-medium">
          Year range
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPageIndex(0);
            }}
            className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
          >
            <option value={10}>10-year ranges</option>
            <option value={25}>25-year ranges</option>
            <option value={51}>All 51</option>
          </select>
        </label>
      </div>
      <div
        role="region"
        aria-label="Scrollable annual projection table"
        tabIndex={0}
        className="hidden overflow-x-auto rounded-2xl border border-line bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange xl:block"
      >
        <table className="w-full min-w-[880px] border-collapse text-right text-sm tabular-nums">
          <caption className="sr-only">
            Annual projection in AUD. Year 0 covers the first 12 months.
          </caption>
          <thead className="bg-[#f5f3ef] text-xs font-semibold text-muted">
            <tr>
              <th scope="col" className="w-[8%] px-4 py-3 text-left">
                Year
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-label={column.label}
                  className="px-3 py-3"
                >
                  {column.heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.year}
                className="border-t border-line text-ink even:bg-[#fcfbf9] hover:bg-[#fff6ef]"
              >
                <th
                  scope="row"
                  className="whitespace-nowrap px-4 py-3 text-left font-semibold"
                >
                  Year {row.year}
                </th>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`whitespace-nowrap px-3 py-3 ${column.key === "closingBalance" ? "font-bold" : ""} ${column.key === "closingBalance" && row.closingBalance < 0 ? "text-[#a92f19]" : "text-ink"}`}
                  >
                    {money.format(row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 hidden text-xs leading-5 text-muted xl:block">
        Today&apos;s value is the inflation-adjusted opening balance. Lump sums
        are one-off withdrawals.
      </p>
      <div
        className="grid min-w-0 gap-3 sm:grid-cols-2 xl:hidden"
        aria-label="Annual projection by year"
      >
        {visibleRows.map((row) => (
          <details
            key={row.year}
            open={row.year === visibleRows[0]?.year}
            className="min-w-0 self-start rounded-xl border border-line bg-white"
          >
            <summary className="min-h-14 cursor-pointer rounded-xl px-4 py-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange">
              <span className="ml-1 inline-flex w-[calc(100%-1.5rem)] flex-wrap items-center justify-between gap-x-3 gap-y-1 align-middle">
                <span>Year {row.year}</span>
                <span
                  className={`tabular-nums [overflow-wrap:anywhere] ${row.closingBalance < 0 ? "text-[#a92f19]" : "text-ink"}`}
                >
                  <span className="sr-only">Closing balance </span>
                  {money.format(row.closingBalance)}
                </span>
              </span>
            </summary>
            <dl className="space-y-3 border-t border-line px-4 py-4 text-sm">
              {columns.map((column) => (
                <div key={column.key} className="grid grid-cols-2 gap-3">
                  <dt className="text-muted">{column.label}</dt>
                  <dd
                    className={`text-right tabular-nums [overflow-wrap:anywhere] ${column.key === "closingBalance" ? "font-bold" : ""}`}
                  >
                    {money.format(row[column.key])}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
      <nav
        aria-label="Annual projection pages"
        className="mt-4 flex flex-wrap items-center justify-between gap-3"
      >
        <button
          type="button"
          disabled={currentPage === 0}
          onClick={() => setPageIndex(currentPage - 1)}
          className={pageButtonClass}
        >
          Previous
        </button>
        <span className="text-sm tabular-nums text-muted">
          Page {currentPage + 1} of {pageCount}
        </span>
        <button
          type="button"
          disabled={currentPage === pageCount - 1}
          onClick={() => setPageIndex(currentPage + 1)}
          className={pageButtonClass}
        >
          Next
        </button>
      </nav>
    </>
  );
}
