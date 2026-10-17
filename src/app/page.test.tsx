import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import fixtures from "@/test/fixtures/excel-scenarios.json";
import type { ProjectionRow } from "@/lib/calculator";

const { chartRender } = vi.hoisted(() => ({ chartRender: vi.fn() }));
vi.mock("next/dynamic", () => ({
  default: () =>
    function Chart(props: { rows: ProjectionRow[]; startingBalance: number }) {
      chartRender(props);
      return <div role="img" aria-label="Balance chart" />;
    },
}));
beforeEach(() => chartRender.mockClear());

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const columns = [
  "openingBalance",
  "openingTodayValue",
  "regularWithdrawals",
  "lumpSumWithdrawals",
  "lumpSumWindfalls",
  "closingBalance",
] as const;

function renderExample() {
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Load example" }));
}

function expectAnnualRow(year: number, expected: number[]) {
  const table = screen.getByRole("table");
  const row = within(table).getAllByRole("row")[year + 1];
  expect(
    within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(expected.map((value) => money.format(value)));
}

describe("calculator page", () => {
  it("starts empty and calculates only the client's entered values, then clears the scenario", async () => {
    const user = userEvent.setup();
    const fixture = fixtures.find(
      (item) => item.name === "Survives projection",
    )!;
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "Start your projection" }),
    ).toBeInTheDocument();
    screen
      .getAllByRole("spinbutton")
      .forEach((field) => expect(field).toHaveValue(null));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(chartRender).not.toHaveBeenCalled();
    const values = [
      ["Starting balance", fixture.inputs.startingBalance],
      ["Annual investment return", fixture.inputs.annualReturn * 100],
      ["Annual inflation", fixture.inputs.annualInflation * 100],
      ["Monthly withdrawal", fixture.inputs.monthlyWithdrawal],
    ] as const;
    values.forEach(([name, value]) =>
      fireEvent.change(screen.getByRole("spinbutton", { name }), {
        target: { value: String(value) },
      }),
    );
    expectAnnualRow(0, fixture.rows[0]);
    expectAnnualRow(50, fixture.rows[50]);
    expect(screen.getByLabelText("Starting balance result")).toHaveTextContent(
      "$2,500,000.00",
    );
    expect(screen.queryByText("Event 1")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    screen
      .getAllByRole("spinbutton")
      .forEach((field) => expect(field).toHaveValue(null));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "Balance chart" }),
    ).not.toBeInTheDocument();
  });

  it("loads the optional example and explains year indexing", () => {
    renderExample();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "How long will your money last?",
    );
    expect(screen.getByLabelText("First shortfall year")).toHaveTextContent(
      "Year 21",
    );
    expect(
      screen.getByRole("heading", { name: "Calculator inputs" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Planning tools / 01")).not.toBeInTheDocument();
    expect(screen.queryByText("Your assumptions")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: /Year 0/ }),
    ).toBeInTheDocument();
  });

  it("updates the projection and restores the optional example", async () => {
    const user = userEvent.setup();
    renderExample();
    const withdrawal = screen.getByRole("spinbutton", {
      name: /Monthly withdrawal/,
    });
    fireEvent.change(withdrawal, { target: { value: "0" } });
    expect(screen.getByText("51+ years")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load example" }));
    expect(withdrawal).toHaveValue(10000);
    expect(screen.getByLabelText("First shortfall year")).toHaveTextContent(
      "Year 21",
    );
  });

  it("shows inline validation and lets users add and remove events", async () => {
    const user = userEvent.setup();
    renderExample();
    const balance = screen.getByRole("spinbutton", {
      name: /Starting balance/,
    });
    fireEvent.change(balance, { target: { value: "-1" } });
    fireEvent.blur(balance);
    expect(
      screen.getByText("Enter an amount of $0 or more."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Check your inputs" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ Add event" }));
    expect(screen.getByText("Event 4")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Remove" })[3]);
    expect(screen.queryByText("Event 4")).not.toBeInTheDocument();
  });

  it.each(
    fixtures.filter((fixture) =>
      [
        "Zero return",
        "Zero inflation",
        "Zero withdrawals",
        "Larger starting balance",
        "Negative return",
        "Fractional amounts",
        "Large monetary values",
      ].includes(fixture.name),
    ),
  )(
    "recalculates the summary, annual table, and chart for user values: $name",
    (fixture) => {
      renderExample();
      const values = [
        ["Starting balance", fixture.inputs.startingBalance],
        ["Annual investment return", fixture.inputs.annualReturn * 100],
        ["Annual inflation", fixture.inputs.annualInflation * 100],
        ["Monthly withdrawal", fixture.inputs.monthlyWithdrawal],
      ] as const;
      values.forEach(([name, value]) =>
        fireEvent.change(screen.getByRole("spinbutton", { name }), {
          target: { value: String(value) },
        }),
      );

      expect(
        screen.getByLabelText("Starting balance result"),
      ).toHaveTextContent(money.format(fixture.inputs.startingBalance));
      expect(
        screen.getByLabelText("Year 10 nominal balance"),
      ).toHaveTextContent(money.format(fixture.rows[9][5]));
      expect(screen.getByLabelText("First shortfall year")).toHaveTextContent(
        fixture.depletionEndYear === null
          ? "Not reached"
          : `Year ${fixture.depletionEndYear - 1}`,
      );
      expectAnnualRow(0, fixture.rows[0]);
      expectAnnualRow(9, fixture.rows[9]);
      expectAnnualRow(50, fixture.rows[50]);

      const chart = chartRender.mock.calls.at(-1)?.[0] as {
        rows: ProjectionRow[];
        startingBalance: number;
      };
      expect(chart.startingBalance).toBe(fixture.inputs.startingBalance);
      expect(chart.rows).toHaveLength(51);
      fixture.rows.forEach((expected, year) =>
        columns.forEach((column, index) =>
          expect(money.format(chart.rows[year][column])).toBe(
            money.format(expected[index]),
          ),
        ),
      );
    },
  );

  it("recalculates edited event years, types, amounts, duplicates, and removal", async () => {
    const user = userEvent.setup();
    const fixture = fixtures.find(
      (item) => item.name === "Multiple events in one year",
    )!;
    renderExample();
    while (screen.queryAllByRole("button", { name: "Remove" }).length > 0) {
      await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    }
    for (let index = 0; index < fixture.inputs.events.length; index += 1) {
      const event = fixture.inputs.events[index];
      await user.click(screen.getByRole("button", { name: "+ Add event" }));
      fireEvent.change(
        screen.getAllByRole("spinbutton", { name: "End year" })[index],
        { target: { value: String(event.endYear) } },
      );
      await user.selectOptions(
        screen.getAllByRole("combobox", { name: "Type" })[index],
        event.type,
      );
      fireEvent.change(
        screen.getAllByRole("spinbutton", { name: "Amount (AUD)" })[index],
        { target: { value: String(event.amount) } },
      );
    }
    expectAnnualRow(1, fixture.rows[1]);
    expectAnnualRow(29, fixture.rows[29]);
    expectAnnualRow(31, fixture.rows[31]);
    expect(screen.getByLabelText("Year 10 nominal balance")).toHaveTextContent(
      money.format(fixture.rows[9][5]),
    );
    const beforeRemoval = screen.getByLabelText(
      "Year 10 nominal balance",
    ).textContent;
    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(
      screen.getByLabelText("Year 10 nominal balance").textContent,
    ).not.toBe(beforeRemoval);
  });

  it.each([
    ["Starting balance", "-1"],
    ["Monthly withdrawal", "-1"],
    ["Annual investment return", "-101"],
    ["Annual inflation", "-100"],
    ["Starting balance", ""],
  ])("validates %s and recovers after correction", (name, value) => {
    renderExample();
    const field = screen.getByRole("spinbutton", { name });
    const original = (field as HTMLInputElement).value;
    fireEvent.change(field, { target: { value } });
    fireEvent.blur(field);
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.change(field, { target: { value: original } });
    expect(field).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("validates event year and amount, and supports an event in the last projected year", () => {
    renderExample();
    const year = screen.getAllByRole("spinbutton", { name: "End year" })[0];
    const amount = screen.getAllByRole("spinbutton", {
      name: "Amount (AUD)",
    })[0];
    fireEvent.change(year, { target: { value: "52" } });
    fireEvent.blur(year);
    expect(year).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.change(year, { target: { value: "51" } });
    fireEvent.change(amount, { target: { value: "-1" } });
    fireEvent.blur(amount);
    expect(amount).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(amount, { target: { value: "1234.56" } });
    expect(year).toHaveAttribute("aria-invalid", "false");
    expect(amount).toHaveAttribute("aria-invalid", "false");
    expectAnnualRow(50, [0, 0, 0, 0, 1234.56, 1234.56]);
  });
});
