import type { PropsWithChildren, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BalanceChart from "@/components/balance-chart";
import {
  calculateProjection,
  defaultInputs,
  type ProjectionRow,
} from "@/lib/calculator";

const {
  chartRender,
  seriesRender,
  axisRender,
  tooltipRender,
  referenceRender,
} = vi.hoisted(() => ({
  chartRender: vi.fn(),
  seriesRender: vi.fn(),
  axisRender: vi.fn(),
  tooltipRender: vi.fn(),
  referenceRender: vi.fn(),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: PropsWithChildren) => children,
  BarChart: (props: PropsWithChildren<{ data: ProjectionRow[] }>) => {
    chartRender(props);
    return <div>{props.children}</div>;
  },
  Bar: (props: { dataKey: string; name: string }) => {
    seriesRender(props);
    return null;
  },
  XAxis: (props: { dataKey: string; ticks: number[] }) => {
    axisRender(props);
    return null;
  },
  Tooltip: (props: {
    content: (props: { active: boolean; label: number }) => ReactNode;
  }) => {
    tooltipRender(props);
    return null;
  },
  CartesianGrid: () => null,
  ReferenceLine: (props: {
    x?: number;
    position?: string;
    className?: string;
  }) => {
    referenceRender(props);
    return null;
  },
  YAxis: () => null,
}));

beforeEach(() => vi.clearAllMocks());

describe("opening balance chart", () => {
  it("plots exactly the table's 51 rows and its two opening-balance fields", () => {
    const projection = calculateProjection({
      ...defaultInputs,
      startingBalance: 1_350_000,
    });
    render(<BalanceChart {...projection} />);
    expect(chartRender.mock.calls.at(-1)?.[0].data).toBe(projection.rows);
    expect(projection.rows.map((row) => row.year)).toEqual(
      Array.from({ length: 51 }, (_, year) => year),
    );
    expect(
      seriesRender.mock.calls.map(([props]) => [props.dataKey, props.name]),
    ).toEqual([
      ["openingBalance", "Opening balance"],
      ["openingTodayValue", "In today's dollars"],
    ]);
    expect(axisRender.mock.calls.at(-1)?.[0]).toMatchObject({
      dataKey: "year",
      ticks: [0, 10, 20, 30, 40, 50],
    });
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /Column chart of opening balances/,
    );
    expect(
      screen.queryByLabelText("Chart duration summary"),
    ).not.toBeInTheDocument();
  });

  it("retains zero openings after a shortfall and does not move a final year-end windfall into the opening", () => {
    const projection = calculateProjection({
      startingBalance: 1000,
      annualReturn: 0,
      annualInflation: 0,
      monthlyWithdrawal: 1000,
      events: [
        { id: "last-year", endYear: 51, type: "windfall", amount: 5000 },
      ],
    });
    render(<BalanceChart {...projection} />);
    const data = chartRender.mock.calls.at(-1)?.[0].data as ProjectionRow[];
    expect(data[0]).toMatchObject({
      openingBalance: 1000,
      openingTodayValue: 1000,
      closingBalance: -11000,
    });
    expect(data[1]).toMatchObject({ openingBalance: 0, openingTodayValue: 0 });
    expect(data[50]).toMatchObject({
      year: 50,
      openingBalance: 0,
      openingTodayValue: 0,
      closingBalance: 5000,
    });
    expect(data).toHaveLength(51);
  });

  it("shows opening, withdrawals, events, and closing values for the selected year", () => {
    const projection = calculateProjection(defaultInputs);
    render(<BalanceChart {...projection} />);
    const tooltip = tooltipRender.mock.calls.at(-1)?.[0];
    render(tooltip.content({ active: true, label: 1 }));
    expect(screen.getByText("Projection Year 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Chart Opening balance")).toHaveTextContent(
      "$1,649,678.86",
    );
    expect(
      screen.getByLabelText("Chart Regular withdrawals"),
    ).toHaveTextContent("$123,600.00");
    expect(screen.getByLabelText("Chart Windfalls")).toHaveTextContent(
      "$1,500.00",
    );
    expect(screen.getByLabelText("Chart Closing balance")).toHaveTextContent(
      "$1,647,111.50",
    );
    expect(
      screen.queryByLabelText("Chart Lump-sum withdrawals"),
    ).not.toBeInTheDocument();
    expect(tooltip.content({ active: false, label: 1 })).toBeNull();
    expect(tooltip.content({ active: true, label: 51 })).toBeNull();
  });

  it.each([
    {
      startingBalance: 1200,
      monthlyWithdrawal: 100,
      expectedYear: 0,
      closing: 0,
    },
    {
      startingBalance: 6100,
      monthlyWithdrawal: 10,
      expectedYear: 50,
      closing: -20,
    },
  ])(
    "marks a shortfall at the end of Year $expectedYear, including exact zero",
    ({ startingBalance, monthlyWithdrawal, expectedYear, closing }) => {
      const projection = calculateProjection({
        startingBalance,
        monthlyWithdrawal,
        annualReturn: 0,
        annualInflation: 0,
        events: [],
      });
      render(<BalanceChart {...projection} />);
      expect(screen.getByRole("img")).toHaveAccessibleName(
        new RegExp(`First shortfall: end of Year ${expectedYear}\\.`),
      );
      const marker = referenceRender.mock.calls
        .map(([props]) => props)
        .find((props) => props.className === "first-shortfall-marker");
      expect(marker).toMatchObject({ x: expectedYear, position: "end" });
      expect(marker.label).toMatchObject({
        position: expectedYear > 25 ? "insideTopRight" : "insideTopLeft",
      });
      const tooltip = tooltipRender.mock.calls.at(-1)?.[0];
      render(tooltip.content({ active: true, label: expectedYear }));
      expect(screen.getByLabelText("Chart Closing balance")).toHaveTextContent(
        new Intl.NumberFormat("en-AU", {
          style: "currency",
          currency: "AUD",
        }).format(closing),
      );
    },
  );

  it("describes the finite horizon and exposes final purchasing power in the tooltip when savings stay positive", () => {
    const projection = calculateProjection({
      ...defaultInputs,
      monthlyWithdrawal: 0,
      events: [],
    });
    render(<BalanceChart {...projection} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /Money stays positive through all 51 projected years/,
    );
    const tooltip = tooltipRender.mock.calls.at(-1)?.[0];
    render(tooltip.content({ active: true, label: 50 }));
    expect(
      screen.getByLabelText("Chart Closing in today's dollars"),
    ).toHaveTextContent(
      new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
      }).format(projection.rows[50].closingTodayValue),
    );
    expect(
      referenceRender.mock.calls.some(
        ([props]) => props.className === "first-shortfall-marker",
      ),
    ).toBe(false);
  });

  it("retains the first shortfall marker when a later windfall restores a balance", () => {
    const projection = calculateProjection({
      startingBalance: 1000,
      monthlyWithdrawal: 1000,
      annualReturn: 0,
      annualInflation: 0,
      events: [{ id: "later", endYear: 4, type: "windfall", amount: 5000 }],
    });
    render(<BalanceChart {...projection} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /First shortfall: end of Year 0\./,
    );
    expect(
      referenceRender.mock.calls
        .map(([props]) => props)
        .find((props) => props.className === "first-shortfall-marker"),
    ).toMatchObject({ x: 0, position: "end" });
    const tooltip = tooltipRender.mock.calls.at(-1)?.[0];
    render(tooltip.content({ active: true, label: 3 }));
    expect(screen.getByLabelText("Chart Windfalls")).toHaveTextContent(
      "$5,000.00",
    );
    expect(screen.getByLabelText("Chart Closing balance")).toHaveTextContent(
      "$5,000.00",
    );
  });
});
