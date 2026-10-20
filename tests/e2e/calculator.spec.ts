import { test, expect, type Page } from "@playwright/test";
import fixtures from "../../src/test/fixtures/excel-scenarios.json";

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const chartName = /Column chart of opening balances/;
const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), "Browser errors and warnings").toEqual([]);
});

async function fillInputs(
  page: Page,
  inputs: {
    startingBalance: number;
    annualReturn: number;
    annualInflation: number;
    monthlyWithdrawal: number;
  },
) {
  for (const [name, value] of [
    ["Starting balance", inputs.startingBalance],
    ["Average annual investment return", inputs.annualReturn * 100],
    ["Average annual inflation", inputs.annualInflation * 100],
    ["Monthly withdrawal", inputs.monthlyWithdrawal],
  ] as const) {
    await page.getByRole("textbox", { name, exact: true }).fill(String(value));
  }
}

async function expectRows(page: Page, rows: number[][]) {
  await page.getByRole("combobox", { name: "Year range" }).selectOption("51");
  const expected = rows.map((row) => row.map((value) => money.format(value)));
  if (page.viewportSize()!.width >= 1280) {
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect
      .poll(() =>
        table
          .locator("tbody tr")
          .evaluateAll((elements) =>
            elements.map((row) =>
              Array.from(
                row.querySelectorAll("td"),
                (cell) => cell.textContent,
              ),
            ),
          ),
      )
      .toEqual(expected);
  } else {
    const cards = page
      .getByLabel("Annual projection by year")
      .locator("details");
    await expect(cards).toHaveCount(51);
    await expect
      .poll(() =>
        cards.evaluateAll((elements) =>
          elements.map((row) =>
            Array.from(row.querySelectorAll("dd"), (cell) => cell.textContent),
          ),
        ),
      )
      .toEqual(expected);
    await expect(page.getByRole("table")).toHaveCount(0);
  }
}

async function expectClosing(page: Page, year: number, amount: number) {
  await page.getByRole("combobox", { name: "Year range" }).selectOption("51");
  const value =
    page.viewportSize()!.width >= 1280
      ? page
          .getByRole("table")
          .locator("tbody tr")
          .nth(year)
          .locator("td")
          .last()
      : page
          .getByLabel("Annual projection by year")
          .locator("details")
          .nth(year)
          .locator("dd")
          .last();
  await expect(value).toHaveText(money.format(amount));
}

async function expectChart(page: Page) {
  const chart = page.getByRole("img", { name: chartName });
  await expect(chart).toBeVisible();
  await expect(chart.locator(".recharts-bar-rectangles")).toHaveCount(2);
  await expect(
    chart.locator(".recharts-bar-rectangle path.recharts-rectangle").first(),
  ).toHaveAttribute("d", /^M.+/);
  return chart;
}

test("chart columns and tooltips follow the table's opening balances and projection years", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  const chart = await expectChart(page);
  const fixture = fixtures.find((item) => item.name === "Default")!;
  const series = chart.locator(".recharts-bar-rectangles");
  for (const [index, group] of (await series.all()).entries()) {
    const nonzeroOpenings = fixture.rows.filter(
      (row) => row[index] !== 0,
    ).length;
    await expect(group.locator(".recharts-bar-rectangle")).toHaveCount(
      nonzeroOpenings,
    );
  }
  const tooltip = chart.locator(".recharts-tooltip-wrapper");
  const hoverYear = async (year: number) => {
    const surface = chart.locator("svg.recharts-surface");
    await surface.scrollIntoViewIfNeeded();
    const nominal = (await series
      .first()
      .locator(".recharts-bar-rectangle")
      .nth(year)
      .boundingBox())!;
    const todaysValue = (await series
      .nth(1)
      .locator(".recharts-bar-rectangle")
      .nth(year)
      .boundingBox())!;
    const plot = (await surface.boundingBox())!;
    // Centre the pair's year band so pixel rounding cannot select its neighbour.
    await surface.hover({
      position: {
        x: (nominal.x + todaysValue.x + todaysValue.width) / 2 - plot.x,
        y: plot.height / 2,
      },
    });
  };
  for (const year of [0, 1, 2]) {
    await hoverYear(year);
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(`Projection Year ${year}`);
    await expect(
      tooltip.getByLabel("Chart Opening balance", { exact: true }),
    ).toHaveText(money.format(fixture.rows[year][0]));
    await expect(
      tooltip.getByLabel("Chart In today's dollars", { exact: true }),
    ).toHaveText(money.format(fixture.rows[year][1]));
  }
  await page
    .getByRole("textbox", { name: "Starting balance", exact: true })
    .fill("1350000");
  await hoverYear(1);
  await expect(tooltip).toContainText("Projection Year 1");
  await expect(tooltip).toContainText("$1,327,178.86");
  await expect(tooltip).toContainText("$1,288,523.16");
  const surface = chart.locator("svg.recharts-surface");
  await page.mouse.move(0, 0);
  await surface.focus();
  await expect(tooltip).toContainText("Projection Year 0");
  await surface.press("ArrowRight");
  await expect(tooltip).toContainText("Projection Year 1");
  await expect(tooltip).toContainText("$1,327,178.86");
  for (let year = 2; year <= 50; year += 1) {
    await surface.press("ArrowRight");
    await expect(tooltip).toContainText(`Projection Year ${year}`);
  }
  await expect(
    tooltip.getByLabel("Chart Opening balance", { exact: true }),
  ).toHaveText("$0.00");
  await expect(
    tooltip.getByLabel("Chart In today's dollars", { exact: true }),
  ).toHaveText("$0.00");
  await surface.press("ArrowRight");
  await expect(tooltip).toContainText("Projection Year 50");
  await surface.press("Tab");
  await page.mouse.move(0, 0);
  await chart.screenshot({
    path: testInfo.outputPath("opening-balances-chart.png"),
  });
});

test("chart retains shortfall markers, exact zero, later funds, and the finite horizon without a summary box", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  const chart = await expectChart(page);
  await expect(
    page.getByLabel("Chart duration summary", { exact: true }),
  ).toHaveCount(0);
  const marker = chart.locator(".first-shortfall-marker");
  await expect(chart).toHaveAccessibleName(/First shortfall: end of Year 21\./);
  await expect(marker).toHaveCount(1);
  const surface = chart.locator("svg.recharts-surface");
  const tooltip = chart.locator(".recharts-tooltip-wrapper");
  await surface.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await surface.focus();
  for (let year = 1; year <= 21; year += 1) {
    await surface.press("ArrowRight");
    await expect(tooltip).toContainText(`Projection Year ${year}`);
  }
  const expected = fixtures.find((item) => item.name === "Default")!.rows[21];
  await expect(
    tooltip.getByLabel("Chart Closing balance", { exact: true }),
  ).toHaveText(money.format(expected[5]));
  await expect(
    tooltip.getByLabel("Chart Regular withdrawals", { exact: true }),
  ).toHaveText(money.format(expected[2]));
  const tooltipBox = (await tooltip.boundingBox())!;
  const plotBox = (await surface.boundingBox())!;
  expect(tooltipBox.x).toBeGreaterThanOrEqual(plotBox.x);
  expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(
    plotBox.x + plotBox.width,
  );
  await chart.screenshot({ path: testInfo.outputPath("shortfall-chart.png") });
  await surface.press("Tab");
  await page
    .getByRole("textbox", { name: "Monthly withdrawal", exact: true })
    .fill("0");
  await expect(chart).toHaveAccessibleName(
    /Money stays positive through all 51 projected years/,
  );
  await expect(marker).toHaveCount(0);

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await fillInputs(page, {
    startingBalance: 1200,
    monthlyWithdrawal: 100,
    annualReturn: 0,
    annualInflation: 0,
  });
  await expect(chart).toHaveAccessibleName(/First shortfall: end of Year 0\./);
  await expect(marker.locator("line")).toHaveAttribute("stroke-width", "2");
  await expect(chart.getByText("Year 0 end", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+ Add event", exact: true }).click();
  await page
    .getByRole("textbox", { name: "End of year (0–50)", exact: true })
    .fill("3");
  await page
    .getByRole("textbox", { name: "Amount (AUD)", exact: true })
    .fill("5000");
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(chart).toHaveAccessibleName(/First shortfall: end of Year 0\./);
  await expect(marker).toHaveCount(1);
  await expectClosing(page, 3, 5000);

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await fillInputs(page, {
    startingBalance: 6100,
    monthlyWithdrawal: 10,
    annualReturn: 0,
    annualInflation: 0,
  });
  await expect(chart).toHaveAccessibleName(/First shortfall: end of Year 50\./);
  await expect(marker.locator("line")).toHaveAttribute("stroke-width", "2");
  const finalLabel = chart.getByText("Year 50 end", { exact: true });
  await expect(finalLabel).toBeVisible();
  const labelBox = (await finalLabel.boundingBox())!;
  const surfaceBox = (await surface.boundingBox())!;
  expect(labelBox.x).toBeGreaterThanOrEqual(surfaceBox.x);
  expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(
    surfaceBox.x + surfaceBox.width,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    page.viewportSize()!.width,
  );
  await page.mouse.move(0, 0);
  await chart.screenshot({
    path: testInfo.outputPath("final-year-shortfall-chart.png"),
  });
});

test("fresh client values produce all annual rows and a real chart without overflow", async ({
  page,
}, testInfo) => {
  const originalViewport = page.viewportSize()!;
  const inputWidths =
    originalViewport.width === 375 ? [320, 336, 375] : [originalViewport.width];
  for (const width of inputWidths) {
    await page.setViewportSize({ ...originalViewport, width });
    const fields = await page.locator("aside input").evaluateAll((elements) =>
      elements.map((input) => {
        const control = input.parentElement!.getBoundingClientRect();
        const card = input.closest("aside")!;
        const cardBox = card.getBoundingClientRect();
        const style = getComputedStyle(card);
        return {
          id: input.id,
          left: control.left,
          right: control.right,
          contentLeft:
            cardBox.left +
            Number.parseFloat(style.borderLeftWidth) +
            Number.parseFloat(style.paddingLeft),
          contentRight:
            cardBox.right -
            Number.parseFloat(style.borderRightWidth) -
            Number.parseFloat(style.paddingRight),
        };
      }),
    );
    expect(fields).toHaveLength(4);
    for (const field of fields) {
      expect(
        field.left,
        `${field.id} left edge at ${width}px`,
      ).toBeGreaterThanOrEqual(field.contentLeft - 1);
      expect(
        field.right,
        `${field.id} right edge at ${width}px`,
      ).toBeLessThanOrEqual(field.contentRight + 1);
    }
  }
  await page.setViewportSize(originalViewport);
  await expect(
    page.getByRole("heading", { name: "Start your projection" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Starting balance", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "Monthly withdrawal", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("textbox", {
      name: "Average annual investment return",
      exact: true,
    }),
  ).toHaveValue("7.5");
  await expect(
    page.getByRole("textbox", {
      name: "Average annual inflation",
      exact: true,
    }),
  ).toHaveValue("3");
  await expect(page.getByRole("img", { name: chartName })).toHaveCount(0);
  const headingLayout = await page
    .getByRole("heading", { level: 1 })
    .evaluate((heading) => ({
      height: heading.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(heading).lineHeight),
    }));
  if (page.viewportSize()!.width >= 768) {
    expect(headingLayout.height).toBeLessThanOrEqual(
      headingLayout.lineHeight + 1,
    );
  }

  await page
    .getByRole("textbox", { name: "Starting balance", exact: true })
    .fill("1650000");
  await page
    .getByRole("textbox", { name: "Monthly withdrawal", exact: true })
    .fill("10000");
  await expectClosing(page, 0, 1_649_678.86);
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toHaveCount(0);
  const initialChart = await expectChart(page);
  const initialColumns = await initialChart
    .locator(".recharts-bar-rectangle path.recharts-rectangle")
    .evaluateAll((paths) => paths.map((path) => path.getAttribute("d")));
  const fixture = fixtures.find((item) => item.name === "Deflation")!;
  await fillInputs(page, fixture.inputs);
  await expectRows(page, fixture.rows);
  await expect(
    page.getByLabel("Starting balance result", { exact: true }),
  ).toHaveText("$1,000,000.00");
  await expect(page.getByLabel("Nominal balance after 10 years")).toHaveText(
    "$203,039.28",
  );
  await expect(page.getByText("After 10 years", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Balance after 10 years in today's dollars"),
  ).toHaveText(
    money.format(
      fixture.rows[9][5] / (1 + fixture.inputs.annualInflation) ** 10,
    ),
  );
  await expect(
    page.getByLabel("Estimated duration", { exact: true }),
  ).toHaveText("12 full years");
  const chart = await expectChart(page);
  await expect
    .poll(() =>
      chart
        .locator(".recharts-bar-rectangle path.recharts-rectangle")
        .evaluateAll((paths) => paths.map((path) => path.getAttribute("d"))),
    )
    .not.toEqual(initialColumns);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      })),
    )
    .toEqual({
      viewport: page.viewportSize()!.width,
      content: page.viewportSize()!.width,
    });

  if (page.viewportSize()!.width < 1280) {
    const lastYear = page
      .getByLabel("Annual projection by year")
      .locator("details")
      .last();
    await lastYear.locator("summary").click();
    await expect(lastYear.locator("dl")).toBeVisible();
    await expect(lastYear.locator("dt")).toHaveCount(6);
  }
  const imagePath = testInfo.outputPath("client-projection.png");
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: imagePath });
  await testInfo.attach("Client projection", {
    path: imagePath,
    contentType: "image/png",
  });
  const chartPath = testInfo.outputPath("balance-chart.png");
  await chart.screenshot({ path: chartPath });
  await testInfo.attach("Real balance chart", {
    path: chartPath,
    contentType: "image/png",
  });
});

test("200% text keeps sidebar actions and the year-range control contained and usable", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: "html { font-size: 32px !important; }" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  const sidebar = page.locator("aside");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(page.viewportSize()!.width);
  const controls = await sidebar.locator("button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const card = button.closest("aside")!;
      const cardBox = card.getBoundingClientRect();
      const style = getComputedStyle(card);
      const bounds = button.getBoundingClientRect();
      return {
        name: button.textContent,
        left: bounds.left,
        right: bounds.right,
        height: bounds.height,
        contentLeft:
          cardBox.left +
          Number.parseFloat(style.borderLeftWidth) +
          Number.parseFloat(style.paddingLeft),
        contentRight:
          cardBox.right -
          Number.parseFloat(style.borderRightWidth) -
          Number.parseFloat(style.paddingRight),
      };
    }),
  );
  for (const control of controls) {
    expect(control.left, `${control.name} left edge`).toBeGreaterThanOrEqual(
      control.contentLeft - 1,
    );
    expect(control.right, `${control.name} right edge`).toBeLessThanOrEqual(
      control.contentRight + 1,
    );
    expect(
      control.height,
      `${control.name} target height`,
    ).toBeGreaterThanOrEqual(44);
  }
  const range = page.getByRole("combobox", { name: "Year range" });
  const rangeBox = (await range.boundingBox())!;
  const annualBox = (await page
    .getByRole("region", { name: "Annual projection", exact: true })
    .boundingBox())!;
  expect(rangeBox.x).toBeGreaterThanOrEqual(annualBox.x);
  expect(rangeBox.x + rangeBox.width).toBeLessThanOrEqual(
    annualBox.x + annualBox.width + 1,
  );
  await range.selectOption("51");
  await expect(range).toHaveValue("51");
  const addEvent = page.getByRole("button", {
    name: "+ Add event",
    exact: true,
  });
  await addEvent.focus();
  await addEvent.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(addEvent).toBeFocused();
  await sidebar.screenshot({
    path: testInfo.outputPath("enlarged-sidebar.png"),
  });
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  for (const input of await page.getByRole("textbox").all()) {
    await expect(input).toHaveValue("");
  }
  await expect(page.getByRole("img", { name: chartName })).toHaveCount(0);
});

test("Load example is optional and Clear removes all values, events, and results", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await expectRows(
    page,
    fixtures.find((item) => item.name === "Default")!.rows,
  );
  await expect(
    page.getByLabel("Estimated duration", { exact: true }),
  ).toHaveText("21 full years");
  await expect(page.getByLabel("First shortfall year")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toHaveCount(3);
  await expectChart(page);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  for (const input of await page.getByRole("textbox").all()) {
    await expect(input).toHaveValue("");
  }
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("img", { name: chartName })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Annual projection", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Start your projection" }),
  ).toBeVisible();
});

test("each main input updates displayed amounts and the actual chart columns", async ({
  page,
}) => {
  for (const [name, value, scenario] of [
    ["Starting balance", "2500000", "Larger starting balance"],
    ["Average annual investment return", "-4", "Negative return"],
    ["Average annual inflation", "0", "Zero inflation"],
    ["Monthly withdrawal", "0", "Zero withdrawals"],
  ] as const) {
    await page
      .getByRole("button", { name: "Load example", exact: true })
      .click();
    const chart = await expectChart(page);
    const previousColumns = await chart
      .locator(".recharts-bar-rectangle path.recharts-rectangle")
      .evaluateAll((paths) => paths.map((path) => path.getAttribute("d")));
    await page.getByRole("textbox", { name, exact: true }).fill(value);
    const fixture = fixtures.find((item) => item.name === scenario)!;
    await expectRows(page, fixture.rows);
    await expect(page.getByLabel("Nominal balance after 10 years")).toHaveText(
      money.format(fixture.rows[9][5]),
    );
    await expect
      .poll(() =>
        chart
          .locator(".recharts-bar-rectangle path.recharts-rectangle")
          .evaluateAll((paths) => paths.map((path) => path.getAttribute("d"))),
      )
      .not.toEqual(previousColumns);
    await expect(
      page.getByLabel("Estimated duration", { exact: true }),
    ).toHaveText(
      fixture.depletionEndYear === null
        ? "51+ years"
        : `${fixture.depletionEndYear - 1} full ${fixture.depletionEndYear === 2 ? "year" : "years"}`,
    );
  }
});

test("event drafts save, cancel, aggregate, and update the selected annual row", async ({
  page,
}, testInfo) => {
  await fillInputs(page, {
    startingBalance: 1_000_000,
    annualReturn: 0,
    annualInflation: 0,
    monthlyWithdrawal: 1000,
  });
  await expectClosing(page, 1, 976_000);
  const add = page.getByRole("button", { name: "+ Add event", exact: true });
  const save = page.getByRole("button", { name: "Save event", exact: true });
  const year = page.getByRole("textbox", {
    name: "End of year (0–50)",
    exact: true,
  });
  const amount = page.getByRole("textbox", {
    name: "Amount (AUD)",
    exact: true,
  });
  const edit = page.getByRole("button", { name: "Edit", exact: true });
  await add.click();
  const dialog = page.getByRole("dialog", { name: "Add one-off event" });
  await expect(dialog).toBeVisible();
  await expect(year).toBeFocused();
  await year.press("Backspace");
  await expect(year).toHaveValue("");
  await year.fill("1");
  await amount.click();
  await amount.press("Backspace");
  await expect(amount).toHaveValue("");
  await amount.fill("5,000");
  await save.click();
  await expectClosing(page, 1, 981_000);
  await expect(
    page.getByRole("list", { name: "One-off event list" }),
  ).toContainText("$5,000.00");
  await edit.click();
  await year.fill("0");
  await page
    .getByRole("dialog")
    .screenshot({ path: testInfo.outputPath("event-modal.png") });
  await save.click();
  await expectClosing(page, 0, 993_000);

  await edit.click();
  await amount.fill("999999");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(edit).toBeFocused();
  await expectClosing(page, 0, 993_000);
  await edit.click();
  await amount.fill("999999");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(edit).toBeFocused();
  await expectClosing(page, 0, 993_000);

  await edit.click();
  await year.fill("1");
  await save.click();
  await expectClosing(page, 0, 988_000);
  await edit.click();
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("withdrawal");
  await save.click();
  await expectClosing(page, 1, 971_000);
  await edit.click();
  await amount.fill("2000");
  await save.click();
  await expectClosing(page, 1, 974_000);
  await edit.click();
  await year.fill("2");
  await save.click();
  await expectClosing(page, 1, 976_000);
  await expectClosing(page, 2, 962_000);
  await add.click();
  await year.fill("2");
  await amount.fill("500");
  await save.click();
  await expectClosing(page, 2, 962_500);
  await page
    .getByRole("button", { name: "Remove", exact: true })
    .first()
    .click();
  await expectClosing(page, 2, 964_500);
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expectClosing(page, 2, 964_000);
  await add.click();
  await page.keyboard.press("Shift+Tab");
  await expect(save).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(year).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(add).toBeFocused();
  await expect(
    page.getByRole("list", { name: "One-off event list" }),
  ).toHaveCount(0);
});

test("invalid main fields hide results and recover after correction", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  for (const [name, invalid, message] of [
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
  ] as const) {
    const input = page.getByRole("textbox", { name, exact: true });
    const original = await input.inputValue();
    await input.fill(invalid);
    await input.press("Tab");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription(message);
    await expect(
      page.getByRole("heading", { name: "Check your inputs" }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: chartName })).toHaveCount(0);
    await input.fill(original);
    await expect(input).toHaveAttribute("aria-invalid", "false");
    await expect(
      page.getByLabel("Estimated duration", { exact: true }),
    ).toHaveText("21 full years");
  }
});

test("event validation rejects invalid years and amounts and permits the last year", async ({
  page,
}) => {
  await fillInputs(page, {
    startingBalance: 1000,
    annualReturn: 0,
    annualInflation: 0,
    monthlyWithdrawal: 0,
  });
  await page.getByRole("button", { name: "+ Add event", exact: true }).click();
  const year = page.getByRole("textbox", {
    name: "End of year (0–50)",
    exact: true,
  });
  const amount = page.getByRole("textbox", {
    name: "Amount (AUD)",
    exact: true,
  });
  for (const invalid of ["", "-1", "51", "1.5"]) {
    await year.fill(invalid);
    await year.press("Tab");
    await expect(year).toHaveAttribute("aria-invalid", "true");
    await expect(year).toHaveAccessibleDescription(
      invalid === ""
        ? "Enter a projection year."
        : "Choose a whole year from 0 to 50.",
    );
    await page.getByRole("button", { name: "Save event", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }
  await year.fill("50");
  await amount.fill("");
  await amount.press("Tab");
  await expect(amount).toHaveAccessibleDescription("Enter an event amount.");
  await amount.fill("-1");
  await amount.press("Tab");
  await expect(amount).toHaveAttribute("aria-invalid", "true");
  await expect(amount).toHaveAccessibleDescription(
    "Amount cannot be negative.",
  );
  await amount.fill("1234.56");
  await expect(year).toHaveAttribute("aria-invalid", "false");
  await expect(amount).toHaveAttribute("aria-invalid", "false");
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expectClosing(page, 49, 1000);
  await expectClosing(page, 50, 2234.56);
});

test("zero return and exact depletion remain finite and numeric overflow is explained", async ({
  page,
}) => {
  const fixture = fixtures.find(
    (item) => item.name === "Exact zero closing balance",
  )!;
  await fillInputs(page, fixture.inputs);
  await expectRows(page, fixture.rows);
  await expect(
    page.getByLabel("Estimated duration", { exact: true }),
  ).toHaveText("0 full years");
  await expectChart(page);
  await page
    .getByRole("textbox", { name: "Starting balance", exact: true })
    .fill("1e308");
  await page
    .getByRole("textbox", {
      name: "Average annual investment return",
      exact: true,
    })
    .fill("7.5");
  await expect(
    page.getByText("This scenario exceeds the calculator's numeric range."),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: chartName })).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Starting balance", exact: true })
    .fill("1200");
  await expectChart(page);
});

test("money formatting supports editing, pasting, validation, and a bounded event list", async ({
  page,
}, testInfo) => {
  const balance = page.getByRole("textbox", {
    name: "Starting balance",
    exact: true,
  });
  const withdrawal = page.getByRole("textbox", {
    name: "Monthly withdrawal",
    exact: true,
  });
  await balance.fill("1350000.50");
  await withdrawal.fill("10000.25");
  await withdrawal.press("Tab");
  await expect(balance).toHaveValue("1,350,000.50");
  await expect(withdrawal).toHaveValue("10,000.25");
  await balance.fill("1,35");
  await balance.press("Tab");
  await expect(balance).toHaveAccessibleDescription("Enter a valid amount.");
  await balance.fill("1,350,000.50");
  await balance.press("Tab");
  await expect(
    page.getByLabel("Starting balance result", { exact: true }),
  ).toHaveText("$1,350,000.50");
  await expectChart(page);
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  for (let index = 0; index < 3; index += 1) {
    await page
      .getByRole("button", { name: "+ Add event", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Amount (AUD)", exact: true })
      .fill("1,000.50");
    await page.getByRole("button", { name: "Save event", exact: true }).click();
  }
  const list = page.getByRole("list", { name: "One-off event list" });
  await expect(list.getByRole("listitem")).toHaveCount(6);
  expect(
    await list.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  expect((await list.boundingBox())!.height).toBeLessThanOrEqual(321);
  await list.getByRole("button", { name: "Edit", exact: true }).last().click();
  await expect(
    page.getByRole("textbox", { name: "Amount (AUD)", exact: true }),
  ).toHaveValue("1,000.50");
  const dialog = page.getByRole("dialog");
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await dialog.screenshot({
    path: testInfo.outputPath("money-event-modal.png"),
  });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    page.viewportSize()!.width,
  );
});

test("keyboard skip link works and the custom favicon is served", async ({
  page,
  request,
}) => {
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Clear", exact: true }),
  ).toBeFocused();
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveAttribute("href", /icon\.svg/);
  const response = await request.get((await icon.getAttribute("href"))!);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
});

test("pagination reaches every year and the table follows the chart without the sidebar gap", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  const fixture = fixtures.find((item) => item.name === "Default")!;
  const desktop = page.viewportSize()!.width >= 1280;
  const next = page.getByRole("button", { name: "Next", exact: true });
  const previous = page.getByRole("button", { name: "Previous", exact: true });
  const size = page.getByRole("combobox", { name: "Year range" });
  const visibleAmounts = () =>
    desktop
      ? page
          .getByRole("table")
          .locator("tbody tr")
          .evaluateAll((rows) =>
            rows.map((row) =>
              Array.from(
                row.querySelectorAll("td"),
                (cell) => cell.textContent,
              ),
            ),
          )
      : page
          .getByLabel("Annual projection by year")
          .locator("details")
          .evaluateAll((rows) =>
            rows.map((row) =>
              Array.from(
                row.querySelectorAll("dd"),
                (cell) => cell.textContent,
              ),
            ),
          );
  await expect(size).toHaveValue("10");
  await expect(previous).toBeDisabled();
  for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
    const expected = fixture.rows
      .slice(pageIndex === 0 ? 0 : pageIndex * 10 + 1, pageIndex * 10 + 11)
      .map((row) => row.map((value) => money.format(value)));
    await expect.poll(visibleAmounts).toEqual(expected);
    await expect(
      page.getByText(`Page ${pageIndex + 1} of 5`, { exact: true }),
    ).toBeVisible();
    if (pageIndex < 4) await next.click();
  }
  await expect(next).toBeDisabled();
  await previous.click();
  await expect(page.getByText("Page 4 of 5", { exact: true })).toBeVisible();
  await size.selectOption("25");
  await expect
    .poll(visibleAmounts)
    .toEqual(
      fixture.rows
        .slice(0, 26)
        .map((row) => row.map((value) => money.format(value))),
    );
  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await expect(previous).toBeDisabled();
  await size.selectOption("51");
  await expect
    .poll(visibleAmounts)
    .toEqual(
      fixture.rows.map((row) => row.map((value) => money.format(value))),
    );
  await expect(next).toBeDisabled();
  await size.selectOption("10");

  const chart = await expectChart(page);
  const annual = page.getByRole("region", {
    name: "Annual projection",
    exact: true,
  });
  const annualBox = (await annual.boundingBox())!;
  const chartCardBox = (await chart.locator("..").boundingBox())!;
  expect(
    annualBox.y - (chartCardBox.y + chartCardBox.height),
  ).toBeGreaterThanOrEqual(20);
  expect(
    annualBox.y - (chartCardBox.y + chartCardBox.height),
  ).toBeLessThanOrEqual(28);
  if (desktop) {
    const inputBox = (await page.locator("aside").boundingBox())!;
    expect(annualBox.x).toBeGreaterThan(inputBox.x + inputBox.width);
    const scrollRegion = page.getByRole("region", {
      name: "Scrollable annual projection table",
    });
    await scrollRegion.focus();
    await expect(scrollRegion).toBeFocused();
    const overflow = await scrollRegion.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    if (overflow) {
      await scrollRegion.press("ArrowRight");
      await expect
        .poll(() => scrollRegion.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);
      await scrollRegion.evaluate((element) => {
        element.scrollLeft = 0;
      });
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    page.viewportSize()!.width,
  );
  await page.mouse.move(0, 0);
  const imagePath = testInfo.outputPath("paginated-results.png");
  await page
    .getByRole("region", { name: "Projection results", exact: true })
    .screenshot({ path: imagePath });
  await testInfo.attach("Chart and paginated results", {
    path: imagePath,
    contentType: "image/png",
  });
});
