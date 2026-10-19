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
  fireEvent.change(screen.getByRole("combobox", { name: "Years per page" }), {
    target: { value: "51" },
  });
  const table = screen.getByRole("table");
  const row = within(table).getAllByRole("row")[year + 1];
  expect(
    within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(expected.map((value) => money.format(value)));
}

describe("calculator page", () => {
  it("starts with default rates and calculates the client's entered values, then clears the scenario", async () => {
    const user = userEvent.setup();
    const fixture = fixtures.find(
      (item) => item.name === "Survives projection",
    )!;
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "Start your projection" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: "Starting balance" }),
    ).toHaveValue(null);
    expect(
      screen.getByRole("spinbutton", { name: "Monthly withdrawal" }),
    ).toHaveValue(null);
    expect(
      screen.getByRole("spinbutton", {
        name: "Average annual investment return",
      }),
    ).toHaveValue(7.5);
    expect(
      screen.getByRole("spinbutton", { name: "Average annual inflation" }),
    ).toHaveValue(3);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(chartRender).not.toHaveBeenCalled();
    const values = [
      ["Starting balance", fixture.inputs.startingBalance],
      ["Average annual investment return", fixture.inputs.annualReturn * 100],
      ["Average annual inflation", fixture.inputs.annualInflation * 100],
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

  it("uses the initial rates and recalculates when the user replaces them", () => {
    render(<Home />);
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Starting balance" }),
      { target: { value: "1650000" } },
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Monthly withdrawal" }),
      { target: { value: "10000" } },
    );
    expectAnnualRow(
      0,
      fixtures.find((item) => item.name === "Default")!.rows[0],
    );
    expect(screen.queryByText("Event 1")).not.toBeInTheDocument();
    const initialChartRows = chartRender.mock.calls.at(-1)?.[0].rows;
    expect(initialChartRows[1].lumpSumWindfalls).toBe(0);

    const fixture = fixtures.find((item) => item.name === "Deflation")!;
    for (const [name, value] of [
      ["Starting balance", fixture.inputs.startingBalance],
      ["Average annual investment return", fixture.inputs.annualReturn * 100],
      ["Average annual inflation", fixture.inputs.annualInflation * 100],
      ["Monthly withdrawal", fixture.inputs.monthlyWithdrawal],
    ] as const) {
      const field = screen.getByRole("spinbutton", { name });
      fireEvent.change(field, { target: { value: String(value) } });
      expect(field).toHaveValue(value);
    }
    expectAnnualRow(0, fixture.rows[0]);
    expectAnnualRow(9, fixture.rows[9]);
    expectAnnualRow(50, fixture.rows[50]);
    expect(screen.getByLabelText("First shortfall year")).toHaveTextContent(
      "Year 12",
    );
    const updatedChartRows = chartRender.mock.calls.at(-1)?.[0].rows;
    expect(updatedChartRows).not.toEqual(initialChartRows);
    fixture.rows.forEach((expected, year) =>
      columns.forEach((column, index) =>
        expect(money.format(updatedChartRows[year][column])).toBe(
          money.format(expected[index]),
        ),
      ),
    );
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
    expect(
      screen.getByRole("spinbutton", {
        name: "Average annual investment return",
      }),
    ).not.toHaveAttribute("aria-describedby");
    expect(
      screen.getByRole("spinbutton", { name: "Monthly withdrawal" }),
    ).toHaveAccessibleDescription("Adjusted yearly for inflation.");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: /Year 0/ }),
    ).toBeInTheDocument();
  });

  it("paginates every year, disables boundary controls, and resets when page size changes", () => {
    renderExample();
    const next = screen.getByRole("button", { name: "Next" });
    const previous = screen.getByRole("button", {
      name: "Previous",
    });
    const rowLabels = () =>
      within(screen.getByRole("table"))
        .getAllByRole("rowheader")
        .map((cell) => cell.textContent);
    expect(previous).toBeDisabled();
    expect(rowLabels()).toEqual(
      Array.from({ length: 10 }, (_, year) => `Year ${year}`),
    );
    for (let page = 1; page < 6; page += 1) fireEvent.click(next);
    expect(rowLabels()).toEqual(["Year 50"]);
    expect(next).toBeDisabled();
    fireEvent.click(previous);
    expect(rowLabels()).toEqual(
      Array.from({ length: 10 }, (_, year) => `Year ${year + 40}`),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Years per page" }), {
      target: { value: "25" },
    });
    expect(rowLabels()).toHaveLength(25);
    expect(rowLabels()[0]).toBe("Year 0");
    expect(previous).toBeDisabled();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Years per page" }), {
      target: { value: "51" },
    });
    expect(rowLabels()).toHaveLength(51);
    expect(next).toBeDisabled();
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
    expect(screen.getByText("Amount cannot be negative.")).toBeInTheDocument();
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
        ["Average annual investment return", fixture.inputs.annualReturn * 100],
        ["Average annual inflation", fixture.inputs.annualInflation * 100],
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
    ["Starting balance", "-1", "Amount cannot be negative."],
    ["Monthly withdrawal", "-1", "Amount cannot be negative."],
    [
      "Average annual investment return",
      "-101",
      "Return cannot be below -100%.",
    ],
    ["Average annual inflation", "-100", "Inflation must be above -100%."],
    ["Average annual inflation", "-101", "Inflation must be above -100%."],
    ["Starting balance", "", "Enter a starting balance."],
    ["Monthly withdrawal", "", "Enter a monthly withdrawal."],
    ["Average annual investment return", "", "Enter an average annual return."],
    ["Average annual inflation", "", "Enter an average annual inflation rate."],
  ])(
    "validates %s (%s) and recovers after correction",
    (name, value, message) => {
      renderExample();
      const field = screen.getByRole("spinbutton", { name });
      const original = (field as HTMLInputElement).value;
      fireEvent.change(field, { target: { value } });
      fireEvent.blur(field);
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAccessibleDescription(message);
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      fireEvent.change(field, { target: { value: original } });
      expect(field).toHaveAttribute("aria-invalid", "false");
      expect(screen.getByRole("table")).toBeInTheDocument();
    },
  );

  it.each([
    ["Starting balance", "0"],
    ["Monthly withdrawal", "0"],
    ["Average annual investment return", "0"],
    ["Average annual inflation", "0"],
    ["Average annual investment return", "-1"],
    ["Average annual inflation", "-1"],
    ["Average annual investment return", "-100"],
  ])("still accepts %s = %s", (name, value) => {
    renderExample();
    const field = screen.getByRole("spinbutton", { name });
    fireEvent.change(field, { target: { value } });
    fireEvent.blur(field);
    expect(field).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Check your inputs" }),
    ).not.toBeInTheDocument();
  });

  it("validates event year and amount, and supports an event in the last projected year", () => {
    renderExample();
    const year = screen.getAllByRole("spinbutton", { name: "End year" })[0];
    const amount = screen.getAllByRole("spinbutton", {
      name: "Amount (AUD)",
    })[0];
    fireEvent.change(year, { target: { value: "" } });
    fireEvent.blur(year);
    expect(year).toHaveAccessibleDescription("Enter an event year.");
    fireEvent.change(year, { target: { value: "52" } });
    expect(year).toHaveAttribute("aria-invalid", "true");
    expect(year).toHaveAccessibleDescription(
      "Choose a whole year from 1 to 51.",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.change(year, { target: { value: "51" } });
    fireEvent.change(amount, { target: { value: "" } });
    fireEvent.blur(amount);
    expect(amount).toHaveAccessibleDescription("Enter an event amount.");
    fireEvent.change(amount, { target: { value: "-1" } });
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(amount).toHaveAccessibleDescription("Amount cannot be negative.");
    fireEvent.change(amount, { target: { value: "1234.56" } });
    expect(year).toHaveAttribute("aria-invalid", "false");
    expect(amount).toHaveAttribute("aria-invalid", "false");
    expectAnnualRow(50, [0, 0, 0, 0, 1234.56, 1234.56]);
  });
});
