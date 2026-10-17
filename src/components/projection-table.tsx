import type { ProjectionRow } from "@/lib/calculator";

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const columns = [
  { key: "openingBalance", label: "Opening balance" },
  { key: "openingTodayValue", label: "Opening balance in today's dollars" },
  { key: "regularWithdrawals", label: "Regular withdrawals" },
  { key: "lumpSumWithdrawals", label: "Lump-sum withdrawals" },
  { key: "lumpSumWindfalls", label: "Windfalls" },
  { key: "closingBalance", label: "Closing balance" },
] as const;

export function ProjectionTable({ rows }: { rows: ProjectionRow[] }) {
  return (
    <>
      <div className="hidden rounded-2xl border border-line bg-white xl:block">
        <table className="w-full table-fixed border-collapse text-right text-sm tabular-nums">
          <caption className="sr-only">
            Annual projection in AUD. Year 0 covers the first 12 months.
          </caption>
          <thead className="bg-[#f5f3ef] text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
            <tr>
              <th scope="col" className="w-[8%] px-4 py-4 text-left">
                Year
              </th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="px-3 py-4">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.year}
                className="border-t border-line text-ink even:bg-[#fcfbf9] hover:bg-[#fff6ef]"
              >
                <th scope="row" className="px-4 py-3 text-left font-semibold">
                  Year {row.year}
                </th>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-3 [overflow-wrap:anywhere] ${column.key === "closingBalance" ? "font-bold" : ""} ${column.key === "closingBalance" && row.closingBalance < 0 ? "text-[#a92f19]" : "text-ink"}`}
                  >
                    {money.format(row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="grid min-w-0 gap-3 sm:grid-cols-2 xl:hidden"
        aria-label="Annual projection by year"
      >
        {rows.map((row) => (
          <details
            key={row.year}
            open={row.year === 0}
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
    </>
  );
}
