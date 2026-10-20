"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Bar,
  BarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Projection, ProjectionRow } from "@/lib/calculator";

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compactMoney = new Intl.NumberFormat("en-AU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Show the selected year's cash flow without confusing opening and closing values. */
function YearBalanceTooltip({ row }: { row: ProjectionRow }) {
  const amounts: [string, number][] = [
    ["Opening balance", row.openingBalance],
    ["In today's dollars", row.openingTodayValue],
    ["Regular withdrawals", row.regularWithdrawals],
  ];
  if (row.lumpSumWithdrawals > 0)
    amounts.push(["Lump-sum withdrawals", row.lumpSumWithdrawals]);
  if (row.lumpSumWindfalls > 0)
    amounts.push(["Windfalls", row.lumpSumWindfalls]);
  amounts.push(
    ["Closing balance", row.closingBalance],
    ["Closing in today's dollars", row.closingTodayValue],
  );

  return (
    <div className="w-52 max-w-[calc(100vw-3rem)] rounded-xl border border-line bg-white p-3 text-xs shadow-lg sm:w-64">
      <p className="mb-3 text-sm font-semibold">Projection Year {row.year}</p>
      <dl className="space-y-2">
        {amounts.map(([label, value]) => (
          <div
            key={label}
            className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 ${label.startsWith("Closing") ? "border-t border-line pt-2 font-semibold" : ""}`}
          >
            <dt className="text-muted">{label}</dt>
            <dd
              aria-label={`Chart ${label}`}
              className={`text-right tabular-nums [overflow-wrap:anywhere] ${value < 0 ? "text-[#a92f19]" : "text-ink"}`}
            >
              {money.format(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Compare each year's opening balance with its purchasing power in today's dollars.
 * Use the table's rows directly so year labels and amounts stay aligned.
 */
export default function BalanceChart({ rows, depletionEndYear }: Projection) {
  // Narrow plots cannot fit the cash-flow tooltip beside the active column.
  const [isNarrowChart, setIsNarrowChart] = useState(false);
  const shortfallRow =
    depletionEndYear === null ? undefined : rows[depletionEndYear - 1];
  if (rows.length === 0) return null;
  const durationMessage = shortfallRow
    ? `First shortfall: end of Year ${shortfallRow.year}`
    : `Money stays positive through all ${rows.length} projected years`;

  return (
    <div
      className="w-full"
      role="img"
      aria-label={`Column chart of opening balances and their value in today's dollars for Years 0–50. ${durationMessage}. Exact values are in the annual projection table below.`}
    >
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs leading-5">
        <span className="inline-flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-sm bg-[#df5c2a]"
            aria-hidden="true"
          />
          Opening balance
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-sm bg-[#33483f]"
            aria-hidden="true"
          />
          In today&apos;s dollars
        </span>
      </div>
      <div className="h-[320px] w-full sm:h-[390px]">
        <ResponsiveContainer
          width="100%"
          height="100%"
          onResize={(width) => setIsNarrowChart(width < 300)}
        >
          <BarChart
            data={rows}
            barGap={1}
            barCategoryGap="15%"
            accessibilityLayer
            margin={{ top: 12, right: 14, bottom: 4, left: 2 }}
          >
            <CartesianGrid
              stroke="#e7e5e1"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              dataKey="year"
              ticks={[0, 10, 20, 30, 40, 50]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6b6964", fontSize: 12 }}
              tickMargin={12}
            />
            <YAxis
              width={58}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6b6964", fontSize: 12 }}
              tickFormatter={(value: number) => compactMoney.format(value)}
            />
            <Tooltip
              isAnimationActive={false}
              position={isNarrowChart ? { x: 0 } : undefined}
              content={({ active, label }) => {
                const row = rows.find((row) => row.year === Number(label));
                return active && row ? <YearBalanceTooltip row={row} /> : null;
              }}
            />
            <ReferenceLine y={0} stroke="#a8a49e" />
            {/* Preserve the last year-end marker at fractional band boundaries. */}
            {shortfallRow && (
              <ReferenceLine
                x={shortfallRow.year}
                position="end"
                ifOverflow="visible"
                stroke="#a92f19"
                strokeWidth={2}
                strokeDasharray="4 4"
                className="first-shortfall-marker"
                label={{
                  value: `Year ${shortfallRow.year} end`,
                  position:
                    shortfallRow.year > 25 ? "insideTopRight" : "insideTopLeft",
                  fill: "#a92f19",
                  fontSize: 12,
                }}
              />
            )}
            <Bar
              dataKey="openingBalance"
              name="Opening balance"
              className="opening-balance-series"
              fill="#df5c2a"
              maxBarSize={12}
              isAnimationActive={false}
            />
            <Bar
              dataKey="openingTodayValue"
              name="In today's dollars"
              className="today-value-series"
              fill="#33483f"
              maxBarSize={12}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
