import type { ProjectionRow } from "@/lib/calculator";

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function ProjectionTable({ rows }: { rows: ProjectionRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full min-w-[1030px] border-collapse text-right text-sm tabular-nums">
        <caption className="sr-only">
          Annual projection. Each row matches one workbook year; Year 0 ends
          after the first 12 months.
        </caption>
        <thead className="bg-[#f5f3ef] text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
          <tr>
            <th scope="col" className="px-5 py-4 text-left">
              Workbook year
            </th>
            <th scope="col" className="px-4 py-4">
              Opening balance
            </th>
            <th scope="col" className="px-4 py-4">
              Opening, today&apos;s $
            </th>
            <th scope="col" className="px-4 py-4">
              Regular withdrawals
            </th>
            <th scope="col" className="px-4 py-4">
              Lump withdrawals
            </th>
            <th scope="col" className="px-4 py-4">
              Windfalls
            </th>
            <th scope="col" className="px-5 py-4">
              Closing balance
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.year}
              className="border-t border-line text-ink even:bg-[#fcfbf9] hover:bg-[#fff6ef]"
            >
              <th
                scope="row"
                className="whitespace-nowrap px-5 py-3 text-left font-semibold"
              >
                Year {row.year}
                <span className="block text-[11px] font-normal text-muted">
                  End year {row.endYear}
                </span>
              </th>
              <td className="px-4 py-3">{money.format(row.openingBalance)}</td>
              <td className="px-4 py-3 text-muted">
                {money.format(row.openingTodayValue)}
              </td>
              <td className="px-4 py-3">
                {money.format(row.regularWithdrawals)}
              </td>
              <td className="px-4 py-3">
                {money.format(row.lumpSumWithdrawals)}
              </td>
              <td className="px-4 py-3">
                {money.format(row.lumpSumWindfalls)}
              </td>
              <td
                className={`px-5 py-3 font-bold ${row.closingBalance < 0 ? "text-[#a92f19]" : "text-ink"}`}
              >
                {money.format(row.closingBalance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
