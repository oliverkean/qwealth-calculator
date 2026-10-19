"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProjectionRow } from "@/lib/calculator";

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

type Props = {
  rows: ProjectionRow[];
  startingBalance: number;
};

/**
 * Plot the engine's nominal and today's-dollar closing balances from the dashboard.
 * Prepend the starting amount at time zero, before the first year's growth or withdrawals.
 */
export default function BalanceChart({ rows, startingBalance }: Props) {
  const data = [
    { endYear: 0, nominal: startingBalance, real: startingBalance },
    ...rows.map((row) => ({
      endYear: row.endYear,
      nominal: row.closingBalance,
      real: row.closingTodayValue,
    })),
  ];

  return (
    <div
      className="w-full"
      role="img"
      aria-label="Line chart of nominal and inflation-adjusted year-end balances; exact values are in the annual projection table below."
    >
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs leading-5">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-6 bg-[#df5c2a]" aria-hidden="true" />
          Nominal balance
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="w-6 border-t-2 border-dashed border-[#33483f]"
            aria-hidden="true"
          />
          Inflation-adjusted balance
        </span>
      </div>
      <div className="h-[320px] w-full sm:h-[390px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 12, right: 14, bottom: 4, left: 2 }}
          >
            <CartesianGrid
              stroke="#e7e5e1"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              dataKey="endYear"
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
              formatter={(value, name) => [
                money.format(Number(value)),
                name === "nominal" ? "Nominal balance" : "Today's dollars",
              ]}
              labelFormatter={(label) =>
                Number(label) === 0
                  ? "Starting balance"
                  : `End of year ${label}`
              }
              contentStyle={{
                border: "1px solid #e7e5e1",
                borderRadius: 12,
                boxShadow: "0 12px 32px rgb(0 0 0 / 0.08)",
              }}
            />
            <ReferenceLine y={0} stroke="#a8a49e" />
            <Line
              type="linear"
              dataKey="nominal"
              stroke="#df5c2a"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="real"
              stroke="#33483f"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
